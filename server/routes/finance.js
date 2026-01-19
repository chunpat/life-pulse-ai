const express = require('express');
const router = express.Router();
const FinanceRecord = require('../models/FinanceRecord');
const authenticateToken = require('../middleware/auth');
const { Op } = require('sequelize');

// 获取所有记录
router.get('/', authenticateToken, async (req, res) => {
  try {
    const records = await FinanceRecord.findAll({
      where: { userId: req.user.id },
      order: [['transactionDate', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取统计数据
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause = { userId: req.user.id };
    
    if (startDate && endDate) {
        whereClause.transactionDate = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };
    }

    const records = await FinanceRecord.findAll({ where: whereClause });
    
    const stats = records.reduce((acc, record) => {
        const amount = parseFloat(record.amount);
        if (record.type === 'EXPENSE') {
            acc.totalExpense += amount;
            acc.byCategory[record.category] = (acc.byCategory[record.category] || 0) + amount;
        } else {
            acc.totalIncome += amount;
        }
        return acc;
    }, { totalExpense: 0, totalIncome: 0, byCategory: {} });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建新记录
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, amount, category, description, transactionDate } = req.body;
    const newRecord = await FinanceRecord.create({
      userId: req.user.id,
      type,
      amount,
      category,
      description,
      transactionDate: transactionDate || new Date()
    });
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 删除记录
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await FinanceRecord.destroy({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    if (result === 0) {
      return res.status(404).json({ message: '记录未找到' });
    }
    res.json({ message: '记录已删除' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
