const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Goal = sequelize.define('Goal', {
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
  rewardTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  goalType: {
    type: DataTypes.ENUM('7_DAY', '21_DAY'),
    allowNull: false
  },
  totalDays: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completedDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  currentStreak: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  startedAt: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  completedAt: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  lastCheckInDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'active'
  },
  planScope: {
    type: DataTypes.ENUM('personal', 'official'),
    allowNull: false,
    defaultValue: 'personal'
  },
  officialPlanId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  rewardRole: {
    type: DataTypes.ENUM('tracking', 'primary'),
    allowNull: false,
    defaultValue: 'tracking'
  },
  completionPointsAwarded: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  completionBadgeCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  completionBadgeTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  completionBadgeIssuedAt: {
    type: DataTypes.BIGINT,
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

module.exports = Goal;