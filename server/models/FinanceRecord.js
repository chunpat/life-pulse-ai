const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinanceRecord = sequelize.define('FinanceRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  logId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '关联的日志条目ID'
  },
  type: {
    type: DataTypes.ENUM('EXPENSE', 'INCOME'),
    allowNull: false,
    defaultValue: 'EXPENSE'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'CNY'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transactionDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  paranoid: true
});

module.exports = FinanceRecord;
