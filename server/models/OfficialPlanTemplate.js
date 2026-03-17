const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OfficialPlanTemplate = sequelize.define('OfficialPlanTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subtitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
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
  completionPoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  badgeCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  badgeTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  badgeShortTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accentColor: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '#0f172a'
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
});

module.exports = OfficialPlanTemplate;