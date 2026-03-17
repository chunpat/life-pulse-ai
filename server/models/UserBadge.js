const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserBadge = sequelize.define('UserBadge', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  goalId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  badgeCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  family: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'goal_completion'
  },
  status: {
    type: DataTypes.ENUM('active', 'revoked'),
    allowNull: false,
    defaultValue: 'active'
  },
  issuedAt: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: () => Date.now()
  },
  issueKey: {
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

module.exports = UserBadge;