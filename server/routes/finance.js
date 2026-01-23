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
    const { type, amount, category, description, transactionDate, logId } = req.body;
    const newRecord = await FinanceRecord.create({
      userId: req.user.id,
      logId,
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

// 批量同步日志关联的财务记录 (覆盖模式)
router.post('/sync/:logId', authenticateToken, async (req, res) => {
  const { logId } = req.params;
  const { records } = req.body; // Array of record objects

  if (!logId) return res.status(400).json({ message: 'Missing logId' });
  
  const sequelize = require('../config/database');
  const t = await sequelize.transaction();

  try {
    // 1. 删除旧关联记录
    await FinanceRecord.destroy({
      where: { 
        userId: req.user.id,
        logId: logId
      },
      transaction: t
    });

    // 2. 批量插入新记录
    if (records && records.length > 0) {
      const newRecords = records.map(r => ({
        ...r,
        userId: req.user.id,
        logId: logId,
        transactionDate: r.transactionDate || new Date()
      }));
      
      await FinanceRecord.bulkCreate(newRecords, { transaction: t });
    }

    await t.commit();
    res.json({ message: 'Sync successful', count: records ? records.length : 0 });
  } catch (err) {
    await t.rollback();
    console.error('Sync Finance Error:', err);
    res.status(500).json({ message: err.message });
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
