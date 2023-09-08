"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("price_in_usd", ["symbol", "from", "to"], {
      name: "idx_symbol_from_to",
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("price_in_usd", "idx_symbol_from_to")
  },
}
