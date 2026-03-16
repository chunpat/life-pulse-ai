const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  rawText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  activity: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mood: {
    type: DataTypes.STRING,
    allowNull: true
  },
  importance: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  timestamp: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  location: {
    type: DataTypes.JSON,
    allowNull: true
  },
  goalId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  goalLabel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  goalDayNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isGoalCheckIn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  goalCheckins: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  paranoid: true
});

module.exports = Log;
