const RewardLedger = require('../models/RewardLedger');
const RewardProfile = require('../models/RewardProfile');
const UserBadge = require('../models/UserBadge');
const { getOfficialPlanTemplateById } = require('./officialPlanService');

const DAILY_VALID_LOG_POINTS = 2;
const DAILY_PRIMARY_GOAL_POINTS = 1;
const LEVEL_STEP_POINTS = 50;
const OFFICIAL_ACCENT_COLOR_MAP = {
  '#1d4ed8': '#f59e0b',
  '#7c3aed': '#d97706',
  '#059669': '#c2410c'
};
const GOAL_COMPLETION_POINTS = {
  '7_DAY': 20,
  '21_DAY': 60
};

const GOAL_BADGE_CONFIG = {
  '7_DAY': {
    badgeCode: 'goal_7_day_completed',
    title: '7 天冲刺完成',
    shortTitle: '7 天完成',
    accentColor: '#f59e0b',
    theme: 'starter'
  },
  '21_DAY': {
    badgeCode: 'goal_21_day_completed',
    title: '21 天养成完成',
    shortTitle: '21 天完成',
    accentColor: '#10b981',
    theme: 'habit'
  }
};

const normalizeOfficialAccentColor = (accentColor = null) => {
  const normalized = typeof accentColor === 'string' ? accentColor.trim().toLowerCase() : '';
  return OFFICIAL_ACCENT_COLOR_MAP[normalized] || accentColor || '#f59e0b';
};

const buildBadgeVisualMetadata = ({
  planScope = 'personal',
  accentColor = null,
  shortTitle = null,
  officialPlanId = null,
  officialPlanSlug = null,
  officialPlanTitle = null,
  theme = null
} = {}) => ({
  planScope,
  accentColor: planScope === 'official' ? normalizeOfficialAccentColor(accentColor) : accentColor,
  shortTitle,
  officialPlanId,
  officialPlanSlug,
  officialPlanTitle,
  theme
});

const formatRewardBadge = (badge) => {
  const metadata = badge?.metadata || {};
  const accentColor = metadata.planScope === 'official'
    ? normalizeOfficialAccentColor(typeof metadata.accentColor === 'string' && metadata.accentColor.trim() ? metadata.accentColor : null)
    : (typeof metadata.accentColor === 'string' && metadata.accentColor.trim() ? metadata.accentColor : '#f59e0b');
  const shortTitle = typeof metadata.shortTitle === 'string' && metadata.shortTitle.trim()
    ? metadata.shortTitle
    : badge.title;

  return {
    id: badge.id,
    goalId: badge.goalId,
    badgeCode: badge.badgeCode,
    title: badge.title,
    family: badge.family,
    status: badge.status,
    issuedAt: badge.issuedAt,
    metadata,
    shortTitle,
    accentColor,
    planScope: metadata.planScope === 'official' ? 'official' : 'personal',
    officialPlanTitle: typeof metadata.officialPlanTitle === 'string' ? metadata.officialPlanTitle : null,
    theme: typeof metadata.theme === 'string' ? metadata.theme : null,
    createdAt: badge.createdAt,
    updatedAt: badge.updatedAt
  };
};

const getGoalCompletionRewardConfig = async (goal, options = {}) => {
  if (goal.planScope === 'official' && goal.officialPlanId) {
    const officialPlan = await getOfficialPlanTemplateById(goal.officialPlanId, {
      ...options,
      includeUnpublished: true
    });

    if (officialPlan) {
      return {
        badgeCode: officialPlan.badgeCode,
        badgeTitle: officialPlan.badgeTitle,
        badgeFamily: 'official_goal_completion',
        points: officialPlan.completionPoints || 0,
        eventType: 'official_plan_completed',
        metadata: {
          officialPlanId: officialPlan.id,
          officialPlanSlug: officialPlan.slug,
          officialPlanTitle: officialPlan.title,
          planScope: 'official',
          shortTitle: officialPlan.badgeShortTitle,
          accentColor: normalizeOfficialAccentColor(officialPlan.accentColor),
          theme: officialPlan.metadata?.theme || null
        }
      };
    }
  }

  const badgeConfig = GOAL_BADGE_CONFIG[goal.goalType];

  return {
    badgeCode: badgeConfig?.badgeCode || null,
    badgeTitle: badgeConfig?.title || goal.title,
    badgeFamily: 'goal_completion',
    points: GOAL_COMPLETION_POINTS[goal.goalType] || 0,
    eventType: goal.goalType === '21_DAY' ? 'goal_completed_21_day' : 'goal_completed_7_day',
    metadata: buildBadgeVisualMetadata({
      planScope: 'personal',
      shortTitle: badgeConfig?.shortTitle || null,
      accentColor: badgeConfig?.accentColor || null,
      theme: badgeConfig?.theme || null
    })
  };
};

const getTransactionOptions = (options = {}) => (options.transaction ? { transaction: options.transaction } : {});

const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRewardLevel = (lifetimePoints = 0) => Math.max(1, Math.floor(lifetimePoints / LEVEL_STEP_POINTS) + 1);

const getLevelProgress = (lifetimePoints = 0, level = getRewardLevel(lifetimePoints)) => {
  const currentLevelFloor = Math.max(0, (level - 1) * LEVEL_STEP_POINTS);
  const nextLevelThreshold = level * LEVEL_STEP_POINTS;
  const pointsIntoCurrentLevel = Math.max(lifetimePoints - currentLevelFloor, 0);
  const pointsToNextLevel = Math.max(nextLevelThreshold - lifetimePoints, 0);

  return {
    levelStepPoints: LEVEL_STEP_POINTS,
    currentLevelFloor,
    nextLevelThreshold,
    pointsIntoCurrentLevel,
    pointsToNextLevel
  };
};

const isRewardableLog = (logData = {}) => {
  const rawText = typeof logData.rawText === 'string' ? logData.rawText.trim() : '';
  const activity = typeof logData.activity === 'string' ? logData.activity.trim() : '';
  const durationMinutes = Number(logData.durationMinutes || 0);
  const imageCount = Array.isArray(logData.images) ? logData.images.length : 0;
  const hasLocation = Boolean(logData.location && logData.location.name);
  const combinedLength = `${rawText}${activity}`.trim().length;

  return combinedLength >= 6 || durationMinutes >= 10 || imageCount > 0 || hasLocation;
};

const getOrCreateRewardProfile = async (userId, options = {}) => {
  const txOptions = getTransactionOptions(options);
  let profile = await RewardProfile.findOne({ where: { userId }, ...txOptions });

  if (profile) {
    return profile;
  }

  try {
    profile = await RewardProfile.create({ userId }, txOptions);
    return profile;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return RewardProfile.findOne({ where: { userId }, ...txOptions });
    }
    throw error;
  }
};

const postReward = async ({
  userId,
  eventType,
  amount,
  idempotencyKey,
  goalId = null,
  logId = null,
  badgeId = null,
  metadata = {},
  recordedAt = null
}, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const existingLedger = await RewardLedger.findOne({ where: { idempotencyKey }, ...txOptions });

  if (existingLedger) {
    return {
      created: false,
      ledger: existingLedger,
      profile: await getOrCreateRewardProfile(userId, options)
    };
  }

  const profile = await getOrCreateRewardProfile(userId, options);
  const nextAvailablePoints = profile.availablePoints + amount;
  const nextLifetimePoints = amount > 0 ? profile.lifetimePoints + amount : profile.lifetimePoints;
  const nextLevel = getRewardLevel(nextLifetimePoints);

  await profile.update({
    availablePoints: nextAvailablePoints,
    lifetimePoints: nextLifetimePoints,
    level: nextLevel
  }, txOptions);

  try {
    const ledgerPayload = {
      userId,
      eventType,
      amount,
      balanceAfter: nextAvailablePoints,
      goalId,
      logId,
      badgeId,
      idempotencyKey,
      metadata
    };

    if (recordedAt) {
      const timestamp = new Date(recordedAt);
      if (!Number.isNaN(timestamp.getTime())) {
        ledgerPayload.createdAt = timestamp;
        ledgerPayload.updatedAt = timestamp;
      }
    }

    const ledger = await RewardLedger.create(ledgerPayload, txOptions);

    return {
      created: true,
      ledger,
      profile
    };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return {
        created: false,
        ledger: await RewardLedger.findOne({ where: { idempotencyKey }, ...txOptions }),
        profile: await getOrCreateRewardProfile(userId, options)
      };
    }
    throw error;
  }
};

const issueBadge = async ({
  userId,
  goalId = null,
  badgeCode,
  title,
  family = 'goal_completion',
  issueKey,
  metadata = {},
  issuedAt = null
}, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const existingBadge = await UserBadge.findOne({ where: { issueKey }, ...txOptions });

  if (existingBadge) {
    return {
      created: false,
      badge: existingBadge
    };
  }

  try {
    const badgePayload = {
      userId,
      goalId,
      badgeCode,
      title,
      family,
      issueKey,
      metadata,
      issuedAt: issuedAt || Date.now()
    };

    if (issuedAt) {
      const timestamp = new Date(issuedAt);
      if (!Number.isNaN(timestamp.getTime())) {
        badgePayload.createdAt = timestamp;
        badgePayload.updatedAt = timestamp;
      }
    }

    const badge = await UserBadge.create(badgePayload, txOptions);

    return {
      created: true,
      badge
    };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return {
        created: false,
        badge: await UserBadge.findOne({ where: { issueKey }, ...txOptions })
      };
    }
    throw error;
  }
};

const settleGoalCompletionRewards = async ({ goal, logId = null, recordedAt = null }, options = {}) => {
  const txOptions = getTransactionOptions(options);
  const rewardConfig = await getGoalCompletionRewardConfig(goal, options);
  const summary = {
    pointsEarned: 0,
    badgeAwarded: null
  };

  if (rewardConfig.badgeCode) {
    const badgeResult = await issueBadge({
      userId: goal.userId,
      goalId: goal.id,
      badgeCode: rewardConfig.badgeCode,
      title: rewardConfig.badgeTitle,
      family: rewardConfig.badgeFamily,
      issueKey: `goal-completion-badge:${goal.id}`,
      issuedAt: recordedAt,
      metadata: {
        goalType: goal.goalType,
        totalDays: goal.totalDays,
        title: goal.title,
        rewardRole: goal.rewardRole,
        ...rewardConfig.metadata
      }
    }, options);

    if (badgeResult.badge && (
      goal.completionBadgeCode !== badgeResult.badge.badgeCode
      || goal.completionBadgeTitle !== badgeResult.badge.title
      || goal.completionBadgeIssuedAt !== badgeResult.badge.issuedAt
    )) {
      await goal.update({
        completionBadgeCode: badgeResult.badge.badgeCode,
        completionBadgeTitle: badgeResult.badge.title,
        completionBadgeIssuedAt: badgeResult.badge.issuedAt
      }, txOptions);
    }

    if (badgeResult.created) {
      summary.badgeAwarded = badgeResult.badge;
    }
  }

  if (goal.rewardRole === 'primary') {
    const amount = rewardConfig.points || 0;

    if (amount > 0) {
      const rewardResult = await postReward({
        userId: goal.userId,
        eventType: rewardConfig.eventType,
        amount,
        goalId: goal.id,
        logId,
        idempotencyKey: `goal-complete-points:${goal.id}`,
        recordedAt,
        metadata: {
          goalType: goal.goalType,
          totalDays: goal.totalDays,
          title: goal.title,
          ...rewardConfig.metadata
        }
      }, options);

      if (rewardResult.created && goal.completionPointsAwarded !== amount) {
        await goal.update({
          completionPointsAwarded: amount
        }, txOptions);
      }

      if (rewardResult.created) {
        summary.pointsEarned += amount;
      }
    }
  }

  return summary;
};

const settleLogRewards = async ({
  userId,
  logData,
  goalEvents = [],
  settlementTimestamp
}, options = {}) => {
  const settlementDateKey = formatDateKey(settlementTimestamp || Date.now());
  const rewardTimestamp = settlementTimestamp || Date.now();
  const summary = {
    pointsEarned: 0,
    badgeAwards: []
  };

  if (isRewardableLog(logData)) {
    const dailyLogReward = await postReward({
      userId,
      eventType: 'daily_valid_log',
      amount: DAILY_VALID_LOG_POINTS,
      logId: logData.id,
      idempotencyKey: `daily-valid-log:${userId}:${settlementDateKey}`,
      recordedAt: rewardTimestamp,
      metadata: {
        dateKey: settlementDateKey
      }
    }, options);

    if (dailyLogReward.created) {
      summary.pointsEarned += DAILY_VALID_LOG_POINTS;
    }
  }

  const primaryGoalEvent = goalEvents.find(event => event.goal && event.goal.rewardRole === 'primary');

  if (primaryGoalEvent) {
    const primaryGoalReward = await postReward({
      userId,
      eventType: 'daily_primary_goal_progress',
      amount: DAILY_PRIMARY_GOAL_POINTS,
      goalId: primaryGoalEvent.goal.id,
      logId: logData.id,
      idempotencyKey: `daily-primary-progress:${primaryGoalEvent.goal.id}:${settlementDateKey}`,
      recordedAt: rewardTimestamp,
      metadata: {
        dateKey: settlementDateKey,
        goalType: primaryGoalEvent.goal.goalType,
        title: primaryGoalEvent.goal.title
      }
    }, options);

    if (primaryGoalReward.created) {
      summary.pointsEarned += DAILY_PRIMARY_GOAL_POINTS;
    }
  }

  for (const goalEvent of goalEvents) {
    if (!goalEvent.completedNow) {
      continue;
    }

    const completionSummary = await settleGoalCompletionRewards({
      goal: goalEvent.goal,
      logId: logData.id,
      recordedAt: rewardTimestamp
    }, options);

    summary.pointsEarned += completionSummary.pointsEarned;

    if (completionSummary.badgeAwarded) {
      summary.badgeAwards.push(completionSummary.badgeAwarded);
    }
  }

  return summary;
};

const getRewardProfileSummary = async (userId) => {
  const profile = await getOrCreateRewardProfile(userId);
  const levelProgress = getLevelProgress(profile.lifetimePoints, profile.level);
  const latestBadges = await UserBadge.findAll({
    where: {
      userId,
      status: 'active'
    },
    order: [['issuedAt', 'DESC']],
    limit: 5
  });
  const totalBadgeCount = await UserBadge.count({
    where: {
      userId,
      status: 'active'
    }
  });

  return {
    availablePoints: profile.availablePoints,
    lifetimePoints: profile.lifetimePoints,
    spentPoints: profile.spentPoints,
    level: profile.level,
    ...levelProgress,
    totalBadgeCount,
    latestBadges: latestBadges.map(formatRewardBadge)
  };
};

const listUserBadges = async (userId, options = {}) => {
  const where = { userId };

  if (options.status) {
    where.status = options.status;
  }

  const badges = await UserBadge.findAll({
    where,
    order: [['issuedAt', 'DESC']]
  });

  let normalizedBadges = badges.map(formatRewardBadge);

  if (options.family) {
    normalizedBadges = normalizedBadges.filter((badge) => badge.family === options.family);
  }

  if (options.planScope) {
    normalizedBadges = normalizedBadges.filter((badge) => badge.planScope === options.planScope);
  }

  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(1, Math.min(options.limit, 100))
    : undefined;

  return limit ? normalizedBadges.slice(0, limit) : normalizedBadges;
};

const listRewardLedger = async (userId, limit = 20) => {
  return RewardLedger.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit
  });
};

module.exports = {
  DAILY_PRIMARY_GOAL_POINTS,
  DAILY_VALID_LOG_POINTS,
  GOAL_COMPLETION_POINTS,
  LEVEL_STEP_POINTS,
  getRewardLevel,
  getRewardProfileSummary,
  getOrCreateRewardProfile,
  issueBadge,
  listUserBadges,
  listRewardLedger,
  postReward,
  settleGoalCompletionRewards,
  settleLogRewards
};