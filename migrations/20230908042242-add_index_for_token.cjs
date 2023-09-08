"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("tokens", ["address"], {
      name: "idx_address",
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("tokens", "idx_address")
  },
}
