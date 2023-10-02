"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class Token extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Token.init(
    {
      address: DataTypes.STRING,
      symbol: DataTypes.STRING,
      name: DataTypes.STRING,
      maxTotalSupply: DataTypes.STRING,
      chain: DataTypes.STRING,
      decimals: DataTypes.INTEGER,
      isHoneyPot: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Token",
    }
  )
  return Token
}
