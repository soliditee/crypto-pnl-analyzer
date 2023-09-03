require("dotenv").config()
const ph = require("./src/PriceHelper")
const erc20Transfer = require("./src/ERC20Transfer")
const util = require("./src/Utility")

async function main() {
  // const currentTimestampInSeconds = Math.floor(Date.now() / 1000)
  // const currentTimestampInSeconds = 1691395632
  // const currentTimestampInSeconds = 1688872265
  // util.debugLog(await ph.getETHPriceInUSD(currentTimestampInSeconds))
  // util.debugLog(await wh.getBlockNumberByTimestamp(currentTimestampInSeconds))

  // const transferList = await erc20Transfer.getTransferEventLogsFromTx(txHashSell, mainWallet)
  await erc20Transfer.analyzeERC20Transfers(phoenixWallet)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
