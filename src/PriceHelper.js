import axios from "axios"
import { Op } from "sequelize"
import db from "../models/index.cjs"
import util from "./Utility.js"
import { ethers } from "ethers"

const PriceHelper = {
  /**
   * @param {Array} responseData
   * @param {BigInt} period
   */
  saveETHPriceToDB: async function (responseData, period) {
    for (const priceData of responseData) {
      let closePrice = parseFloat(priceData[4])
      let fromTimestamp = BigInt(priceData[0])
      let toTimestamp = fromTimestamp + period
      await db.PriceInUSD.findOrCreate({
        where: { symbol: "ETH", from: fromTimestamp, to: toTimestamp },
        defaults: { price: closePrice },
      })
    }
  },

  /**
   * Find ETH price in USD at the given timestamp in DB
   * @param {BigInt} timestampInSeconds
   * @returns
   */
  findETHPriceInDB: async function (timestampInSeconds) {
    const row = await db.PriceInUSD.findOne({
      where: {
        symbol: "ETH",
        from: { [Op.lte]: timestampInSeconds },
        to: { [Op.gte]: timestampInSeconds },
      },
    })
    if (row) {
      return row.price
    } else {
      return null // Return null if no matching row is found
    }
  },

  /**
   * Return ETH price in USD at the given timestamp in DB
   * Also save in DB for later usages
   * @param {BigInt} timestampInSeconds
   * @returns
   */
  getETHPriceInUSD: async function (timestampInSeconds) {
    try {
      timestampInSeconds = BigInt(timestampInSeconds)
      const priceFromDB = await this.findETHPriceInDB(timestampInSeconds)
      if (priceFromDB) {
        return parseFloat(priceFromDB)
      }

      const period = 60n // The period in seconds for the candlestick data {60, 300, 900, 3600, 21600, 86400}
      let start = timestampInSeconds - period
      const end = timestampInSeconds

      if (util.absBigInt(BigInt(Math.floor(Date.now() / 1000)) - timestampInSeconds) < 5n) {
        // If within 5s from current time, extend the start range to make sure we get the latest candle
        start = start - period - 15n
      }

      const isoStart = new Date(Number(start * 1000n)).toISOString()
      const isoEnd = new Date(Number(end * 1000n)).toISOString()
      const coinbaseApiUrl = `https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=${period}&start=${isoStart}&end=${isoEnd}`

      // Sleep a bit to avoid reaching API limit
      await util.sleep(100)
      const response = await axios.get(coinbaseApiUrl)

      if (Array.isArray(response.data) && response.data.length > 0) {
        // The 'close' price is located at index 4 within the first element of the response array
        const closePrice = parseFloat(response.data[0][4])
        await this.saveETHPriceToDB(response.data, period)
        return closePrice
      } else {
        throw new Error(`No data found for the given input ${timestampInSeconds} - URL = ${coinbaseApiUrl}.`)
      }
    } catch (error) {
      throw new Error("Error fetching ETH price from Coinbase API: " + error.message)
    }
  },

  getLatestPriceMultipleTokens: async function (tokenList, chain = "eth") {
    try {
      const baseURL = `https://api.geckoterminal.com/api/v2/networks/${chain}/tokens/multi/`
      let fullURL = baseURL + tokenList.join(",")
      const config = {
        headers: {
          Accept: "application/json;version=20230302",
        },
      }
      let tokenPriceList = {}
      const rawResponse = await axios.get(fullURL, config)
      await util.sleep(50)
      if (rawResponse.data.data) {
        for (let rawPrice of rawResponse.data.data) {
          let priceUSD18 = rawPrice.attributes.price_usd ? ethers.parseEther(rawPrice.attributes.price_usd) : 0n
          let ca = rawPrice.attributes.address.toLowerCase()
          let totalReserveUSD = parseFloat(rawPrice.attributes.total_reserve_in_usd)
          let priceInfo = {
            priceUSD18,
            isReserveMissing: totalReserveUSD < 10 ? true : false,
          }
          tokenPriceList[ca] = priceInfo
        }
      }
      return tokenPriceList
    } catch (error) {
      throw new Error(`Error fetching latest price for multiple tokens: ` + error.message)
    }
  },
}

export default PriceHelper
