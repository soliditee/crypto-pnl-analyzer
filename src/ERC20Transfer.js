const axios = require("axios")
const util = require("./Utility")
const { ethers, Interface } = require("ethers")
const { parse } = require("dotenv")
const contractHelper = require("./ContractHelper")
const tokenHelper = require("./TokenHelper")

const ERC20Transfer = {
  DIRECTION_BUY: "buy",
  DIRECTION_SELL: "sell",
  provider: contractHelper.provider,

  analyzeERC20Transfers: async function (walletAddress) {
    util.debugLog(`-- Start analyzing wallet ${walletAddress}`)
    const normalTxList = await contractHelper.fetchNormalTxByWallet(walletAddress)
    const normalTxByHash = this.groupRawNormalTxByHash(normalTxList)
    // util.writeTextToFile("normalTxList.json", util.jsonToString(normalTxList))
    const transferList = await contractHelper.fetchERC20TransfersByWallet(walletAddress)
    // util.writeTextToFile("erc20Transfers.json", JSON.stringify(transferList))
    const transferListGrouped = this.groupRawTransfersByTxHash(transferList)
    let txCount = 0
    for (let txHash in transferListGrouped) {
      txCount++
      let transferGroup = transferListGrouped[txHash]
      let swapInfo = await this.extractSwapInfoFromTx(transferGroup, normalTxByHash, walletAddress)
      // TODO: add txDollarValue, gasDollarValue based on dollar value of ETH at the current time stamp
      // Need to build a bot to scrape and store ETH price (open, close, low, high) for each minute, then build API for my own usage
      if (swapInfo.buy && swapInfo.sell) {
        util.debugLog(swapInfo)
      } else {
        util.debugLog(`  Skipped tx ${txHash}`)
      }

      // For debugging: Only analyze the first N tx
      if (txCount == 1) {
        break
      }
    }
  },

  extractSwapInfoFromTx: async function (transferGroup, normalTxByHash, walletAddress) {
    let swapInfo = {
      timeStamp: transferGroup[0].timeStamp,
      blockNumber: transferGroup[0].blockNumber,
      gasCost: BigInt(transferGroup[0].gasPrice) * BigInt(transferGroup[0].gasUsed),
    }
    const txHash = transferGroup[0].hash
    util.debugLog(`Analyzing ${txHash}`)
    if (transferGroup.length == 1) {
      // Only one ERC20 transfer, so this must either be:
      // 1) a swap where ETH is involved
      // 2) a token transfer (not swap)
      const normalTx = normalTxByHash[txHash]
      const transferERC20 = transferGroup[0]
      if (normalTx) {
        const swapInfoExtracted = await this.extractSwapInfoFromOneTransfer(transferERC20, normalTx, walletAddress)
        if (swapInfoExtracted.buy && swapInfoExtracted.sell) {
          swapInfo.buy = swapInfoExtracted.buy
          swapInfo.sell = swapInfoExtracted.sell
        }
      } else {
        util.debugLog(`Cannot handle this case: one transfer but not a normal tx, hash=${txHash}`)
      }
    } else {
      // When there are multiple transfers in one tx, this is likely a swap
      const tokenFlow = this.extractTokenFlowFromMultipleTransfers(transferGroup, walletAddress)
      const tokenKeys = Object.keys(tokenFlow)
      if (tokenKeys.length >= 3) {
        // There are 3 or more tokens, we can't handle this case yet
        throw new Error(`Three token transferred in one tx hash=${txHash}`)
      }
      // When there are 2 tokens, assume this is a swap
      for (let tokenAddress of tokenKeys) {
        let amount = tokenFlow[tokenAddress]
        if (amount > 0) {
          swapInfo.buy = {}
          swapInfo.buy.tokenAddress = tokenAddress
          swapInfo.buy.amount = amount
        } else {
          swapInfo.sell = {}
          swapInfo.sell.tokenAddress = tokenAddress
          swapInfo.sell.amount = amount * BigInt(-1)
        }
      }
    }
    return swapInfo
  },

  extractSwapInfoFromOneTransfer: async function (transferERC20, normalTx, walletAddress) {
    const ethTranferValue = BigInt(normalTx.value)
    const txHash = transferERC20.hash
    let swapInfo = {}
    if (contractHelper.isSameAddress(normalTx.from, walletAddress) && ethTranferValue > 0) {
      // If wallet is sending ETH out
      swapInfo.sell = {}
      swapInfo.sell.tokenAddress = tokenHelper.ETH_ADDRESS
      swapInfo.sell.amount = BigInt(normalTx.value)
      // Confirm if we're receiving an ERC20 token
      if (contractHelper.isSameAddress(transferERC20.to, walletAddress)) {
        swapInfo.buy = {}
        swapInfo.buy.tokenAddress = transferERC20.contractAddress
        swapInfo.buy.amount = BigInt(transferERC20.value)
      } else {
        util.debugLog(`Cannot handle this: sending ETH out and sending ERC20 out too, tx=${txHash}`)
      }
    } else if (contractHelper.isSameAddress(normalTx.from, walletAddress) && ethTranferValue == 0) {
      // If wallet this ERC20 transfer is initiated by wallet but there's no ETH transfer directly
      // We check internal tx to see if wallet is receiving ETH
      const internalTxList = await contractHelper.fetchInternalTxByTxHash(txHash)
      // util.writeTextToFile(`internalTxLog_${txHash}.json`, util.jsonToString(internalTxList))
      for (let internalTx of internalTxList) {
        if (contractHelper.isSameAddress(internalTx.to, walletAddress)) {
          // If internal tx is sending ETH to the wallet
          if (!swapInfo.buy) {
            swapInfo.buy = {}
            swapInfo.buy.tokenAddress = tokenHelper.ETH_ADDRESS
            swapInfo.buy.amount = BigInt(internalTx.value)
          } else {
            // Add up the ETH value received
            swapInfo.buy.amount += BigInt(internalTx.value)
          }
        }
      }
      // Confirm if we're sending an ERC20 token
      if (contractHelper.isSameAddress(transferERC20.from, walletAddress)) {
        swapInfo.sell = {}
        swapInfo.sell.tokenAddress = transferERC20.contractAddress
        swapInfo.sell.amount = BigInt(transferERC20.value)
      } else {
        util.debugLog(`Cannot handle this: receiving ETH and receiving ERC20 too, tx=${txHash}`)
      }
    }
    return swapInfo
  },

  extractTokenFlowFromMultipleTransfers: function (transferGroup, walletAddress) {
    // Group by token, then calculate total inflow/outflow for each token
    let tokenFlow = {}
    for (let transfer of transferGroup) {
      let direction = this.DIRECTION_BUY
      if (contractHelper.isSameAddress(transfer.from, walletAddress)) {
        direction = this.DIRECTION_SELL
      }
      // buy means +, sell means -
      tokenAddress = transfer.contractAddress
      let amount = ethers.parseUnits(transfer.value, parseInt(transfer.tokenDecimal))
      if (direction == this.DIRECTION_SELL) {
        amount = amount * BigInt(-1)
      }
      if (!tokenFlow[tokenAddress]) {
        tokenFlow[tokenAddress] = amount
      } else {
        tokenFlow[tokenAddress] += amount
      }
    }
    return tokenFlow
  },

  groupRawTransfersByTxHash: function (transferList) {
    let transferListGrouped = {}
    for (let transfer of transferList) {
      let txHash = transfer.hash
      if (!transferListGrouped[txHash]) {
        transferListGrouped[txHash] = []
      }
      transferListGrouped[txHash].push(transfer)
      // Btw, also cache token info here
      tokenHelper.addToCache(transfer.contractAddress, transfer.tokenSymbol, transfer.tokenName, transfer.tokenDecimal)
    }
    return transferListGrouped
  },

  groupRawNormalTxByHash: function (normalTxList) {
    let normalTxByHash = {}
    for (let normalTx of normalTxList) {
      let txHash = normalTx.hash
      normalTxByHash[txHash] = normalTx
    }
    return normalTxByHash
  },

  getTransferEventLogsFromTx: async function (txHash, mainWallet) {
    try {
      const tx = await this.provider.getTransaction(txHash)
      if (!tx) {
        throw new Error(`Tx not found ${txHash}`)
      }
      const mainContractAddress = tx.to
      const isToContract = await contractHelper.isContractAddress(mainContractAddress)
      if (!isToContract) {
        // util.debugLog(`The "To" Address ${mainContractAddress} is not a contract => This is a wallet transfer`)
        return
      }

      // const mainContractABI = await this.fetchContractABI(mainContractAddress)
      // if (mainContractABI) {
      // const mainIface = new Interface(mainContractABI)
      // const decodedInput = mainIface.parseTransaction({ data: tx.data, value: tx.value })

      const txReceipt = await this.provider.getTransactionReceipt(txHash)
      if (!txReceipt) {
        throw new Error(`Receipt not found for tx ${txHash}`)
      }

      var isWETHDepositFound = false
      var isWETHWithdrawalFound = false
      var logList = []
      util.debugLog(txReceipt.logs)
      for (const log of txReceipt.logs) {
        if (!(await contractHelper.isContractAddress(log.address))) {
          continue
        }

        const logContractABI = await contractHelper.fetchContractABI(log.address)
        if (!logContractABI) {
          continue
        }
        const logInterface = new Interface(logContractABI)
        const parsedLog = logInterface.parseLog(log)
        if (!parsedLog) {
          continue
        }

        if (contractHelper.isSameAddress(tokenHelper.WETH_ADDRESS, log.address)) {
          isWETHDepositFound = parsedLog.name == "Deposit"
          isWETHWithdrawalFound = parsedLog.name == "Withdrawal"
        }

        if (parsedLog.name === "Transfer") {
          // util.debugLog(`Parsed for ${log.address} - Index ${log.index}`)
          // util.debugLog(parsedLog)
          // If there are at least two ERC20 transfers, it's a buy/sell transaction

          const logContract = new ethers.Contract(log.address, logContractABI, this.provider)
          const tokenSymbol = await contractHelper.getTokenSymbol(logContract)
          // const tokenDecimals = await contractHelper.getTokenDecimals(logContract)
          var transferLogData = {
            logIndex: log.index,
            tokenAddress: log.address,
            tokenSymbol: tokenSymbol,
            from: parsedLog.args[0],
            to: parsedLog.args[1],
            // transferAmount: ethers.formatUnits(parsedLog.args[2], tokenDecimals),
            transferAmount: parsedLog.args[2],
          }
          if (contractHelper.isSameAddress(tokenHelper.WETH_ADDRESS, log.address)) {
            // If there's a WETH deposit (swapping ETH for WETH) and we're transferring WETH,
            // assume WETH is transferred from main wallet to keep the logs simple
            if (isWETHDepositFound) {
              transferLogData.from = mainWallet
            }
            if (isWETHWithdrawalFound) {
              transferLogData.to = mainWallet
            }
          } else logList.push(transferLogData)
        }
      }
      return logList
      // }
    } catch (error) {
      throw new Error("Error decoding transaction data: " + error.message)
    }
  },
}

module.exports = ERC20Transfer
