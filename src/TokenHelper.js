import axios from "axios"
import util from "./Utility.js"
import db from "../models/index.cjs"

const TokenHelper = {
  HONEYPOTIS_BASE_URL: "https://api.honeypot.is/v2/IsHoneypot",

  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH_ADDRESS: "0x0000000000000000000000000000000000000eth",
  DEAD_ADDRESS: "0x000000000000000000000000000000000000dead",
  NULL_ADDRESS: "0x0000000000000000000000000000000000000000",

  cachedToken: {},

  init: async function () {
    this.cachedToken[this.ETH_ADDRESS] = { address: this.ETH_ADDRESS, symbol: "ETH", name: "ETH", decimals: 18 }
    const tokenList = await db.Token.findAll({
      where: { chain: "eth" },
    })
    for (let token of tokenList) {
      await this.addToCache(token.address, token.symbol, token.name, token.decimals, false, token.isHoneyPot)
    }
  },

  addToCache: async function (address, symbol, name, decimals = 18, shouldSaveToDB = true, isHoneyPot = null) {
    address = address.toLowerCase()
    let token = this.cachedToken[address]
    if (!token) {
      token = {
        address,
        symbol,
        name,
        isHoneyPot,
      }
      this.cachedToken[address] = token
      // Also store in DB
      if (shouldSaveToDB) {
        await db.Token.findOrCreate({
          where: { address: address, chain: "eth" },
          defaults: { symbol, name, decimals, isHoneyPot },
        })
      }
    }
    return token
  },

  getFromCache: function (address) {
    return this.cachedToken[address]
  },

  checkHoneyPot: async function (address, chain = "eth") {
    let chainId = 1 // TODO: map chainId from chain string
    try {
      let params = {
        chainID: chainId,
        address,
      }
      const rawResponse = await axios.get(util.composeURL(this.HONEYPOTIS_BASE_URL, params))
      await util.sleep(50)
      if (rawResponse.data.honeypotResult) {
        const isHoneyPot = rawResponse.data.honeypotResult.isHoneypot ? 1 : 0
        let tokenFromCache = this.getFromCache(address)
        if (tokenFromCache) {
          const previousIsHoneyPot = tokenFromCache.isHoneyPot
          if (previousIsHoneyPot !== isHoneyPot) {
            let tokenFromDB = await db.Token.findOne({
              where: { address: address, chain: "eth" },
            })
            // Update DB
            if (tokenFromDB) {
              tokenFromDB.isHoneyPot = isHoneyPot
              await tokenFromDB.save()
            }
            // Update cache
            tokenFromCache.isHoneyPot = isHoneyPot
            this.cachedToken[address] = tokenFromCache
          }
        }
      }
    } catch (error) {
      throw new Error(`Error checking HoneyPot for ${address}` + error.message)
    }
  },
}

export default TokenHelper
