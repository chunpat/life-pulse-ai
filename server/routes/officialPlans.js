const express = require('express');
const router = express.Router();
const { getPublishedOfficialPlans } = require('../services/officialPlanService');

router.get('/', async (_req, res) => {
  try {
    const plans = await getPublishedOfficialPlans();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: '获取官方计划失败', error: error.message });
  }
});

module.exports = router;