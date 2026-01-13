const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const authenticateToken = require('../middleware/auth');

// 获取所有日志
router.get('/', authenticateToken, async (req, res) => {
  try {
    const logs = await Log.findAll({
      where: { userId: req.user.id },
      order: [['timestamp', 'DESC']]
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: '获取日志失败', error: error.message });
  }
});

// 添加新日志
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { rawText, activity, category, durationMinutes, mood, importance, timestamp, metadata } = req.body;
    const log = await Log.create({
      userId: req.user.id,
      rawText,
      activity,
      category,
      durationMinutes,
      mood,
      importance,
      timestamp: timestamp || Date.now(),
      metadata
    });
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: '创建日志失败', error: error.message });
  }
});

// 更新日志
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const log = await Log.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!log) return res.status(404).json({ message: '日志不存在' });

    await log.update(req.body);
    res.json(log);
  } catch (error) {
    res.status(500).json({ message: '更新日志失败', error: error.message });
  }
});

// 删除日志
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const log = await Log.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!log) return res.status(404).json({ message: '日志不存在' });

    await log.destroy();
    res.json({ message: '日志已删除' });
  } catch (error) {
    res.status(500).json({ message: '删除日志失败', error: error.message });
  }
});

// 批量同步（用于游客注册后同步数据）
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });

    const logsWithUserId = logs.map(log => ({
      ...log,
      userId: req.user.id,
      id: log.id || undefined // 让数据库生成或使用传来的ID
    }));

    await Log.bulkCreate(logsWithUserId, { updateOnDuplicate: ['id'] });
    res.json({ message: '同步成功', count: logs.length });
  } catch (error) {
    res.status(500).json({ message: '批量同步失败', error: error.message });
  }
});

module.exports = router;
