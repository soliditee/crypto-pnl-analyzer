"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tokens", "chain", {
      type: Sequelize.STRING,
      defaultValue: "eth",
    })
    await queryInterface.addColumn("tokens", "decimals", Sequelize.INTEGER)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("tokens", "chain")
    await queryInterface.removeColumn("tokens", "decimals")
  },
}
