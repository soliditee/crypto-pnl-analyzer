"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class PriceInUSD extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PriceInUSD.init(
    {
      symbol: DataTypes.STRING,
      from: DataTypes.BIGINT,
      to: DataTypes.BIGINT,
      price: DataTypes.DECIMAL(10, 2),
    },
    {
      sequelize,
      modelName: "PriceInUSD",
      tableName: "price_in_usd",
    }
  )
  return PriceInUSD
}
