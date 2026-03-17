const OfficialPlanTemplate = require('../models/OfficialPlanTemplate');

const DEFAULT_OFFICIAL_PLAN_TEMPLATES = [
  {
    slug: 'official-21-day-early-sleep',
    title: '官方计划 · 21 天早睡重启',
    subtitle: '用连续记录把睡前节奏拉回正轨',
    description: '连续 21 天保持晚间记录，让早睡从口号变成稳定动作。',
    goalType: '21_DAY',
    totalDays: 21,
    completionPoints: 30,
    badgeCode: 'official_early_sleep_21',
    badgeTitle: '官方徽章 · 早睡重启',
    badgeShortTitle: '早睡重启',
    accentColor: '#f59e0b',
    displayOrder: 1,
    metadata: {
      theme: 'sleep'
    }
  },
  {
    slug: 'official-7-day-focus-reset',
    title: '官方计划 · 7 天专注回归',
    subtitle: '适合重新找回工作和记录节奏',
    description: '连续 7 天记录当日的核心投入，快速重建稳定输出感。',
    goalType: '7_DAY',
    totalDays: 7,
    completionPoints: 26,
    badgeCode: 'official_focus_reset_7',
    badgeTitle: '官方徽章 · 专注回归',
    badgeShortTitle: '专注回归',
    accentColor: '#d97706',
    displayOrder: 2,
    metadata: {
      theme: 'focus'
    }
  },
  {
    slug: 'official-21-day-exercise-rhythm',
    title: '官方计划 · 21 天运动节律',
    subtitle: '把运动从偶尔想起变成日常回路',
    description: '连续 21 天完成运动相关记录，建立稳定的身体反馈闭环。',
    goalType: '21_DAY',
    totalDays: 21,
    completionPoints: 36,
    badgeCode: 'official_exercise_rhythm_21',
    badgeTitle: '官方徽章 · 运动节律',
    badgeShortTitle: '运动节律',
    accentColor: '#c2410c',
    displayOrder: 3,
    metadata: {
      theme: 'exercise'
    }
  }
];

const getTransactionOptions = (options = {}) => (options.transaction ? { transaction: options.transaction } : {});

const ensureOfficialPlanTemplates = async () => {
  for (const template of DEFAULT_OFFICIAL_PLAN_TEMPLATES) {
    const existing = await OfficialPlanTemplate.findOne({ where: { slug: template.slug } });

    if (existing) {
      await existing.update(template);
      continue;
    }

    await OfficialPlanTemplate.create(template);
  }
};

const getPublishedOfficialPlans = async () => {
  return OfficialPlanTemplate.findAll({
    where: { isPublished: true },
    order: [['displayOrder', 'ASC'], ['createdAt', 'ASC']]
  });
};

const getOfficialPlanTemplateById = async (officialPlanId, options = {}) => {
  if (!officialPlanId) {
    return null;
  }

  const txOptions = getTransactionOptions(options);
  const where = options.includeUnpublished
    ? { id: officialPlanId }
    : { id: officialPlanId, isPublished: true };

  return OfficialPlanTemplate.findOne({ where, ...txOptions });
};

module.exports = {
  DEFAULT_OFFICIAL_PLAN_TEMPLATES,
  ensureOfficialPlanTemplates,
  getOfficialPlanTemplateById,
  getPublishedOfficialPlans
};