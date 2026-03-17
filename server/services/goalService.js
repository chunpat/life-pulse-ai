const { Op } = require('sequelize');
const Goal = require('../models/Goal');
const GoalCheckin = require('../models/GoalCheckin');
const { getOfficialPlanTemplateById } = require('./officialPlanService');

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

const getTransactionOptions = (options = {}) => (options.transaction ? { transaction: options.transaction } : {});

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

const selectPrimaryRewardGoal = (activeGoals, preferredGoalId = null) => {
  if (!activeGoals.length) {
    return null;
  }

  const preferredGoal = preferredGoalId
    ? activeGoals.find(goal => goal.id === preferredGoalId)
    : null;
  const activeOfficialGoals = activeGoals.filter(goal => goal.planScope === 'official');

  if (activeOfficialGoals.length) {
    if (preferredGoal && preferredGoal.planScope === 'official') {
      return preferredGoal;
    }

    return activeOfficialGoals.find(goal => goal.rewardRole === 'primary') || activeOfficialGoals[0];
  }

  return preferredGoal || activeGoals.find(goal => goal.rewardRole === 'primary') || activeGoals[0];
};

const ensurePrimaryRewardGoal = async (userId, preferredGoalId = null, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const activeGoals = await Goal.findAll({
    where: { userId, status: 'active' },
    order: [['createdAt', 'DESC']],
    ...txOptions
  });

  if (!activeGoals.length) {
    await Goal.update({ rewardRole: 'tracking' }, {
      where: { userId, rewardRole: 'primary' },
      ...txOptions
    });
    return null;
  }

  const targetGoal = selectPrimaryRewardGoal(activeGoals, preferredGoalId);

  await Goal.update({ rewardRole: 'tracking' }, {
    where: { userId, rewardRole: 'primary' },
    ...txOptions
  });

  await Goal.update({ rewardRole: 'primary' }, {
    where: { id: targetGoal.id, userId },
    ...txOptions
  });

  return targetGoal;
};

const refreshSingleActiveGoal = async (goal, todayKey, options = {}) => {
  const txOptions = getTransactionOptions(options);

  if (goal.completedDays >= goal.totalDays) {
    await goal.update({
      status: 'completed',
      completedAt: goal.completedAt || Date.now()
    }, txOptions);
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
    }, txOptions);
    return null;
  }

  return goal;
};

const refreshActiveGoals = async (userId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const activeGoals = await Goal.findAll({
    where: { userId, status: 'active' },
    order: [['createdAt', 'DESC']],
    ...txOptions
  });

  if (!activeGoals.length) {
    await ensurePrimaryRewardGoal(userId, null, options);
    return [];
  }

  const todayKey = formatDateKey(options.settlementTimestamp || Date.now());

  for (const goal of activeGoals) {
    await refreshSingleActiveGoal(goal, todayKey, options);
  }

  await ensurePrimaryRewardGoal(userId, null, options);

  return Goal.findAll({
    where: { userId, status: 'active' },
    order: [['createdAt', 'DESC']],
    ...txOptions
  });
};

const listGoals = async (userId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  await refreshActiveGoals(userId, options);

  return Goal.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    ...txOptions
  });
};

const getActiveGoals = async (userId, options = {}) => refreshActiveGoals(userId, options);

const getActiveGoal = async (userId, options = {}) => {
  const goals = await refreshActiveGoals(userId, options);
  return goals[0] || null;
};

const createGoalForUser = async (userId, goalInput, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goalType = typeof goalInput === 'string' ? goalInput : goalInput?.goalType;
  const officialPlanTemplateId = typeof goalInput === 'object' ? goalInput?.officialPlanTemplateId : null;
  const config = GOAL_CONFIG[goalType];

  if (!config && !officialPlanTemplateId) {
    throw new Error('不支持的目标类型');
  }

  const title = sanitizeText(goalInput?.title) || config?.title;
  const rewardTitle = sanitizeText(goalInput?.rewardTitle, 80);

  await refreshActiveGoals(userId, options);

  if (officialPlanTemplateId) {
    const officialPlan = await getOfficialPlanTemplateById(officialPlanTemplateId, options);

    if (!officialPlan) {
      throw new Error('官方计划不存在');
    }

    const existingOfficialGoal = await Goal.findOne({
      where: {
        userId,
        officialPlanId: officialPlan.id,
        status: { [Op.in]: ['active', 'paused'] }
      },
      ...txOptions
    });

    if (existingOfficialGoal) {
      throw new Error('该官方计划已在进行中');
    }

    await Goal.update({ rewardRole: 'tracking' }, {
      where: {
        userId,
        status: 'active'
      },
      ...txOptions
    });

    return Goal.create({
      userId,
      title: officialPlan.title,
      rewardTitle: officialPlan.badgeTitle,
      goalType: officialPlan.goalType,
      totalDays: officialPlan.totalDays,
      startedAt: Date.now(),
      planScope: 'official',
      officialPlanId: officialPlan.id,
      rewardRole: 'primary',
      metadata: {
        source: 'official-plan',
        officialPlanSlug: officialPlan.slug,
        officialPlanBadgeCode: officialPlan.badgeCode,
        officialPlanTitle: officialPlan.title,
        officialPlanBadgeShortTitle: officialPlan.badgeShortTitle,
        accentColor: officialPlan.accentColor,
        theme: officialPlan.metadata?.theme || null
      }
    }, txOptions);
  }

  const activePrimaryGoal = await Goal.findOne({
    where: { userId, status: 'active', rewardRole: 'primary' },
    ...txOptions
  });

  return Goal.create({
    userId,
    title,
    rewardTitle,
    goalType,
    totalDays: config.totalDays,
    startedAt: Date.now(),
    planScope: 'personal',
    rewardRole: activePrimaryGoal ? 'tracking' : 'primary',
    metadata: {
      source: 'quick-start'
    }
  }, txOptions);
};

const pauseGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

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
  }, txOptions);

  await ensurePrimaryRewardGoal(userId, null, options);

  return Goal.findOne({ where: { id: goalId, userId }, ...txOptions });
};

const resumeGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

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
  }, txOptions);

  await ensurePrimaryRewardGoal(userId, null, options);

  return Goal.findOne({ where: { id: goalId, userId }, ...txOptions });
};

const completeGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (goal.status === 'completed') {
    return goal;
  }

  if (goal.completedDays < goal.totalDays) {
    throw new Error('计划尚未完成，不能手动结束');
  }

  await goal.update({
    status: 'completed',
    completedAt: Date.now()
  }, txOptions);

  await ensurePrimaryRewardGoal(userId, null, options);

  return Goal.findOne({ where: { id: goalId, userId }, ...txOptions });
};

const deleteGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

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
      paranoid: false,
      ...txOptions
    });

    if (deletedStartedGoalCount >= 1) {
      throw new Error('本月已删除过 1 个已开始的计划，已开始的计划每月只能删除 1 次');
    }
  }

  await goal.destroy(txOptions);
  await ensurePrimaryRewardGoal(userId, null, options);
  return goal;
};

const setPrimaryGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (goal.status !== 'active') {
    throw new Error('只有进行中的计划才能设为主奖励计划');
  }

  const activeOfficialGoal = await Goal.findOne({
    where: {
      userId,
      status: 'active',
      planScope: 'official',
      id: { [Op.ne]: goalId }
    },
    ...txOptions
  });

  if (activeOfficialGoal && goal.planScope !== 'official') {
    throw new Error('有官方计划进行中时，不能将个人计划设为主奖励计划');
  }

  await ensurePrimaryRewardGoal(userId, goal.id, options);
  return Goal.findOne({ where: { id: goalId, userId }, ...txOptions });
};

const getGoalCheckins = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

  if (!goal) {
    throw new Error('目标不存在');
  }

  const checkins = await GoalCheckin.findAll({
    where: { goalId, userId },
    order: [['dateKey', 'ASC']],
    ...txOptions
  });

  return {
    goal,
    checkins
  };
};

const applyLogGoalCheckin = async (userId, logData, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const activeGoals = await refreshActiveGoals(userId, options);

  if (!activeGoals.length) {
    return {
      goals: [],
      checkins: [],
      goalEvents: [],
      logData
    };
  }

  const dateKey = formatDateKey(options.settlementTimestamp || Date.now());
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
      },
      ...txOptions
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
    }, txOptions);

    const nextStatus = nextCompletedDays >= activeGoal.totalDays ? 'completed' : 'active';
    const completedNow = nextStatus === 'completed' && activeGoal.status !== 'completed';

    await activeGoal.update({
      completedDays: nextCompletedDays,
      currentStreak: nextStreak,
      lastCheckInDate: dateKey,
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? Date.now() : null
    }, txOptions);

    createdGoalCheckins.push({
      checkin,
      goal: activeGoal,
      completedNow,
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
      goalEvents: [],
      logData
    };
  }

  await ensurePrimaryRewardGoal(userId, null, options);

  const primaryGoalCheckin = createdGoalCheckins.find(item => item.goal.rewardRole === 'primary')?.summary || createdGoalCheckins[0].summary;

  return {
    goals: createdGoalCheckins.map(item => item.goal),
    checkins: createdGoalCheckins.map(item => item.checkin),
    goalEvents: createdGoalCheckins.map(item => ({
      goal: item.goal,
      summary: item.summary,
      completedNow: item.completedNow
    })),
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
  resumeGoal,
  setPrimaryGoal
};