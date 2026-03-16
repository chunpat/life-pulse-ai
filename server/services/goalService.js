const { Op } = require('sequelize');
const Goal = require('../models/Goal');
const GoalCheckin = require('../models/GoalCheckin');

const GOAL_CONFIG = {
  '7_DAY': {
    title: '7 天冲刺',
    totalDays: 7
  },
  '21_DAY': {
    title: '21 天养成',
    totalDays: 21
  }
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateMs = (dateKey) => new Date(`${dateKey}T00:00:00`).getTime();

const diffDays = (fromDateKey, toDateKey) => Math.floor((toDateMs(toDateKey) - toDateMs(fromDateKey)) / DAY_IN_MS);

const sanitizeText = (value, maxLength = 60) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maxLength);
};

const hasGoalStarted = (goal) => goal.completedDays > 0 || Boolean(goal.lastCheckInDate);

const buildGoalMetadata = (goal, patch = {}) => ({
  ...(goal.metadata || {}),
  ...patch
});

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
};

const refreshSingleActiveGoal = async (goal, todayKey) => {
  if (goal.completedDays >= goal.totalDays) {
    await goal.update({
      status: 'completed',
      completedAt: goal.completedAt || Date.now()
    });
    return null;
  }

  const startedKey = formatDateKey(goal.startedAt);
  const referenceKey = goal.lastCheckInDate || startedKey;
  const shouldFailWithoutCheckin = !goal.lastCheckInDate && startedKey !== todayKey;
  const missedMoreThanOneDay = goal.lastCheckInDate && diffDays(referenceKey, todayKey) > 1;

  if (shouldFailWithoutCheckin || missedMoreThanOneDay) {
    await goal.update({
      status: 'failed',
      currentStreak: 0
    });
    return null;
  }

  return goal;
};

const refreshActiveGoals = async (userId) => {
  const activeGoals = await Goal.findAll({
    where: { userId, status: 'active' },
    order: [['createdAt', 'DESC']]
  });

  if (!activeGoals.length) {
    return [];
  }

  const todayKey = formatDateKey(Date.now());
  const refreshedGoals = [];

  for (const goal of activeGoals) {
    const refreshedGoal = await refreshSingleActiveGoal(goal, todayKey);
    if (refreshedGoal) {
      refreshedGoals.push(refreshedGoal);
    }
  }

  return refreshedGoals;
};

const listGoals = async (userId) => {
  await refreshActiveGoals(userId);

  return Goal.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });
};

const getActiveGoals = async (userId) => refreshActiveGoals(userId);

const getActiveGoal = async (userId) => {
  const goals = await refreshActiveGoals(userId);
  return goals[0] || null;
};

const createGoalForUser = async (userId, goalInput) => {
  const goalType = typeof goalInput === 'string' ? goalInput : goalInput?.goalType;
  const config = GOAL_CONFIG[goalType];

  if (!config) {
    throw new Error('不支持的目标类型');
  }

  const title = sanitizeText(goalInput?.title) || config.title;
  const rewardTitle = sanitizeText(goalInput?.rewardTitle, 80);

  await refreshActiveGoals(userId);

  return Goal.create({
    userId,
    title,
    rewardTitle,
    goalType,
    totalDays: config.totalDays,
    startedAt: Date.now(),
    metadata: {
      source: 'quick-start'
    }
  });
};

const pauseGoal = async (userId, goalId) => {
  const goal = await Goal.findOne({ where: { id: goalId, userId } });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (goal.status !== 'active') {
    throw new Error('只有进行中的计划才能暂停');
  }

  const pauseCount = Number(goal.metadata?.pauseCount || 0) + 1;

  await goal.update({
    status: 'paused',
    metadata: buildGoalMetadata(goal, {
      pausedAt: Date.now(),
      pauseCount
    })
  });

  return goal;
};

const resumeGoal = async (userId, goalId) => {
  const goal = await Goal.findOne({ where: { id: goalId, userId } });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (goal.status !== 'paused') {
    throw new Error('只有已暂停的计划才能恢复');
  }

  const resumeCount = Number(goal.metadata?.resumeCount || 0) + 1;

  await goal.update({
    status: 'active',
    startedAt: Date.now(),
    currentStreak: 0,
    lastCheckInDate: null,
    metadata: buildGoalMetadata(goal, {
      pausedAt: null,
      resumedAt: Date.now(),
      resumeCount
    })
  });

  return goal;
};

const completeGoal = async (userId, goalId) => {
  const goal = await Goal.findOne({ where: { id: goalId, userId } });

  if (!goal) {
    throw new Error('目标不存在');
  }

  await goal.update({
    status: 'completed',
    completedAt: Date.now()
  });

  return goal;
};

const deleteGoal = async (userId, goalId) => {
  const goal = await Goal.findOne({ where: { id: goalId, userId } });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (hasGoalStarted(goal)) {
    const { start, end } = getCurrentMonthRange();
    const deletedStartedGoalCount = await Goal.count({
      where: {
        userId,
        deletedAt: {
          [Op.gte]: start,
          [Op.lt]: end
        },
        [Op.or]: [
          { completedDays: { [Op.gt]: 0 } },
          { lastCheckInDate: { [Op.ne]: null } }
        ]
      },
      paranoid: false
    });

    if (deletedStartedGoalCount >= 1) {
      throw new Error('本月已删除过 1 个已开始的计划，已开始的计划每月只能删除 1 次');
    }
  }

  await goal.destroy();
  return goal;
};

const getGoalCheckins = async (userId, goalId) => {
  const goal = await Goal.findOne({ where: { id: goalId, userId } });

  if (!goal) {
    throw new Error('目标不存在');
  }

  const checkins = await GoalCheckin.findAll({
    where: { goalId, userId },
    order: [['dateKey', 'ASC']]
  });

  return {
    goal,
    checkins
  };
};

const applyLogGoalCheckin = async (userId, logData) => {
  const activeGoals = await refreshActiveGoals(userId);

  if (!activeGoals.length) {
    return {
      goals: [],
      checkins: [],
      logData
    };
  }

  const dateKey = formatDateKey(logData.timestamp || Date.now());
  const createdGoalCheckins = [];

  for (const activeGoal of activeGoals) {
    if (activeGoal.lastCheckInDate === dateKey) {
      continue;
    }

    const existingCheckin = await GoalCheckin.findOne({
      where: {
        goalId: activeGoal.id,
        userId,
        dateKey
      }
    });

    if (existingCheckin) {
      continue;
    }

    const nextCompletedDays = activeGoal.completedDays + 1;
    const nextStreak = activeGoal.lastCheckInDate && diffDays(activeGoal.lastCheckInDate, dateKey) === 1
      ? activeGoal.currentStreak + 1
      : 1;

    const checkin = await GoalCheckin.create({
      goalId: activeGoal.id,
      userId,
      logId: logData.id,
      dateKey,
      dayNumber: nextCompletedDays
    });

    const nextStatus = nextCompletedDays >= activeGoal.totalDays ? 'completed' : 'active';

    await activeGoal.update({
      completedDays: nextCompletedDays,
      currentStreak: nextStreak,
      lastCheckInDate: dateKey,
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? Date.now() : null
    });

    createdGoalCheckins.push({
      checkin,
      goal: activeGoal,
      summary: {
        goalId: activeGoal.id,
        goalLabel: activeGoal.title,
        dayNumber: nextCompletedDays
      }
    });
  }

  if (!createdGoalCheckins.length) {
    return {
      goals: activeGoals,
      checkins: [],
      logData
    };
  }

  const primaryGoalCheckin = createdGoalCheckins[0].summary;

  return {
    goals: createdGoalCheckins.map(item => item.goal),
    checkins: createdGoalCheckins.map(item => item.checkin),
    logData: {
      ...logData,
      goalId: primaryGoalCheckin.goalId,
      goalLabel: primaryGoalCheckin.goalLabel,
      goalDayNumber: primaryGoalCheckin.dayNumber,
      isGoalCheckIn: true,
      goalCheckins: createdGoalCheckins.map(item => item.summary)
    }
  };
};

module.exports = {
  GOAL_CONFIG,
  applyLogGoalCheckin,
  completeGoal,
  createGoalForUser,
  deleteGoal,
  formatDateKey,
  getActiveGoals,
  getActiveGoal,
  getGoalCheckins,
  listGoals,
  pauseGoal,
  refreshActiveGoals,
  resumeGoal
};