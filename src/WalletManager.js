import { where } from "sequelize"
import db from "../models/index.cjs"

const WalletManager = {
  findOrCreateWallet: async function (address) {
    const existingWallet = await db.Wallet.findOne({
      where: {
        address: address,
      },
    })
    if (!existingWallet) {
      const [owner, created] = await db.Owner.findOrCreate({
        where: { address: address },
      })
      const wallet = await db.Wallet.create({
        address,
        ownerId: owner.id,
      })
      return wallet
    } else {
      // const owner = await existingWallet.getOwner()
      return existingWallet
    }
  },

  findOwner: async function (address) {
    const owner = await db.Owner.findOne({
      where: {
        address: address,
      },
    })
    return owner
  },

  saveSwapInfo: async function (txHash, swapInfo, wallet) {
    const owner = await wallet.getOwner()
    await db.Swap.findOrCreate({
      where: { chain: "eth", ownerId: owner.id, walletId: wallet.id, txnHash: txHash },
      defaults: {
        blockNum: swapInfo.blockNum,
        timestamp: swapInfo.timestamp,
        isETHInvolved: swapInfo.isETHInvolved,
        gasCostWei: swapInfo.gasCost,
        gasCostUSD: swapInfo.gasCostUSD,
        ethPriceUSD: swapInfo.ethPriceUSD,
        txnValueUSD: swapInfo.txnValueUSD,
        buyAmount: swapInfo.buy.amount,
        buyCA: swapInfo.buy.address,
        sellAmount: swapInfo.sell.amount,
        sellCA: swapInfo.sell.address,
        buyPriceUSD18: swapInfo.buyPriceUSD18,
        sellPriceUSD18: swapInfo.sellPriceUSD18,
      },
    })
  },

  getSwapList: async function (owner, isETHInvolved = true) {
    let whereObj = { chain: "eth", ownerId: owner.id }
    if (isETHInvolved !== null) {
      whereObj.isETHInvolved = isETHInvolved
    }
    const swapList = db.Swap.findAll({
      where: whereObj,
      order: [["blockNum", "ASC"]],
    })
    return swapList
  },
}

export default WalletManager
