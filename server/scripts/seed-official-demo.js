const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const sequelize = require('../config/database');
const User = require('../models/User');
const Log = require('../models/Log');
const Goal = require('../models/Goal');
const GoalCheckin = require('../models/GoalCheckin');
const FinanceRecord = require('../models/FinanceRecord');
const OfficialPlanTemplate = require('../models/OfficialPlanTemplate');
const RewardProfile = require('../models/RewardProfile');
const RewardLedger = require('../models/RewardLedger');
const UserBadge = require('../models/UserBadge');
const { ensureOfficialPlanTemplates } = require('../services/officialPlanService');
const {
  cleanupDuplicateUserUniqueIndexes,
  getDatabaseSyncMode,
  getDatabaseSyncOptions
} = require('../utils/databaseSync');
const { createGoalForUser, applyLogGoalCheckin } = require('../services/goalService');
const { issueBadge, postReward, settleLogRewards } = require('../services/rewardService');

const DEMO_ACCOUNT = {
  name: '官方案例账号',
  email: 'official-demo@lifepulse.ai',
  password: 'Demo@2026',
  source: 'official-case'
};

const LOG_BLUEPRINTS = [
  {
    rawText: '早上跑步 25 分钟，出了很多汗，感觉很清醒。',
    activity: '晨跑',
    category: 'Health',
    durationMinutes: 25,
    mood: '清醒',
    importance: 4,
    daysAgo: 9,
    hour: 7,
    minute: 20
  },
  {
    rawText: '上午写方案 90 分钟，开了两个会，有点累。',
    activity: '写方案',
    category: 'Work',
    durationMinutes: 90,
    mood: '有点累',
    importance: 5,
    daysAgo: 8,
    hour: 10,
    minute: 15
  },
  {
    rawText: '中午点了咖啡和三明治，一共花了 32 元。',
    activity: '午餐补给',
    category: 'Other',
    durationMinutes: 20,
    mood: '满足',
    importance: 3,
    daysAgo: 7,
    hour: 12,
    minute: 30,
    finance: {
      type: 'EXPENSE',
      amount: 32,
      category: '餐饮',
      description: '咖啡和三明治'
    }
  },
  {
    rawText: '晚上散步 30 分钟，顺手复盘了今天的工作。',
    activity: '晚间散步',
    category: 'Health',
    durationMinutes: 30,
    mood: '平静',
    importance: 4,
    daysAgo: 6,
    hour: 20,
    minute: 10
  },
  {
    rawText: '和朋友吃饭花了 86 元，聊得很开心。',
    activity: '朋友聚餐',
    category: 'Social',
    durationMinutes: 110,
    mood: '开心',
    importance: 4,
    daysAgo: 5,
    hour: 19,
    minute: 0,
    finance: {
      type: 'EXPENSE',
      amount: 86,
      category: '社交餐饮',
      description: '和朋友吃饭'
    }
  },
  {
    rawText: '周末整理房间 50 分钟，终于把桌面收拾干净了。',
    activity: '整理房间',
    category: 'Chores',
    durationMinutes: 50,
    mood: '轻松',
    importance: 3,
    daysAgo: 4,
    hour: 15,
    minute: 30
  },
  {
    rawText: '下班坐地铁回家花了 18 元，顺便买了水果。',
    activity: '通勤回家',
    category: 'Other',
    durationMinutes: 35,
    mood: '放松',
    importance: 3,
    daysAgo: 3,
    hour: 18,
    minute: 25,
    finance: {
      type: 'EXPENSE',
      amount: 18,
      category: '交通',
      description: '地铁回家'
    }
  },
  {
    rawText: '晚上做了 35 分钟拉伸，肩颈放松很多。',
    activity: '拉伸',
    category: 'Health',
    durationMinutes: 35,
    mood: '舒展',
    importance: 4,
    daysAgo: 2,
    hour: 21,
    minute: 5
  },
  {
    rawText: '收到一笔兼职结算 880 元，给这个月留出一点余地。',
    activity: '兼职结算',
    category: 'Work',
    durationMinutes: 15,
    mood: '踏实',
    importance: 4,
    daysAgo: 1,
    hour: 16,
    minute: 40,
    finance: {
      type: 'INCOME',
      amount: 880,
      category: '兼职收入',
      description: '兼职结算'
    }
  },
  {
    rawText: '下午读书 40 分钟，把上周标记的重点重新看了一遍。',
    activity: '读书复盘',
    category: 'Leisure',
    durationMinutes: 40,
    mood: '专注',
    importance: 4,
    daysAgo: 0,
    hour: 15,
    minute: 10
  }
];

const buildTimestampDaysAgo = (daysAgo, hour, minute) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

const buildLogs = () => LOG_BLUEPRINTS
  .map((item) => ({
    ...item,
    timestamp: buildTimestampDaysAgo(item.daysAgo, item.hour, item.minute)
  }))
  .sort((left, right) => left.timestamp - right.timestamp);

const DEMO_BADGES = [
  {
    key: 'official-early-sleep',
    sourceSlug: 'official-21-day-early-sleep',
    daysAgo: 1,
    hour: 21,
    minute: 20
  },
  {
    key: 'official-focus-reset',
    sourceSlug: 'official-7-day-focus-reset',
    daysAgo: 2,
    hour: 20,
    minute: 40
  },
  {
    key: 'personal-21-day',
    badgeCode: 'goal_21_day_completed',
    title: '21 天养成完成',
    family: 'goal_completion',
    rewardAmount: 60,
    eventType: 'goal_completed_21_day',
    metadata: {
      planScope: 'personal',
      shortTitle: '21 天完成',
      accentColor: '#10b981',
      theme: 'habit'
    },
    daysAgo: 3,
    hour: 19,
    minute: 30
  }
];

const resetDemoData = async (userId, transaction) => {
  await FinanceRecord.destroy({ where: { userId }, force: true, transaction });
  await GoalCheckin.destroy({ where: { userId }, force: true, transaction });
  await Log.destroy({ where: { userId }, force: true, transaction });
  await RewardLedger.destroy({ where: { userId }, transaction });
  await UserBadge.destroy({ where: { userId }, transaction });
  await Goal.destroy({ where: { userId }, force: true, transaction });
  await RewardProfile.destroy({ where: { userId }, transaction });
};

const getOrCreateDemoUser = async (transaction) => {
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [
        { name: DEMO_ACCOUNT.name },
        { email: DEMO_ACCOUNT.email }
      ]
    },
    transaction
  });

  if (existingUser) {
    existingUser.name = DEMO_ACCOUNT.name;
    existingUser.email = DEMO_ACCOUNT.email;
    existingUser.password = await bcrypt.hash(DEMO_ACCOUNT.password, 10);
    existingUser.source = DEMO_ACCOUNT.source;
    existingUser.isOfficial = true;
    await existingUser.save({ transaction });
    return existingUser;
  }

  return User.create({
    name: DEMO_ACCOUNT.name,
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
    source: DEMO_ACCOUNT.source,
    isOfficial: true
  }, { transaction });
};

const createSeedLog = async (userId, blueprint, transaction) => {
  const baseLog = {
    id: randomUUID(),
    userId,
    rawText: blueprint.rawText,
    activity: blueprint.activity,
    category: blueprint.category,
    durationMinutes: blueprint.durationMinutes,
    mood: blueprint.mood,
    importance: blueprint.importance,
    timestamp: blueprint.timestamp,
    metadata: {
      source: 'official-demo-seed',
      seededAt: Date.now(),
      originalText: blueprint.rawText
    },
    images: [],
    location: null
  };

  const { logData, goalEvents } = await applyLogGoalCheckin(userId, baseLog, {
    transaction,
    settlementTimestamp: blueprint.timestamp
  });

  await settleLogRewards({
    userId,
    logData,
    goalEvents,
    settlementTimestamp: blueprint.timestamp
  }, { transaction });

  return Log.create(logData, { transaction });
};

const createBadgeGrant = async ({ userId, badgeConfig, officialPlansBySlug }, transaction) => {
  const issuedAt = buildTimestampDaysAgo(badgeConfig.daysAgo, badgeConfig.hour, badgeConfig.minute);

  if (badgeConfig.sourceSlug) {
    const officialPlan = officialPlansBySlug.get(badgeConfig.sourceSlug);

    if (!officialPlan) {
      throw new Error(`缺少官方计划模板: ${badgeConfig.sourceSlug}`);
    }

    const badgeResult = await issueBadge({
      userId,
      badgeCode: officialPlan.badgeCode,
      title: officialPlan.badgeTitle,
      family: 'official_goal_completion',
      issueKey: `official-demo-badge:${badgeConfig.key}`,
      issuedAt,
      metadata: {
        planScope: 'official',
        shortTitle: officialPlan.badgeShortTitle,
        accentColor: officialPlan.accentColor,
        officialPlanId: officialPlan.id,
        officialPlanSlug: officialPlan.slug,
        officialPlanTitle: officialPlan.title,
        theme: officialPlan.metadata?.theme || null,
        source: 'official-demo-seed'
      }
    }, { transaction });

    await postReward({
      userId,
      eventType: 'official_plan_completed',
      amount: officialPlan.completionPoints,
      badgeId: badgeResult.badge.id,
      idempotencyKey: `official-demo-reward:${badgeConfig.key}`,
      recordedAt: issuedAt,
      metadata: {
        planScope: 'official',
        title: officialPlan.title,
        officialPlanId: officialPlan.id,
        officialPlanSlug: officialPlan.slug,
        officialPlanTitle: officialPlan.title,
        shortTitle: officialPlan.badgeShortTitle,
        accentColor: officialPlan.accentColor,
        theme: officialPlan.metadata?.theme || null,
        source: 'official-demo-seed'
      }
    }, { transaction });

    return;
  }

  const badgeResult = await issueBadge({
    userId,
    badgeCode: badgeConfig.badgeCode,
    title: badgeConfig.title,
    family: badgeConfig.family,
    issueKey: `official-demo-badge:${badgeConfig.key}`,
    issuedAt,
    metadata: {
      ...badgeConfig.metadata,
      source: 'official-demo-seed'
    }
  }, { transaction });

  await postReward({
    userId,
    eventType: badgeConfig.eventType,
    amount: badgeConfig.rewardAmount,
    badgeId: badgeResult.badge.id,
    idempotencyKey: `official-demo-reward:${badgeConfig.key}`,
    recordedAt: issuedAt,
    metadata: {
      title: badgeConfig.title,
      ...badgeConfig.metadata,
      source: 'official-demo-seed'
    }
  }, { transaction });
};

const main = async () => {
  try {
    const removedIndexes = await cleanupDuplicateUserUniqueIndexes(sequelize);
    if (removedIndexes.length) {
      console.log(`Removed duplicate user indexes before seed: ${removedIndexes.join(', ')}`);
    }

    console.log(`Database sync mode: ${getDatabaseSyncMode()}`);
    await sequelize.sync(getDatabaseSyncOptions());
    await ensureOfficialPlanTemplates();

    const transaction = await sequelize.transaction();

    try {
      const demoUser = await getOrCreateDemoUser(transaction);
      await resetDemoData(demoUser.id, transaction);
      await RewardProfile.create({ userId: demoUser.id }, { transaction });

      const officialPlans = await OfficialPlanTemplate.findAll({ transaction });
      const officialPlansBySlug = new Map(officialPlans.map((plan) => [plan.slug, plan]));
      const activePlan = officialPlansBySlug.get('official-21-day-exercise-rhythm');

      if (!activePlan) {
        throw new Error('缺少官方活跃计划模板: official-21-day-exercise-rhythm');
      }

      const logs = buildLogs();
      const activeGoal = await createGoalForUser(demoUser.id, {
        officialPlanTemplateId: activePlan.id
      }, { transaction });

      await activeGoal.update({
        startedAt: logs[0].timestamp,
        metadata: {
          ...(activeGoal.metadata || {}),
          source: 'official-demo-seed',
          seededAt: Date.now()
        }
      }, { transaction });

      for (const blueprint of logs) {
        const createdLog = await createSeedLog(demoUser.id, blueprint, transaction);

        if (blueprint.finance) {
          await FinanceRecord.create({
            userId: demoUser.id,
            logId: createdLog.id,
            type: blueprint.finance.type,
            amount: blueprint.finance.amount,
            category: blueprint.finance.category,
            description: blueprint.finance.description,
            transactionDate: new Date(blueprint.timestamp)
          }, { transaction });
        }
      }

      for (const badgeConfig of DEMO_BADGES) {
        await createBadgeGrant({ userId: demoUser.id, badgeConfig, officialPlansBySlug }, transaction);
      }

      await transaction.commit();

      const [logCount, activeGoalCount, financeCount, badgeCount] = await Promise.all([
        Log.count({ where: { userId: demoUser.id } }),
        Goal.count({ where: { userId: demoUser.id, status: 'active' } }),
        FinanceRecord.count({ where: { userId: demoUser.id } }),
        UserBadge.count({ where: { userId: demoUser.id, status: 'active' } })
      ]);

      console.log('Official demo account seeded successfully.');
      console.log(`账号昵称: ${DEMO_ACCOUNT.name}`);
      console.log(`登录邮箱: ${DEMO_ACCOUNT.email}`);
      console.log(`登录密码: ${DEMO_ACCOUNT.password}`);
      console.log(`日志数量: ${logCount}`);
      console.log(`活跃目标: ${activeGoalCount}`);
      console.log(`财务记录: ${financeCount}`);
      console.log(`徽章数量: ${badgeCount}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Failed to seed official demo account:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
};

main();