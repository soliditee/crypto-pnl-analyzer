import db from "../models/index.cjs"

const TokenHelper = {
  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH_ADDRESS: "0x0000000000000000000000000000000000000eth",
  DEAD_ADDRESS: "0x000000000000000000000000000000000000dead",
  NULL_ADDRESS: "0x0000000000000000000000000000000000000000",

  cachedToken: {},

  init: function () {
    this.cachedToken[this.ETH_ADDRESS] = { address: this.ETH_ADDRESS, symbol: "ETH", name: "ETH" }
  },

  addToCache: async function (address, symbol, name) {
    let token = this.cachedToken[address]
    if (!token) {
      token = {
        address,
        symbol,
        name,
      }
      this.cachedToken[address] = token
      // Also store in DB
      await db.Token.findOrCreate({
        where: { address: address },
        defaults: { symbol, name },
      })
    }
    return token
  },

  getFromCache: function (address) {
    return this.cachedToken[address]
  },
}

export default TokenHelper
