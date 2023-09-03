const TokenHelper = {
  WETH_ADDRESS: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH_ADDRESS: "0x0000000000000000000000000000000000000eth",

  cachedToken: {
    address: this.ETH_ADDRESS,
    symbol: "ETH",
    name: "ETH",
    decimal: 18,
  },

  addToCache: function (address, symbol, name, decimal) {
    let token = this.cachedToken[address]
    if (!token) {
      token = {
        address,
        symbol,
        name,
        decimal,
      }
      this.cachedToken[address] = token
    }
    return token
  },

  getFromCache: function (address) {
    return this.cachedToken[address]
  },
}

module.exports = TokenHelper
