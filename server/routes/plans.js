const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  cancelPlan,
  completePlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan
} = require('../services/planService');

const getPlanErrorStatus = (message) => {
  if (message === '计划不存在') return 404;
  if (message === '计划标题不能为空') return 400;
  if (message === '不支持的计划类型') return 400;
  if (message === '不支持的计划状态') return 400;
  if (message === '不支持的计划来源') return 400;
  if (message === '不支持的同步目标') return 400;
  if (message === '不支持的同步状态') return 400;
  if (message === '结束时间不能早于开始时间') return 400;
  if (message === '计划时间已过，请调整到未来时间') return 400;
  return 500;
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const plans = await listPlans(req.user.id, req.query);
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: '获取计划失败', error: error.message });
  }
});

router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const plans = await listPlans(req.user.id, req.query);
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: '获取日历计划失败', error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const plan = await getPlan(req.user.id, req.params.id);
    res.json(plan);
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const plan = await createPlan(req.user.id, req.body);
    res.status(201).json(plan);
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const plan = await updatePlan(req.user.id, req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const plan = await completePlan(req.user.id, req.params.id);
    res.json(plan);
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const plan = await cancelPlan(req.user.id, req.params.id);
    res.json(plan);
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await deletePlan(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(getPlanErrorStatus(error.message)).json({ message: error.message, error: error.message });
  }
});

module.exports = router;