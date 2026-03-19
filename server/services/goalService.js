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

const GOAL_MATCH_GROUPS = {
  exercise: [
    '运动', '锻炼', '健身', '训练', '力量', '拉伸', '瑜伽', '跑步', '晨跑', '夜跑', '慢跑',
    '散步', '快走', '走路', '徒步', '骑行', '单车', '游泳', '跳绳', '球类',
    'exercise', 'workout', 'fitness', 'gym', 'run', 'running', 'walk', 'walking', 'swim', 'swimming', 'yoga', 'stretch'
  ],
  reading: [
    '读书', '阅读', '看书', '书籍', '书单', '学习', '复习', '背单词', '课程', '听课', '刷题', '做题',
    'read', 'reading', 'book', 'books', 'study', 'learning', 'learn', 'course'
  ],
  review: [
    '复盘', 'k线', '盘前', '盘后', '交易', '行情', '股票', '基金', '投资', '市场', '看盘',
    'review', 'trading', 'market', 'chart', 'kline', 'stock', 'stocks', 'invest'
  ],
  sleep: [
    '早睡', '睡觉', '睡前', '入睡', '作息', '休息', '熄灯', '睡眠',
    'sleep', 'bed', 'rest', 'lightsout'
  ],
  focus: [
    '专注', '深度工作', '工作', '任务', '项目', '推进', '编码', '写代码', '开发', '产出',
    'focus', 'deepwork', 'deep work', 'work', 'project', 'task', 'coding', 'code', 'development'
  ],
  writing: [
    '写作', '写字', '文章', '博客', '日记', '周记', '总结',
    'write', 'writing', 'blog', 'journal', 'essay'
  ]
};

const OFFICIAL_THEME_GROUP_MAP = {
  sleep: ['sleep'],
  focus: ['focus'],
  exercise: ['exercise']
};

const GENERIC_GOAL_TERMS = [
  '计划', '打卡', '记录', '坚持', '习惯', '每日', '每天', '日常', '挑战',
  'official', 'plan', 'daily', 'habit', 'checkin', 'check-in', 'streak', 'log'
];

const GOAL_TITLE_NOISE_TERMS = [
  '官方计划', '官方', '7天', '21天', '7 day', '21 day', '冲刺', '养成', '回归', '重启'
];

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

const normalizeMatchText = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
};

const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));

const buildLogMatchContext = (logData) => {
  const parts = [
    logData.rawText,
    logData.activity,
    logData.category,
    Array.isArray(logData.tags) ? logData.tags.join(' ') : ''
  ].filter(Boolean);

  return {
    normalizedText: normalizeMatchText(parts.join(' ')),
    normalizedCategory: typeof logData.category === 'string' ? logData.category.trim().toLowerCase() : ''
  };
};

const stripNoiseTerms = (value) => {
  let text = typeof value === 'string' ? value : '';

  for (const noiseTerm of GOAL_TITLE_NOISE_TERMS) {
    text = text.replace(new RegExp(noiseTerm, 'ig'), ' ');
  }

  return text.trim();
};

const extractGoalTitleFragments = (goal) => {
  const rawTitle = [goal.title, goal.rewardTitle].filter(Boolean).join(' ');
  const cleanedTitle = stripNoiseTerms(rawTitle);
  const normalizedFullTitle = normalizeMatchText(cleanedTitle);
  const tokenMatches = cleanedTitle.match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/gi) || [];

  return uniqueValues([
    normalizedFullTitle,
    ...tokenMatches
      .map(token => normalizeMatchText(token))
      .filter(token => token.length >= 2 && !GENERIC_GOAL_TERMS.includes(token))
  ]);
};

const extractGoalMatchProfile = (goal) => {
  const normalizedTitle = normalizeMatchText([goal.title, goal.rewardTitle].filter(Boolean).join(' '));
  const theme = typeof goal.metadata?.theme === 'string' ? goal.metadata.theme.trim().toLowerCase() : '';
  const groups = new Set(OFFICIAL_THEME_GROUP_MAP[theme] || []);

  for (const [groupName, keywords] of Object.entries(GOAL_MATCH_GROUPS)) {
    if (keywords.some(keyword => normalizedTitle.includes(normalizeMatchText(keyword)))) {
      groups.add(groupName);
    }
  }

  const fragments = extractGoalTitleFragments(goal);
  const keywords = uniqueValues(
    Array.from(groups).flatMap(groupName => GOAL_MATCH_GROUPS[groupName] || [])
      .map(keyword => normalizeMatchText(keyword))
  );

  const nonGenericFragments = fragments.filter(fragment => !GENERIC_GOAL_TERMS.includes(fragment));
  const isGenericGoal = keywords.length === 0 && nonGenericFragments.length === 0;

  return {
    groups: Array.from(groups),
    keywords,
    fragments: nonGenericFragments,
    isGenericGoal
  };
};

const doesGoalMatchLog = (goal, logContext) => {
  if (!logContext.normalizedText) {
    return false;
  }

  const profile = extractGoalMatchProfile(goal);

  if (profile.isGenericGoal) {
    return true;
  }

  if (profile.keywords.some(keyword => logContext.normalizedText.includes(keyword))) {
    return true;
  }

  if (profile.fragments.some(fragment => logContext.normalizedText.includes(fragment))) {
    return true;
  }

  if (goal.planScope === 'official') {
    if (profile.groups.includes('exercise') && logContext.normalizedCategory === 'health') {
      return true;
    }

    if (profile.groups.includes('focus') && logContext.normalizedCategory === 'work') {
      return true;
    }
  }

  return false;
};

const hasGoalStarted = (goal) => goal.completedDays > 0 || Boolean(goal.lastCheckInDate);

const buildGoalMetadata = (goal, patch = {}) => ({
  ...(goal.metadata || {}),
  ...patch
});

const getGoalRestartLimit = (goalOrTotalDays) => {
  const totalDays = typeof goalOrTotalDays === 'number'
    ? goalOrTotalDays
    : Number(goalOrTotalDays?.totalDays || 0);

  return Math.max(1, Math.floor(totalDays / 7));
};

const getGoalRestartCount = (goal) => Number(goal.metadata?.restartCount || 0);

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
      currentStreak: 0,
      metadata: buildGoalMetadata(goal, {
        interruptedAt: Date.now(),
        restartLimit: getGoalRestartLimit(goal)
      })
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
        restartCount: 0,
        restartLimit: getGoalRestartLimit(officialPlan.totalDays),
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
      source: 'quick-start',
      restartCount: 0,
      restartLimit: getGoalRestartLimit(config.totalDays)
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

const reactivateFailedGoal = async (goal, userId, options = {}, config = {}) => {
  const txOptions = getTransactionOptions(options);
  const restartLimit = getGoalRestartLimit(goal);
  const restartCount = getGoalRestartCount(goal);
  const nextRestartCount = config.incrementRestartCount === false
    ? restartCount
    : restartCount + 1;

  await goal.update({
    status: 'active',
    startedAt: Date.now(),
    currentStreak: 0,
    lastCheckInDate: null,
    completedAt: null,
    metadata: buildGoalMetadata(goal, {
      interruptedAt: null,
      restartedAt: Date.now(),
      restartCount: nextRestartCount,
      restartLimit
    })
  }, txOptions);

  if (config.ensurePrimary !== false) {
    await ensurePrimaryRewardGoal(userId, goal.id, options);
  }

  return Goal.findOne({ where: { id: goal.id, userId }, ...txOptions });
};

const restartGoal = async (userId, goalId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const goal = await Goal.findOne({ where: { id: goalId, userId }, ...txOptions });

  if (!goal) {
    throw new Error('目标不存在');
  }

  if (goal.status !== 'failed') {
    throw new Error('只有已中断的计划才能重启');
  }

  const restartLimit = getGoalRestartLimit(goal);
  const restartCount = getGoalRestartCount(goal);

  if (restartCount >= restartLimit) {
    throw new Error('该计划的重启次数已用完');
  }

  return reactivateFailedGoal(goal, userId, options);
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
  const failedGoals = await Goal.findAll({
    where: { userId, status: 'failed' },
    order: [['createdAt', 'DESC']],
    ...txOptions
  });
  const logContext = buildLogMatchContext(logData);

  if (!activeGoals.length && !failedGoals.length) {
    return {
      goals: [],
      checkins: [],
      goalEvents: [],
      logData
    };
  }

  const dateKey = formatDateKey(options.settlementTimestamp || Date.now());
  const createdGoalCheckins = [];
  const candidateGoals = [...activeGoals];

  for (const failedGoal of failedGoals) {
    if (!doesGoalMatchLog(failedGoal, logContext)) {
      continue;
    }

    const restartLimit = getGoalRestartLimit(failedGoal);
    const restartCount = getGoalRestartCount(failedGoal);

    if (restartCount >= restartLimit) {
      continue;
    }

    const restartedGoal = await reactivateFailedGoal(failedGoal, userId, options, {
      ensurePrimary: false
    });

    candidateGoals.push(restartedGoal);
  }

  for (const activeGoal of candidateGoals) {
    if (!doesGoalMatchLog(activeGoal, logContext)) {
      continue;
    }

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
      goals: candidateGoals,
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
  restartGoal,
  resumeGoal,
  setPrimaryGoal
};