import axios from "axios"
import util from "./Utility.js"
import db from "../models/index.cjs"

const TokenHelper = {
  HONEYPOT_BASE_URL: "https://api.honeypot.is/v2/IsHoneypot",

  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH_ADDRESS: "0x0000000000000000000000000000000000000eth",
  DEAD_ADDRESS: "0x000000000000000000000000000000000000dead",
  NULL_ADDRESS: "0x0000000000000000000000000000000000000000",

  cachedToken: {},

  init: async function () {
    const ethToken = await db.Token.findOrCreate({
      where: { address: this.ETH_ADDRESS, chain: "eth" },
      defaults: { symbol: "ETH", name: "ETH", decimals: 18, isHoneyPot: 0 },
    })
    const tokenList = await db.Token.findAll({
      where: { chain: "eth" },
    })
    for (let token of tokenList) {
      this.cachedToken[token.address] = token
    }
  },

  addToCache: async function (address, symbol, name, decimals = 18, isHoneyPot = null) {
    address = address.toLowerCase()
    let token = this.cachedToken[address]
    if (!token) {
      token = await db.Token.findOrCreate({
        where: { address: address, chain: "eth" },
        defaults: { symbol, name, decimals, isHoneyPot },
      })
      this.cachedToken[address] = token
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
      const rawResponse = await axios.get(util.composeURL(this.HONEYPOT_BASE_URL, params))
      await util.sleep(50)
      if (rawResponse.data.honeypotResult) {
        const isHoneyPot = rawResponse.data.honeypotResult.isHoneypot ? 1 : 0
        let tokenFromCache = this.getFromCache(address)
        if (tokenFromCache) {
          const previousIsHoneyPot = tokenFromCache.isHoneyPot
          if (previousIsHoneyPot !== isHoneyPot) {
            let tokenFromDB = this.getFromCache(address)
            // Update DB
            tokenFromDB.isHoneyPot = isHoneyPot
            await tokenFromDB.save()
            // Update cache
            this.cachedToken[address] = tokenFromDB
          }
        }
      }
    } catch (error) {
      console.log(`Error checking HoneyPot for ${address} - ` + error.message)
      if (error.response.status == 404) {
        const isHoneyPot = 1
        let tokenFromDB = this.getFromCache(address)
        // Update DB
        tokenFromDB.isHoneyPot = isHoneyPot
        await tokenFromDB.save()
        // Update cache
        this.cachedToken[address] = tokenFromDB
      }
    }
  },
}

export default TokenHelper
