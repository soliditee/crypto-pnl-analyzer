import { parse } from "dotenv"
import ch from "./ContractHelper.js"
import tokenHelper from "./TokenHelper.js"
import priceHelper from "./PriceHelper.js"
import util from "./Utility.js"
import walletManager from "./WalletManager.js"
import { ethers } from "ethers"
import csvWriter from "csv-writer"
await tokenHelper.init()

const ProfitAndLoss = {
  analyzeProfitAndLoss: async function (ownerAddress) {
    const owner = await walletManager.findOwner(ownerAddress)
    if (!owner) {
      util.debugLog(`Owner address not found ${ownerAddress}`)
    }
    // For now, we can only get transaction values when ETH is invovled
    const isETHInvolved = true
    const swapList = await walletManager.getSwapList(owner, isETHInvolved)
    const swapsGrouped = this.groupSwapsByCA(swapList)
    let pnlGrouped = {}
    let tokensHolding = {}
    let tokensHoldingNotHoneyPot = {}
    let countToken = 0
    for (let ca of Object.keys(swapsGrouped)) {
      // if (ca != "0x43d7e65b8ff49698d9550a7f315c87e67344fb59") {
      //   continue
      // }
      countToken++
      let token = tokenHelper.getFromCache(ca)
      console.log(`Pnl for token ${token.symbol} - ${ca}`)
      if (token.isHoneyPot === null) {
        await tokenHelper.checkHoneyPot(ca)
      }
      let pnlInfo = this.calculatePnlOneToken(swapsGrouped[ca])
      pnlInfo.ca = ca
      pnlInfo.symbol = token.symbol
      pnlInfo.isHoneyPot = token.isHoneyPot
      let isBalanceGreaterThan0 = pnlInfo.currentBalance18 > 0n && !pnlInfo.isDustBalance
      pnlGrouped[ca] = pnlInfo
      if (isBalanceGreaterThan0) {
        tokensHolding[ca] = pnlInfo
        if (token.isHoneyPot !== 1) {
          tokensHoldingNotHoneyPot[ca] = pnlInfo
        }
      }
      // console.log(pnlInfo)
      if (countToken >= 2) {
        // break
      }
    }
    // Run another loop to calculate current value if we're still holding (balance > 0)
    let tokenPriceList = await priceHelper.getLatestPriceMultipleTokens(Object.keys(tokensHoldingNotHoneyPot))
    let currentETHPriceUSD = await priceHelper.getETHPriceInUSD(Math.floor(Date.now() / 1000))
    for (let ca of Object.keys(pnlGrouped)) {
      let pnlInfo = pnlGrouped[ca]
      if (tokensHolding[ca]) {
        let priceUSD18 = 0n
        if (tokensHoldingNotHoneyPot[ca] && tokenPriceList[ca]) {
          let tokenPriceInfo = tokenPriceList[ca]
          priceUSD18 = tokenPriceInfo.priceUSD18
          if (tokenPriceInfo.isReserveMissing) {
            pnlInfo.isHoneyPot = 1
          }
        }
        let unrealizedPnl18 = (priceUSD18 * pnlInfo.currentBalance18) / util.BIG_1018 - pnlInfo.currentBalanceUSDCost18
        pnlInfo.unrealizedPnlUSD18 = unrealizedPnl18
        pnlInfo.unrealizedPnlETH18 = (pnlInfo.unrealizedPnlUSD18 * 100n) / BigInt(currentETHPriceUSD * 100)
      }

      // Calculate user-friendly fields
      pnlInfo = this.populateUserFriendlyFields(pnlInfo)
    }
    await this.exportPnlToCSV(pnlGrouped, ownerAddress)
  },

  populateUserFriendlyFields: function (pnlInfo) {
    let isBalanceGreaterThan0 = pnlInfo.currentBalance18 > 0n && !pnlInfo.isDustBalance
    // Calculate user-friendly fields
    pnlInfo.pnlUSD = parseFloat(ethers.formatEther(pnlInfo.totalPnLUSD18)).toFixed(2)
    pnlInfo.pnlETH = ethers.formatEther(pnlInfo.totalPnLETH18)
    pnlInfo.balance = !isBalanceGreaterThan0 ? 0 : ethers.formatEther(pnlInfo.currentBalance18)
    pnlInfo.maxBalance = pnlInfo.maxBalance18 <= 0n ? 0 : ethers.formatEther(pnlInfo.maxBalance18)
    pnlInfo.balancePercentage = pnlInfo.maxBalance <= 0 || pnlInfo.isDustBalance ? 0 : (parseFloat(pnlInfo.balance) / parseFloat(pnlInfo.maxBalance)) * 100
    pnlInfo.date = new Date(Number(pnlInfo.maxSellTimestamp * 1000n)).toISOString()
    pnlInfo.balanceCostBasisUSD = pnlInfo.balance <= 0 ? 0 : parseFloat(ethers.formatEther(pnlInfo.currentBalanceUSDCost18)).toFixed(2)
    pnlInfo.balanceCostBasisETH = pnlInfo.balance <= 0 ? 0 : ethers.formatEther(pnlInfo.currentBalanceETHCost18)
    pnlInfo.unrealizedPnlUSD = pnlInfo.unrealizedPnlUSD18 ? parseFloat(ethers.formatEther(pnlInfo.unrealizedPnlUSD18)).toFixed(2) : 0
    pnlInfo.unrealizedPnlETH = pnlInfo.unrealizedPnlETH18 ? ethers.formatEther(pnlInfo.unrealizedPnlETH18) : 0
    pnlInfo.isHoneyPotText = pnlInfo.isHoneyPot === 1 ? "Yes" : "No"
    return pnlInfo
  },

  exportPnlToCSV: async function (pnlGrouped, ownerAddress) {
    const writer = csvWriter.createObjectCsvWriter({
      path: `./logs/pnl_${ownerAddress}.csv`,
      header: [
        { id: "date", title: "Date" },
        { id: "symbol", title: "Token" },
        { id: "ca", title: "CA" },
        { id: "pnlUSD", title: "PnL USD" },
        { id: "pnlETH", title: "PnL ETH" },
        { id: "balance", title: "Balance" },
        { id: "balancePercentage", title: "Balance %" },
        { id: "balanceCostBasisUSD", title: "Balance Cost USD" },
        { id: "unrealizedPnlUSD", title: "Unrealized PnL USD" },
        { id: "unrealizedPnlETH", title: "Unrealized Pnl ETH" },
        { id: "isHoneyPotText", title: "HoneyPot" },
      ],
    })
    await writer.writeRecords(Object.values(pnlGrouped))
  },

  determineUnrealizedPnLOneToken: function (pnlInfo, token) {
    let currentPriceUSD18 = 0
    let currentPriceETH18 = 0
    if (!token.isHoneyPot) {
    }
  },

  calculatePnlOneToken: function (tokenSwapList) {
    let costBasisQueue = []
    let totalPnLUSD18 = 0n
    let totalPnLETH18 = 0n
    let currentBalance18 = 0n
    let currentBalanceUSDCost18 = 0n
    let currentBalanceETHCost18 = 0n
    let maxBalance18 = 0n
    let maxSellTimestamp = 0n
    let previousPnlUSD18 = 0n
    for (let swap of tokenSwapList) {
      previousPnlUSD18 = totalPnLUSD18
      if (ch.isETHorWETH(swap.sellCA)) {
        // This is a buy tx, add to queue
        // Another way to calculate per unit price in ETH: ([Total ETH sent out] + [Total Gas Cost]) / [amount received]
        // let priceETH18 = ((BigInt(swap.sellAmount) + BigInt(swap.gasCostWei)) * util.BIG_1018) / BigInt(swap.buyAmount)
        let priceETH18 = (BigInt(swap.buyPriceUSD18) * BigInt(100)) / BigInt(swap.ethPriceUSD * 100)
        let costBasis = {
          amount18: BigInt(swap.buyAmount),
          priceUSD18: BigInt(swap.buyPriceUSD18),
          priceETH18,
        }
        currentBalance18 += costBasis.amount18
        if (maxBalance18 < currentBalance18) {
          maxBalance18 = currentBalance18
        }
        costBasisQueue.push(costBasis)
      } else if (ch.isETHorWETH(swap.buyCA)) {
        // This is a sell tx, which will offset the queue
        let sellAmount18 = BigInt(swap.sellAmount)
        let sellTimestamp = BigInt(swap.timestamp)
        if (maxSellTimestamp < sellTimestamp) {
          maxSellTimestamp = sellTimestamp
        }
        currentBalance18 -= sellAmount18
        let sellPriceUSD18 = BigInt(swap.sellPriceUSD18)
        while (costBasisQueue.length > 0 && sellAmount18 > 0n) {
          let costBasis = costBasisQueue[0]
          if (costBasis.amount18 >= sellAmount18) {
            totalPnLUSD18 += (sellAmount18 * (sellPriceUSD18 - costBasis.priceUSD18)) / util.BIG_1018
            costBasisQueue[0].amount18 -= sellAmount18
            sellAmount18 = 0n
          } else {
            // If we are selling more than the amount in the first costbasis entry
            totalPnLUSD18 += (costBasis.amount18 * (sellPriceUSD18 - costBasis.priceUSD18)) / util.BIG_1018
            sellAmount18 -= costBasis.amount18
            costBasisQueue.shift()
          }
        }
        if (sellAmount18 > 0n) {
          // We have more tokens for selling then we've bought earlier, assume the cost basis is 0
          totalPnLUSD18 += (sellAmount18 * sellPriceUSD18) / util.BIG_1018
        }
        totalPnLETH18 += ((totalPnLUSD18 - previousPnlUSD18) * BigInt(100)) / BigInt(swap.ethPriceUSD * 100)
      }
    }
    if (currentBalance18 > 0n) {
      for (let costBasis of costBasisQueue) {
        currentBalanceUSDCost18 += (costBasis.amount18 * costBasis.priceUSD18) / util.BIG_1018
        currentBalanceETHCost18 += (costBasis.amount18 * costBasis.priceETH18) / util.BIG_1018
      }
    }
    return {
      maxSellTimestamp,
      totalPnLUSD18,
      totalPnLETH18,
      currentBalance18,
      maxBalance18,
      isDustBalance: maxBalance18 / 1000n > util.absBigInt(currentBalance18), // Dust if there's only 0.1% of the max balance
      currentBalanceUSDCost18,
      currentBalanceETHCost18,
    }
  },

  groupSwapsByCA: function (swapList) {
    let swapsGrouped = {}
    for (let swap of swapList) {
      let ca = null
      if (ch.isETHorWETH(swap.buyCA)) {
        ca = swap.sellCA
      } else if (ch.isETHorWETH(swap.sellCA)) {
        ca = swap.buyCA
      }
      if (ca) {
        if (!swapsGrouped[ca]) {
          swapsGrouped[ca] = []
        }
        swapsGrouped[ca].push(swap)
      }
    }
    return swapsGrouped
  },
}

export default ProfitAndLoss
