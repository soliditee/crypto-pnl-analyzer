const axios = require("axios")
const util = require("./Utility")
const { ethers, Interface } = require("ethers")
const { parse } = require("dotenv")

const ContractHelper = {
  ETHERSCAN_BASE_URL: "https://api.etherscan.io/api",
  ETHER_MAX_BLOCK: "27025780",
  provider: new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  cachedABI: {},
  cachedSymbol: {},
  cachedDecimals: {},

  getEtherscanAPIKey: function () {
    return process.env.ETHERSCAN_API_KEY
  },

  isContractAddress: async function (address) {
    try {
      const code = await this.provider.getCode(address)
      return code !== "0x" && code !== "0x0"
    } catch (error) {
      throw new Error("Error checking contract address: " + error.message)
    }
  },

  fetchContractABI: async function (address) {
    if (this.cachedABI[address]) {
      return this.cachedABI[address]
    } else {
      var params = {
        module: "contract",
        action: "getabi",
        address: address,
        apikey: this.getEtherscanAPIKey(),
      }
      try {
        const contractAbiResponse = await axios.get(util.composeURL(this.ETHERSCAN_BASE_URL, params))
        const contractAbi = JSON.parse(contractAbiResponse.data.result)
        if (contractAbi) {
          this.cachedABI[address] = contractAbi
        }
        return contractAbi
      } catch (error) {
        throw new Error(`Error fetching contract ABI for ${address}` + error.message)
      }
    }
  },

  fetchERC20TransfersByWallet: async function (walletAddress) {
    const txPerPage = 1000 // Number of transactions per page
    var page = 1
    var params = {
      module: "account",
      action: "tokentx",
      address: walletAddress,
      page: page,
      offset: txPerPage,
      // startblock: process.env.START_BLOCK,
      startblock: 18047290,
      endblock: this.ETHER_MAX_BLOCK,
      sort: "asc",
      apikey: this.getEtherscanAPIKey(),
    }
    const url = util.composeURL(this.ETHERSCAN_BASE_URL, params)
    try {
      const response = await axios.get(url)
      return response.data.result
    } catch (error) {
      throw new Error(`Error fetching contract ABI for ${walletAddress}: ` + error.message)
    }
  },

  fetchNormalTxByWallet: async function (walletAddress) {
    const txPerPage = 1000 // Number of transactions per page, use 1000 for testing but we should increase to 10,000 (max allowed is 10,000)
    var page = 1
    var params = {
      module: "account",
      action: "txlist",
      address: walletAddress,
      page: page,
      offset: txPerPage,
      startblock: process.env.START_BLOCK,
      endblock: this.ETHER_MAX_BLOCK,
      sort: "asc",
      apikey: this.getEtherscanAPIKey(),
    }
    const url = util.composeURL(this.ETHERSCAN_BASE_URL, params)
    try {
      const response = await axios.get(url)
      return response.data.result
    } catch (error) {
      throw new Error(`Error fetching normal tx for wallet ${walletAddress}: ` + error.message)
    }
  },

  fetchInternalTxByTxHash: async function (inputTxHash) {
    var params = {
      module: "account",
      action: "txlistinternal",
      txhash: inputTxHash,
      apikey: this.getEtherscanAPIKey(),
    }
    const url = util.composeURL(this.ETHERSCAN_BASE_URL, params)
    try {
      const response = await axios.get(url)
      return response.data.result
    } catch (error) {
      throw new Error(`Error fetching Internal Tx for txHash ${inputTxHash}: ` + error.message)
    }
  },

  getTokenSymbol: async function (contract) {
    const address = await contract.getAddress()
    if (this.cachedSymbol[address]) {
      return this.cachedSymbol[address]
    } else {
      const tokenSymbol = await contract.symbol()
      this.cachedSymbol[address] = tokenSymbol
      return tokenSymbol
    }
  },

  getTokenDecimals: async function (contract) {
    const address = await contract.getAddress()
    if (this.cachedDecimals[address]) {
      return this.cachedDecimals[address]
    } else {
      const tokenDecimals = await contract.decimals()
      this.cachedDecimals[address] = tokenDecimals
      return tokenDecimals
    }
  },

  getBlockNumberByTimestamp: async function (timestampInSeconds) {
    const url = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestampInSeconds}&closest=before&apikey=${this.getEtherscanAPIKey()}`
    const response = await axios.get(url)
    if (response.data.message == "OK") {
      return parseInt(response.data.result)
    } else {
      throw new Error(`Fail to getBlockNumberByTimestamp for the given input ${timestampInSeconds}`)
    }
  },

  isSameAddress: function (addressA, addressB) {
    const lowercaseAddress1 = addressA.toLowerCase()
    const lowercaseAddress2 = addressB.toLowerCase()

    return lowercaseAddress1 === lowercaseAddress2
  },
}

module.exports = ContractHelper
