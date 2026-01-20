const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

// 注册
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 检查昵称是否已存在
    const existingName = await User.findOne({ where: { name } });
    if (existingName) {
      return res.status(400).json({ message: '该昵称已被使用' });
    }

    // 如果填写了邮箱，检查邮箱是否已存在
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: '该邮箱已被注册' });
      }
    }

    const user = await User.create({ name, email: email || null, password });
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: 'authenticated'
      }
    });
  } catch (error) {
    res.status(500).json({ message: '注册失败', error: error.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    // 支持通过昵称或邮箱登录
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { name: name },
          { email: name }
        ]
      } 
    });

    if (!user) {
      return res.status(400).json({ message: '用户不存在' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: '密码错误' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: 'authenticated'
      }
    });
  } catch (error) {
    res.status(500).json({ message: '登录失败', error: error.message });
  }
});

module.exports = router;
