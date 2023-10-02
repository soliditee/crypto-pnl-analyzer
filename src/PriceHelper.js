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
      let start = timestampInSeconds - 60n * 60n // Minus 1 hour from the start time, so that we have more data in cache
      const end = timestampInSeconds

      const isoStart = new Date(Number(start * 1000n)).toISOString()
      const isoEnd = new Date(Number(end * 1000n)).toISOString()
      const coinbaseApiUrl = `https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=${period.toString()}&start=${isoStart}&end=${isoEnd}`

      // Sleep a bit to avoid reaching API limit per second
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
      const config = {
        headers: {
          Accept: "application/json;version=20230302",
        },
      }
      let tokenPriceList = {}
      const chunkSize = 30
      for (let i = 0; i < tokenList.length; i += chunkSize) {
        const chunkTokenList = tokenList.slice(i, i + chunkSize)
        let fullURL = baseURL + chunkTokenList.join(",")
        const rawResponse = await axios.get(fullURL, config)
        await util.sleep(200)
        if (rawResponse.data.data) {
          for (let rawPrice of rawResponse.data.data) {
            let priceUSD18 = rawPrice.attributes.price_usd ? ethers.parseEther(rawPrice.attributes.price_usd) : 0n
            let ca = rawPrice.attributes.address.toLowerCase()
            let totalReserveUSD = parseFloat(rawPrice.attributes.total_reserve_in_usd)
            let priceInfo = {
              priceUSD18,
              isReserveMissing: totalReserveUSD < 300 ? true : false,
            }
            tokenPriceList[ca] = priceInfo
          }
        }
      }
      return tokenPriceList
    } catch (error) {
      throw new Error(`Error fetching latest price for multiple tokens: ` + error.message)
    }
  },
}

export default PriceHelper
