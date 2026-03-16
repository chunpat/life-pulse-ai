const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  completeGoal,
  createGoalForUser,
  deleteGoal,
  getActiveGoals,
  getGoalCheckins,
  listGoals,
  pauseGoal,
  resumeGoal
} = require('../services/goalService');

const getGoalErrorStatus = (message) => {
  if (message === '目标不存在') return 404;
  if (message === '不支持的目标类型') return 400;
  if (message === '只有进行中的计划才能暂停') return 400;
  if (message === '只有已暂停的计划才能恢复') return 400;
  if (message === '本月已删除过 1 个已开始的计划，已开始的计划每月只能删除 1 次') return 409;
  return 500;
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const goals = await listGoals(req.user.id);
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: '获取目标失败', error: error.message });
  }
});

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const goals = await getActiveGoals(req.user.id);
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: '获取当前目标失败', error: error.message });
  }
});

router.get('/:id/checkins', authenticateToken, async (req, res) => {
  try {
    const data = await getGoalCheckins(req.user.id, req.params.id);
    res.json(data);
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { goalType, title, rewardTitle } = req.body;
    const goal = await createGoalForUser(req.user.id, { goalType, title, rewardTitle });
    res.status(201).json(goal);
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

router.post('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const goal = await pauseGoal(req.user.id, req.params.id);
    res.json(goal);
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const goal = await resumeGoal(req.user.id, req.params.id);
    res.json(goal);
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const goal = await completeGoal(req.user.id, req.params.id);
    res.json(goal);
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await deleteGoal(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    const statusCode = getGoalErrorStatus(error.message);
    res.status(statusCode).json({ message: error.message, error: error.message });
  }
});

module.exports = router;