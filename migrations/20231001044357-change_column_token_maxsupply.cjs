"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tokens", "maxTotalSupply", {
      type: Sequelize.STRING,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("tokens", "maxTotalSupply", {
      type: Sequelize.BIGINT,
    })
  },
}
