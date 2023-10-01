"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class Swap extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Swap.init(
    {
      ownerId: DataTypes.INTEGER,
      walletId: DataTypes.INTEGER,
      chain: DataTypes.STRING,
      txnHash: DataTypes.STRING,
      blockNum: DataTypes.BIGINT,
      timestamp: DataTypes.BIGINT,
      isETHInvolved: DataTypes.BOOLEAN,
      gasCostWei: DataTypes.STRING,
      gasCostUSD: DataTypes.DECIMAL(15, 2),
      ethPriceUSD: DataTypes.DECIMAL(15, 2),
      txnValueUSD: DataTypes.DECIMAL(15, 2),
      buyAmount: DataTypes.STRING,
      buyCA: DataTypes.STRING,
      sellAmount: DataTypes.STRING,
      sellCA: DataTypes.STRING,
      buyPriceUSD18: DataTypes.STRING,
      sellPriceUSD18: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Swap",
    }
  )
  return Swap
}
