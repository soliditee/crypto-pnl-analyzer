import { parse } from "dotenv"
import ph from "./src/PriceHelper.js"
import util from "./src/Utility.js"
import contractHelper from "./src/ContractHelper.js"
import erc20Helper from "./src/ERC20TransferAlchemy.js"

async function main() {
  // const currentTimestampInSeconds = Math.floor(Date.now() / 1000)
  // const currentTimestampInSeconds = 1691395632
  // const currentTimestampInSeconds = 1688872265
  // util.debugLog(await ph.getETHPriceInUSD(currentTimestampInSeconds))
  // util.debugLog(await wh.getBlockNumberByTimestamp(currentTimestampInSeconds))
  // const transferList = await erc20Transfer.getTransferEventLogsFromTx(txHashSell, mainWallet)
  // await erc20Transfer.analyzeERC20Transfers(process.env.phoenixWallet)
  // const txList = await contractHelper.fetchTransferTxByAddress(process.env.mainWallet)
  // writeTextToFile(`./logs/alchemy_tx_main.json`, jsonToString(txList))
  // await erc20Helper.analyzeERC20Transfers(process.env.mainWallet)
  await erc20Helper.analyzeERC20Transfers(process.env.phoenixWallet)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
