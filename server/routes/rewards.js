const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getRewardProfileSummary, listRewardLedger, listUserBadges } = require('../services/rewardService');

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getRewardProfileSummary(req.user.id);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: '获取积分资料失败', error: error.message });
  }
});

router.get('/ledger', authenticateToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const ledger = await listRewardLedger(req.user.id, Number.isNaN(limit) ? 20 : Math.min(limit, 50));
    res.json(ledger);
  } catch (error) {
    res.status(500).json({ message: '获取积分记录失败', error: error.message });
  }
});

router.get('/badges', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const badges = await listUserBadges(req.user.id, {
      limit: Number.isNaN(limit) ? undefined : limit,
      family: typeof req.query.family === 'string' ? req.query.family : undefined,
      planScope: req.query.planScope === 'official' || req.query.planScope === 'personal'
        ? req.query.planScope
        : undefined,
      status: req.query.status === 'revoked' ? 'revoked' : 'active'
    });
    res.json(badges);
  } catch (error) {
    res.status(500).json({ message: '获取徽章列表失败', error: error.message });
  }
});

module.exports = router;