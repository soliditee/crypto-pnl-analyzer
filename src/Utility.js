const fs = require("fs")

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
}

module.exports = Utility
