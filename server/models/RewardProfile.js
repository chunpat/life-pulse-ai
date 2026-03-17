const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RewardProfile = sequelize.define('RewardProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  availablePoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lifetimePoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  spentPoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
});

module.exports = RewardProfile;