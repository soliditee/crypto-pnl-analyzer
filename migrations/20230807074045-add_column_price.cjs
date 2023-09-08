"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("price_in_usd", "price", Sequelize.DECIMAL(10, 2))
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("price_in_usd", "price")
  },
}
