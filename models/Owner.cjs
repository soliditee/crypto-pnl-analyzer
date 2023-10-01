"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class Owner extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Owner.hasMany(models.Wallet, {
        foreignKey: "ownerId", // This should match the column name you defined in the migration
        as: "wallets", // This creates a virtual property name for accessing posts
      })
    }
  }
  Owner.init(
    {
      address: DataTypes.STRING,
      alias: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Owner",
    }
  )
  return Owner
}
