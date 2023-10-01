import { parse } from "dotenv"
import ch from "./ContractHelper.js"
import tokenHelper from "./TokenHelper.js"
import util from "./Utility.js"
import walletManager from "./WalletManager.js"
import ph from "./PriceHelper.js"
import { ethers } from "ethers"
await tokenHelper.init()

const ERC20TransferAlchemy = {
  // ["external", "internal", "erc20"]
  CATEGORY_EXTERNAL: "external",
  CATEGORY_INTERNAL: "internal",
  CATEGORY_ERC20: "erc20",
  // Mapping from txHash to block number
  cachedBlockNum: {},

  analyzeERC20Transfers: async function (walletAddress) {
    walletAddress = walletAddress.toLowerCase()
    util.debugLog(`-- Start analyzing wallet ${walletAddress}`)
    const wallet = await walletManager.findOrCreateWallet(walletAddress)
    const rawERC20Transfers = await ch.fetchERC20TransfersByWalletEtherScan(walletAddress)
    const esTransfersGrouped = await this.groupEtherScanERC20TransfersByTxHash(rawERC20Transfers)
    // util.writeTextToFile(`./logs/esERC20Grouped.json`, util.jsonToString(esTransfersGrouped))
    const rawTxList = await ch.fetchTransferTxByAddress(walletAddress, [this.CATEGORY_ERC20, this.CATEGORY_EXTERNAL, this.CATEGORY_INTERNAL])
    const txGrouped = this.groupAllTransfersByTxHash(rawTxList)
    // util.writeTextToFile(`./logs/txGrouped.json`, util.jsonToString(txGrouped))
    const swapInfoList = await this.extractSwapInfoFromTxGrouped(txGrouped, esTransfersGrouped)
    for (let txHash of Object.keys(swapInfoList)) {
      let swapInfo = await this.deteremineTxValueOfSwap(swapInfoList[txHash])
      swapInfoList[txHash] = swapInfo
      await walletManager.saveSwapInfo(txHash, swapInfo, wallet)
    }
    // util.writeTextToFile(`./logs/swapInfoList.json`, util.jsonToString(swapInfoList))
  },

  deteremineTxValueOfSwap: async function (swapInfo) {
    const ethPrice = await ph.getETHPriceInUSD(BigInt(swapInfo.timestamp))
    swapInfo.ethPriceUSD = ethPrice
    if (swapInfo.isETHInvolved) {
      let ethSwapAmount = 0
      let nonETHInfo = {}
      let isBuyingETH = false
      if (ch.isETHorWETH(swapInfo.buy.address)) {
        // If we're buying ETH or WETH
        ethSwapAmount = swapInfo.buy.amount
        swapInfo.buyPriceUSD18 = BigInt(ethPrice * 100) * util.BIG_1018
        nonETHInfo = swapInfo.sell
        isBuyingETH = true
      } else {
        // If we're selling ETH or WETH
        ethSwapAmount = swapInfo.sell.amount
        swapInfo.sellPriceUSD18 = BigInt(ethPrice * 100) * util.BIG_1018
        nonETHInfo = swapInfo.buy
      }
      const txnValueUSD18 = (ethSwapAmount * BigInt(ethPrice * 100)) / 100n
      swapInfo.txnValueUSD = parseFloat(ethers.formatUnits(txnValueUSD18, 18)).toFixed(2)
      const gasCostUSD18 = (swapInfo.gasCost * BigInt(ethPrice * 100)) / 100n
      swapInfo.gasCostUSD = parseFloat(ethers.formatUnits(gasCostUSD18, 18)).toFixed(2)
      if (isBuyingETH) {
        // Calculate revenue from selling nonETH token by deducting gas cost
        const nonETHPrice18 = ((txnValueUSD18 - gasCostUSD18) * util.BIG_1018) / nonETHInfo.amount
        swapInfo.sellPriceUSD18 = nonETHPrice18
      } else {
        // Calculate cost basis from buying nonETH token by adding gas cost
        const nonETHPrice18 = ((txnValueUSD18 + gasCostUSD18) * util.BIG_1018) / nonETHInfo.amount
        swapInfo.buyPriceUSD18 = nonETHPrice18
      }
    }
    return swapInfo
  },

  groupEtherScanERC20TransfersByTxHash: async function (rawERC20Transfers) {
    let esTransferGrouped = {}
    for (let transfer of rawERC20Transfers) {
      let txHash = transfer.hash
      if (!esTransferGrouped[txHash]) {
        esTransferGrouped[txHash] = {
          timestamp: transfer.timeStamp,
          gasCost: BigInt(transfer.gasPrice) * BigInt(transfer.gasUsed),
        }
      }
      // Btw, store token info to cache and DB
      await tokenHelper.addToCache(transfer.contractAddress, transfer.tokenSymbol, transfer.tokenName, transfer.tokenDecimal)
    }
    return esTransferGrouped
  },

  extractSwapInfoFromTxGrouped: async function (txGrouped, esTransfersGrouped) {
    let swapInfoList = {}
    let keyList = Object.keys(txGrouped)
    for (let txHash of keyList) {
      let txFromList = txGrouped[txHash].from
      let txToList = txGrouped[txHash].to
      let rawSellList = await this.extractTransferInfoFromOneTxOneDirection(txFromList)
      let rawBuyList = await this.extractTransferInfoFromOneTxOneDirection(txToList)
      let listInfo = this.cancelOutBuyAndSellFromSwapInfo(rawBuyList, rawSellList)
      listInfo = this.resolveSwapExceptions(listInfo.buyList, listInfo.sellList, txHash, txGrouped)
      let buyList = listInfo.buyList
      let sellList = listInfo.sellList
      let buyListKeys = Object.keys(buyList)
      let sellListKeys = Object.keys(sellList)
      let transferCount = buyListKeys.length + sellListKeys.length
      if (buyListKeys.length > 0 && sellListKeys.length > 0 && transferCount == 2) {
        sellList[sellListKeys[0]].amount *= BigInt(-1)
        let swapInfo = {
          buy: buyList[buyListKeys[0]],
          sell: sellList[sellListKeys[0]],
          blockNum: this.cachedBlockNum[txHash],
          isETHInvolved: ch.isETHorWETH(buyListKeys[0]) || ch.isETHorWETH(sellListKeys[0]),
        }
        let esInfo = esTransfersGrouped[txHash]
        if (!esInfo) {
          util.debugLog(`!!!! Missing tx info from EtherScan for tx ${txHash}`)
        } else {
          swapInfo.gasCost = esInfo.gasCost
          swapInfo.timestamp = esInfo.timestamp
        }
        swapInfoList[txHash] = swapInfo
      } else if (transferCount == 1) {
        // This is a regular transfer
      } else if (transferCount == 0) {
        // This is a swap between ETH and WETH that we ignored in resolveSwapExceptions()
      } else if (buyListKeys.length > 0 && sellListKeys.length > 0) {
        // TODO: Log these exceptions for review later
        // More than 3 buy+sell transfers in one tx, need to investigate
        util.debugLog(`!! There are 3 or more tranfers in tx ${txHash}`)
        util.debugLog(buyList)
        util.debugLog(sellList)
      } else {
        util.debugLog(` Multiple receive-only or send-only in tx ${txHash}`)
      }
    }
    return swapInfoList
  },

  resolveSwapExceptions: function (buyList, sellList, txHash, txGrouped) {
    let buyListKeys = Object.keys(buyList)
    let sellListKeys = Object.keys(sellList)
    if (sellListKeys.length > 1) {
      // Ignore the sell of token if we're burning this token
      for (let tokenAddress of sellListKeys) {
        let isBurned = this.isTokenBurned(txGrouped[txHash]["from"][this.CATEGORY_ERC20], tokenAddress)
        if (isBurned) {
          delete sellList[tokenAddress]
          sellListKeys = Object.keys(sellList)
        }
      }
    }
    if (buyListKeys.length > 1) {
      // Ignore the buy of token if we're receiving this token from 0x0, meaning it's freshly minted when we buy
      for (let tokenAddress of buyListKeys) {
        let isMinted = this.isTokenMinted(txGrouped[txHash]["to"][this.CATEGORY_ERC20], tokenAddress)
        if (isMinted) {
          delete buyList[tokenAddress]
          buyListKeys = Object.keys(buyList)
        }
      }
    }
    if (buyListKeys.length > 1 && sellListKeys.length == 1) {
      let isBuyingETH = false
      for (let tokenAddress of buyListKeys) {
        if (ch.isETHorWETH(tokenAddress)) {
          isBuyingETH = true
        }
      }
      if (!ch.isETHorWETH(sellListKeys[0])) {
        // If we are selling non-eth and buying eth/weth, ignore other tokens that we received
        for (let tokenAddress of buyListKeys) {
          if (!ch.isETHorWETH(tokenAddress)) {
            delete buyList[tokenAddress]
            buyListKeys = Object.keys(buyList)
          }
        }
      }
    }
    if (buyListKeys.length == 1 && sellListKeys.length == 1) {
      if (ch.isETHorWETH(sellListKeys[0]) && ch.isETHorWETH(buyListKeys[0])) {
        // If we are swapping between ETH and WETH, ignore both
        delete buyList[buyListKeys[0]]
        delete sellList[sellListKeys[0]]
      }
    }
    return { buyList, sellList }
  },

  isTokenMinted: function (transferList, tokenAddress) {
    for (let transfer of transferList) {
      if (ch.isSameAddress(transfer.rawContract.address, tokenAddress)) {
        let fromAddres = transfer.from
        if (ch.isSameAddress(fromAddres, tokenHelper.NULL_ADDRESS)) {
          return true
        }
      }
    }
    return false
  },

  isTokenBurned: function (transferList, tokenAddress) {
    for (let transfer of transferList) {
      if (ch.isSameAddress(transfer.rawContract.address, tokenAddress)) {
        let toAddress = transfer.to
        if (ch.isSameAddress(toAddress, tokenHelper.DEAD_ADDRESS) || ch.isSameAddress(toAddress, tokenHelper.NULL_ADDRESS)) {
          return true
        }
      }
    }
    return false
  },

  cancelOutBuyAndSellFromSwapInfo: function (buyList, sellList) {
    // If buy and sell on the same token then we need to check the amount and cancel them out
    let swapList = {}
    for (let address of Object.keys(buyList)) {
      swapList[address] = buyList[address]
    }
    for (let address of Object.keys(sellList)) {
      if (!swapList[address]) {
        // Didn't buy this token
        swapList[address] = sellList[address]
        swapList[address].amount = BigInt(-1) * swapList[address].amount
      } else {
        // Bought this token, reduce the buy amount
        swapList[address].amount -= sellList[address].amount
      }
    }
    let newBuyList = {}
    let newSellList = {}
    for (let address of Object.keys(swapList)) {
      if (swapList[address].amount != BigInt(0)) {
        if (swapList[address].amount > 0) {
          newBuyList[address] = swapList[address]
        } else {
          newSellList[address] = swapList[address]
        }
      }
    }
    return { buyList: newBuyList, sellList: newSellList }
  },

  extractTransferInfoFromOneTxOneDirection: async function (txDirectionList) {
    let returnList = {}
    for (let category of [this.CATEGORY_ERC20, this.CATEGORY_EXTERNAL, this.CATEGORY_INTERNAL]) {
      let transferList = txDirectionList[category]
      if (!transferList) {
        continue
      }
      for (let transfer of transferList) {
        let rawDecimals = transfer.rawContract.decimal
        let amount = BigInt(transfer.rawContract.value)
        let decimals = rawDecimals === null ? 0 : parseInt(rawDecimals, 16)
        // Need to convert all amount to 18 decimals, for easy math later
        let newAmountObject = util.convertTo18Decimals(amount, decimals)
        let address = category == this.CATEGORY_ERC20 ? transfer.rawContract.address : tokenHelper.ETH_ADDRESS
        // Btw, cache blockNum
        this.cachedBlockNum[transfer.hash] = parseInt(transfer.blockNum, 16)
        if (!returnList[address]) {
          returnList[address] = {
            amount: newAmountObject.amount,
            decimals: newAmountObject.decimals,
            address,
          }
        } else {
          // If this is a transfer on the same token and the same direction, we add up the amount
          returnList[address].amount += newAmountObject.amount
        }
      }
    }
    return returnList
  },

  groupAllTransfersByTxHash: function (rawTxList) {
    let txGrouped = {}
    txGrouped = this.groupTransfersByHashAndCategory(txGrouped, rawTxList.transfersTo, "to")
    txGrouped = this.groupTransfersByHashAndCategory(txGrouped, rawTxList.transfersFrom, "from")
    return txGrouped
  },

  groupTransfersByHashAndCategory: function (txGrouped, txList, direction = "from") {
    for (let transfer of txList) {
      let txHash = transfer.hash
      let category = transfer.category
      if (!txGrouped[txHash]) {
        txGrouped[txHash] = {
          from: {},
          to: {},
        }
      }
      if (!txGrouped[txHash][direction][category]) {
        txGrouped[txHash][direction][category] = []
      }
      txGrouped[txHash][direction][category].push(transfer)
    }
    return txGrouped
  },
}

export default ERC20TransferAlchemy
