import { parse } from "dotenv"
import contractHelper from "./ContractHelper.js"
import tokenHelper from "./TokenHelper.js"
import util from "./Utility.js"
tokenHelper.init()

const ERC20TransferAlchemy = {
  // ["external", "internal", "erc20"]
  CATEGORY_EXTERNAL: "external",
  CATEGORY_INTERNAL: "internal",
  CATEGORY_ERC20: "erc20",

  analyzeERC20Transfers: async function (walletAddress) {
    util.debugLog(`-- Start analyzing wallet ${walletAddress}`)
    const rawTxList = await contractHelper.fetchTransferTxByAddress(walletAddress, [this.CATEGORY_ERC20, this.CATEGORY_EXTERNAL, this.CATEGORY_INTERNAL])
    const txGrouped = this.groupAllTransfersByTxHash(rawTxList)
    // util.writeTextToFile(`./logs/txGrouped.json`, util.jsonToString(txGrouped))
    const swapInfoList = this.extractSwapInfoFromTxGrouped(txGrouped)
    util.writeTextToFile(`./logs/swapInfoList.json`, util.jsonToString(swapInfoList))
  },

  extractSwapInfoFromTxGrouped: function (txGrouped) {
    let swapInfoList = {}
    let keyList = Object.keys(txGrouped)
    for (let txHash of keyList) {
      let txFromList = txGrouped[txHash].from
      let txToList = txGrouped[txHash].to
      let sellList = this.extractTransferInfoFromOneTxDirection(txFromList)
      let buyList = this.extractTransferInfoFromOneTxDirection(txToList)
      let transferCount = buyList.length + sellList.length
      if (buyList.length > 0 && sellList.length > 0 && transferCount == 2) {
        if (!buyList[0]) {
          util.debugLog(`Error with tx  ${txHash}`)
        }
        let swapInfo = {
          buy: buyList[0],
          sell: sellList[0],
          blockNum: parseInt(buyList[0].blockNum, 16),
        }
        swapInfoList[txHash] = swapInfo
      } else if (transferCount == 1) {
        // This is a regular transfer
      } else {
        // More than 3 transfers in one tx, need to investigate
        util.debugLog(`!! There are 3 or more tranfers in tx ${txHash}`)
      }
    }
    return swapInfoList
  },

  extractTransferInfoFromOneTxDirection: function (txDirectionList) {
    let returnList = []
    for (let category of [this.CATEGORY_ERC20, this.CATEGORY_EXTERNAL, this.CATEGORY_INTERNAL]) {
      let transferList = txDirectionList[category]
      if (!transferList) {
        continue
      }
      for (let transfer of transferList) {
        let amount = BigInt(transfer.rawContract.value)
        let decimals = parseInt(transfer.rawContract.decimal, 16)
        let address = category == this.CATEGORY_ERC20 ? transfer.rawContract.address : tokenHelper.ETH_ADDRESS
        returnList.push({
          amount,
          decimals,
          address,
        })
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
