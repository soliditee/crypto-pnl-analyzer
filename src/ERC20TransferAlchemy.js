import { parse } from "dotenv"
import contractHelper from "./ContractHelper.js"
import tokenHelper from "./TokenHelper.js"
import util from "./Utility.js"
import { BigNumber } from "alchemy-sdk"
tokenHelper.init()

const ERC20TransferAlchemy = {
  // ["external", "internal", "erc20"]
  CATEGORY_EXTERNAL: "external",
  CATEGORY_INTERNAL: "internal",
  CATEGORY_ERC20: "erc20",
  // Mapping from txHash to block number
  cachedBlockNum: {},

  analyzeERC20Transfers: async function (walletAddress) {
    util.debugLog(`-- Start analyzing wallet ${walletAddress}`)
    const rawTxList = await contractHelper.fetchTransferTxByAddress(walletAddress, [this.CATEGORY_ERC20, this.CATEGORY_EXTERNAL, this.CATEGORY_INTERNAL])
    const txGrouped = this.groupAllTransfersByTxHash(rawTxList)
    // util.writeTextToFile(`./logs/txGrouped.json`, util.jsonToString(txGrouped))
    const swapInfoList = await this.extractSwapInfoFromTxGrouped(txGrouped)
    util.writeTextToFile(`./logs/swapInfoList.json`, util.jsonToString(swapInfoList))
  },

  extractSwapInfoFromTxGrouped: async function (txGrouped) {
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
        let swapInfo = {
          buy: buyList[buyListKeys[0]],
          sell: sellList[sellListKeys[0]],
          blockNum: this.cachedBlockNum[txHash],
        }
        swapInfoList[txHash] = swapInfo
      } else if (transferCount == 1) {
        // This is a regular transfer
      } else if (buyListKeys.length > 0 && sellListKeys.length > 0) {
        // TODO: Log these exceptions for review later
        // More than 3 buy+sell transfers in one tx, need to investigate
        util.debugLog(`!! There are 3 or more tranfers in tx ${txHash}`)
        util.debugLog(buyList)
        util.debugLog(sellList)
      } else {
        util.debugLog(`!! Buy only or sell only in tx ${txHash}`)
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
        }
      }
    }
    if (buyListKeys.length > 1) {
      // Ignore the buy of token if we're receiving this token from 0x0, meaning it's freshly minted when we buy
      for (let tokenAddress of buyListKeys) {
        let isMinted = this.isTokenMinted(txGrouped[txHash]["to"][this.CATEGORY_ERC20], tokenAddress)
        if (isMinted) {
          delete buyList[tokenAddress]
        }
      }
    }
    if (buyListKeys.length > 1 && sellListKeys.length == 1) {
      let isBuyingETH = false
      for (let tokenAddress of buyListKeys) {
        if (contractHelper.isETHorWETH(tokenAddress)) {
          isBuyingETH = true
        }
      }
      if (!contractHelper.isETHorWETH(sellListKeys[0])) {
        // If we are selling non-eth and buying eth/weth, ignore other tokens to complete this swap
        for (let tokenAddress of buyListKeys) {
          if (!contractHelper.isETHorWETH(tokenAddress)) {
            delete buyList[tokenAddress]
          }
        }
      }
    }
    return { buyList, sellList }
  },

  isTokenMinted: function (transferList, tokenAddress) {
    for (let transfer of transferList) {
      if (contractHelper.isSameAddress(transfer.rawContract.address, tokenAddress)) {
        let fromAddres = transfer.from
        if (contractHelper.isSameAddress(fromAddres, tokenHelper.NULL_ADDRESS)) {
          return true
        }
      }
    }
    return false
  },

  isTokenBurned: function (transferList, tokenAddress) {
    for (let transfer of transferList) {
      if (contractHelper.isSameAddress(transfer.rawContract.address, tokenAddress)) {
        let toAddress = transfer.to
        if (contractHelper.isSameAddress(toAddress, tokenHelper.DEAD_ADDRESS) || contractHelper.isSameAddress(toAddress, tokenHelper.NULL_ADDRESS)) {
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
        // Btw, also store token info to cache and DB
        await tokenHelper.addToCache(address, transfer.asset, transfer.asset)
        // Also btw, cache blockNum
        this.cachedBlockNum[transfer.hash] = parseInt(transfer.blockNum, 16)
        if (!returnList[address]) {
          returnList[address] = {
            amount: newAmountObject.amount,
            decimals: newAmountObject.decimals,
            address,
          }
        } else {
          // If this is a transfer on the same token and the same direction, we add up the amount
          returnList[address].amount += amount
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
