"use strict"
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Swaps", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ownerId: {
        type: Sequelize.INTEGER,
      },
      walletId: {
        type: Sequelize.INTEGER,
      },
      chain: {
        type: Sequelize.STRING,
      },
      txnHash: {
        type: Sequelize.STRING,
      },
      blockNum: {
        type: Sequelize.BIGINT,
      },
      timestamp: {
        type: Sequelize.BIGINT,
      },
      isETHInvolved: {
        type: Sequelize.BOOLEAN,
      },
      gasCostWei: {
        type: Sequelize.STRING,
      },
      gasCostUSD: {
        type: Sequelize.DECIMAL(15, 2),
      },
      ethPriceUSD: {
        type: Sequelize.DECIMAL(15, 2),
      },
      txnValueUSD: {
        type: Sequelize.DECIMAL(15, 2),
      },
      buyAmount: {
        type: Sequelize.STRING,
      },
      buyCA: {
        type: Sequelize.STRING,
      },
      sellAmount: {
        type: Sequelize.STRING,
      },
      sellCA: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Swaps")
  },
}
