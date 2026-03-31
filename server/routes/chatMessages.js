const express = require('express');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const ChatMessage = require('../models/ChatMessage');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      where: { userId: req.user.id },
      order: [['timestamp', 'ASC']]
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: '获取聊天记录失败', error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { id, role, content, messageType, timestamp, metadata } = req.body;
    const message = await ChatMessage.create({
      id: id || randomUUID(),
      userId: req.user.id,
      role,
      content,
      messageType: messageType || 'text',
      timestamp: timestamp || Date.now(),
      metadata: metadata || null
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: '创建聊天记录失败', error: error.message });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ message: '数据格式错误' });
    }

    const payload = messages.map((message) => ({
      id: message.id || randomUUID(),
      userId: req.user.id,
      role: message.role,
      content: message.content,
      messageType: message.messageType || 'text',
      timestamp: message.timestamp || Date.now(),
      metadata: message.metadata || null
    }));

    await ChatMessage.bulkCreate(payload, {
      updateOnDuplicate: ['role', 'content', 'messageType', 'timestamp', 'metadata', 'updatedAt']
    });

    res.json({ message: '聊天记录同步成功', count: payload.length });
  } catch (error) {
    res.status(500).json({ message: '聊天记录同步失败', error: error.message });
  }
});

router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: 'messageIds 必须是非空数组' });
    }

    const count = await ChatMessage.destroy({
      where: {
        userId: req.user.id,
        id: {
          [Op.in]: messageIds
        }
      }
    });

    res.json({ message: '聊天记录删除成功', count });
  } catch (error) {
    res.status(500).json({ message: '删除聊天记录失败', error: error.message });
  }
});

module.exports = router;