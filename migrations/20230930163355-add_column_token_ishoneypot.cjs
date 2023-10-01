"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("tokens", "isHoneyPot", Sequelize.INTEGER)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("tokens", "isHoneyPot")
  },
}
