import fs from "fs"

const Utility = {
  debugLog: function (message) {
    console.log(message)
  },

  composeURL: function (baseURL, params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")

    return `${baseURL}?${queryString}`
  },

  writeTextToFile: function (filePath, content) {
    fs.writeFileSync(filePath, content)
  },

  jsonToString: function (jsonObject) {
    return JSON.stringify(jsonObject, (key, value) => (typeof value === "bigint" ? value.toString() + "n" : value))
  },

  sleep: function (miliseconds) {
    return new Promise((resolve) => setTimeout(resolve, miliseconds))
  },

  convertTo18Decimals: function (inputAmount, inputDecimals) {
    // Calculate the conversion factor to adjust to 18 decimals
    const conversionFactor = BigInt(10) ** BigInt(18 - inputDecimals)
    // Convert the amount to 18 decimals
    const amount = inputAmount * conversionFactor
    return { amount, decimals: 18 }
  },
}

export default Utility
