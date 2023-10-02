import { parse } from "dotenv"
import axios from "axios"
import util from "./Utility.js"
import { ethers } from "ethers"
import { Alchemy, Network } from "alchemy-sdk"
import tokenHelper from "./TokenHelper.js"

const ContractHelper = {
  ETHERSCAN_BASE_URL: "https://api.etherscan.io/api",
  ETHER_MAX_BLOCK: "27025780",
  provider: new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  alchemyConfig: {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  },
  // Caching to speed up API calls
  cachedABI: {},
  cachedSymbol: {},
  cachedDecimals: {},

  getEtherscanAPIKey: function () {
    return process.env.ETHERSCAN_API_KEY
  },

  isContractAddress: async function (address) {
    try {
      return await this.alchemy.core.isContractAddress(address)
    } catch (error) {
      throw new Error("Error checking contract address: " + error.message)
    }
  },

  /**
   * Return lists of external, internal and erc20 transfers from/to the given address
   * @param {string} address
   * @returns {Object}
   */
  fetchTransferTxByAddress: async function (address, categories = ["external"]) {
    try {
      let settings = {
        fromBlock: "0x" + Number(process.env.START_BLOCK).toString(16),
        toBlock: "latest",
        toAddress: address,
        withMetadata: false,
        excludeZeroValue: true,
        maxCount: "0x3e8", // 1000
        category: categories,
        order: "asc",
      }

      let txList = {}
      txList.transfersTo = await this.getTransfersFromAlchemy(settings)
      // Switch to filter by fromAddress
      delete settings.toAddress
      settings["fromAddress"] = address
      txList.transfersFrom = await this.getTransfersFromAlchemy(settings)

      return txList
    } catch (error) {
      throw new Error(`Error fetching internal tx for ${address} - ` + error.message)
    }
  },

  getTransfersFromAlchemy: async function (settings) {
    try {
      let pageKey = undefined
      let transferList = []
      const alchemy = new Alchemy(this.alchemyConfig)
      do {
        if (pageKey) {
          settings.pageKey = pageKey
          pageKey = undefined
        } else {
          delete settings.pageKey
        }
        const jsonResult = await alchemy.core.getAssetTransfers(settings)
        if (jsonResult.pageKey) {
          pageKey = jsonResult.pageKey
        }
        if (jsonResult.transfers) {
          transferList.push(...jsonResult.transfers)
        }
        if (pageKey) {
          util.sleep(50)
        }
      } while (pageKey)
      return transferList
    } catch (error) {
      throw new Error(`Error fetching Transers ${util.jsonToString(settings)} - ` + error.message)
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

  fetchERC20TransfersByWalletEtherScan: async function (walletAddress) {
    const txPerPage = 1000 // Number of transactions per page
    var page = 1
    var params = {
      module: "account",
      action: "tokentx",
      address: walletAddress,
      page: page,
      offset: txPerPage,
      startblock: process.env.START_BLOCK,
      endblock: this.ETHER_MAX_BLOCK,
      sort: "asc",
      apikey: this.getEtherscanAPIKey(),
    }
    try {
      let resultCount = 0
      let resultList = []
      do {
        params.page = page
        let url = util.composeURL(this.ETHERSCAN_BASE_URL, params)
        if (page > 1) {
          // Sleep to avoid reaching API limit
          util.sleep(200)
        }
        let response = await axios.get(url)
        if (response.data.result) {
          resultList = [...resultList, ...response.data.result]
          resultCount = response.data.result.length
        } else {
          resultCount = 0
        }
        page += 1
      } while (resultCount == txPerPage)
      return resultList
    } catch (error) {
      throw new Error(`Error fetching ERC20 Transfers from EtherScan for ${walletAddress}: ` + error.message)
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
      const response = await get(url)
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
      const response = await get(url)
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
    const response = await get(url)
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

  isETHorWETH: function (tokenAddress) {
    return this.isSameAddress(tokenAddress, tokenHelper.WETH_ADDRESS) || this.isSameAddress(tokenAddress, tokenHelper.ETH_ADDRESS)
  },

  isNullorDead: function (address) {
    return this.isSameAddress(address, tokenHelper.NULL_ADDRESS) || this.isSameAddress(address, tokenHelper.DEAD_ADDRESS)
  },
}

export default ContractHelper
