import axios from "axios"
import { Op } from "sequelize"
import db from "../models/index.cjs"

const PriceHelper = {
  saveETHPriceToDB: async function (responseData, period) {
    for (const priceData of responseData) {
      closePrice = priceData[4]
      fromTimestamp = priceData[0]
      toTimestamp = fromTimestamp + period
      await db.PriceInUSD.findOrCreate({
        where: { symbol: "ETH", from: fromTimestamp, to: toTimestamp },
        defaults: { price: closePrice },
      })
    }
  },

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

  getETHPriceInUSD: async function (timestampInSeconds) {
    try {
      const priceFromDB = await this.findETHPriceInDB(timestampInSeconds)
      if (priceFromDB) {
        return priceFromDB
      }

      const period = 60 // The period in seconds for the candlestick data {60, 300, 900, 3600, 21600, 86400}
      var start = timestampInSeconds - period / 2
      const end = timestampInSeconds + period / 2

      if (Math.abs(Date.now() / 1000 - timestampInSeconds) < 5) {
        // If within 5s from current time, extend the start range to make sure we get the latest candle
        start = start - period / 2 - 15
      }

      const isoStart = new Date(start * 1000).toISOString()
      const isoEnd = new Date(end * 1000).toISOString()
      const coinbaseApiUrl = `https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=${period}&start=${isoStart}&end=${isoEnd}`

      const response = await axios.get(coinbaseApiUrl)

      if (Array.isArray(response.data) && response.data.length > 0) {
        // The 'close' price is located at index 4 within the first element of the response array
        const closePrice = response.data[0][4]
        await this.saveETHPriceToDB(response.data, period)
        return closePrice
      } else {
        throw new Error(`No data found for the given input ${timestampInSeconds} - URL = ${coinbaseApiUrl}.`)
      }
    } catch (error) {
      throw new Error("Error fetching ETH price from Coinbase API: " + error.message)
    }
  },
}

export default PriceHelper
