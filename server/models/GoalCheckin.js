const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GoalCheckin = sequelize.define('GoalCheckin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  goalId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  logId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateKey: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  dayNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['goalId', 'dateKey']
    }
  ]
});

module.exports = GoalCheckin;