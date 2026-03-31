const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plan = sequelize.define('Plan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  planType: {
    type: DataTypes.ENUM('reminder', 'event'),
    allowNull: false,
    defaultValue: 'reminder'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  source: {
    type: DataTypes.ENUM('manual', 'ai', 'imported'),
    allowNull: false,
    defaultValue: 'manual'
  },
  startAt: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  endAt: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  dueAt: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  isAllDay: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  timezone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reminderAt: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  syncTarget: {
    type: DataTypes.ENUM('none', 'ios-reminder', 'ios-calendar'),
    allowNull: false,
    defaultValue: 'none'
  },
  syncState: {
    type: DataTypes.ENUM('local-only', 'pending-sync', 'synced', 'conflict', 'permission-denied', 'failed'),
    allowNull: false,
    defaultValue: 'local-only'
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  externalContainerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  paranoid: true
});

module.exports = Plan;