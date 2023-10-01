"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("swaps", "buyPriceUSD18", Sequelize.STRING)
    await queryInterface.addColumn("swaps", "sellPriceUSD18", Sequelize.STRING)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("swaps", "buyPriceUSD18")
    await queryInterface.removeColumn("swaps", "sellPriceUSD18")
  },
}
