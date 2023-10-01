"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("swaps", ["ownerId", "chain", "txnHash"], {
      name: "idx_ownerId_chain_txHash",
    })
    await queryInterface.addIndex("owners", ["address"], {
      name: "idx_address",
    })
    await queryInterface.addIndex("wallets", ["address"], {
      name: "idx_address",
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("swaps", "idx_ownerId_chain_txHash")
    await queryInterface.removeIndex("owners", "idx_address")
    await queryInterface.removeIndex("wallets", "idx_address")
  },
}
