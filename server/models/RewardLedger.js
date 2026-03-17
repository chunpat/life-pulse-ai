const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RewardLedger = sequelize.define('RewardLedger', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  eventType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  balanceAfter: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  goalId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  logId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  badgeId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('posted', 'reversed', 'pending'),
    allowNull: false,
    defaultValue: 'posted'
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
});

module.exports = RewardLedger;