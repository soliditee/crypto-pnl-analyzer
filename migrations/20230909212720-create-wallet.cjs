"use strict"
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Wallets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      address: {
        type: Sequelize.STRING,
      },
      alias: {
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

    await queryInterface.addColumn("Wallets", "ownerId", {
      type: Sequelize.INTEGER,
      references: {
        model: "Owners", // This is the name of the table
        key: "id", // This is the name of the column that the foreign key will reference
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Wallets")
  },
}
