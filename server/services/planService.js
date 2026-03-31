const { Op } = require('sequelize');
const Plan = require('../models/Plan');

const PLAN_TYPES = new Set(['reminder', 'event']);
const PLAN_STATUSES = new Set(['pending', 'completed', 'cancelled']);
const PLAN_SOURCES = new Set(['manual', 'ai', 'imported']);
const PLAN_SYNC_TARGETS = new Set(['none', 'ios-reminder', 'ios-calendar']);
const PLAN_SYNC_STATES = new Set(['local-only', 'pending-sync', 'synced', 'conflict', 'permission-denied', 'failed']);

const sanitizeText = (value, maxLength = 255) => {
  if (typeof value !== 'string') return null;
  const sanitized = value.trim();
  if (!sanitized) return null;
  return sanitized.slice(0, maxLength);
};

const normalizeTimestamp = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  if (typeof value === 'number') return value === 1;
  return fallback;
};

const buildPlanPayload = (input, existingPlan = null) => {
  const title = sanitizeText(input.title, 120);
  if (!title && !existingPlan) {
    throw new Error('计划标题不能为空');
  }

  const planType = input.planType ?? existingPlan?.planType ?? 'reminder';
  if (!PLAN_TYPES.has(planType)) {
    throw new Error('不支持的计划类型');
  }

  const status = input.status ?? existingPlan?.status ?? 'pending';
  if (!PLAN_STATUSES.has(status)) {
    throw new Error('不支持的计划状态');
  }

  const source = input.source ?? existingPlan?.source ?? 'manual';
  if (!PLAN_SOURCES.has(source)) {
    throw new Error('不支持的计划来源');
  }

  const syncTarget = input.syncTarget ?? existingPlan?.syncTarget ?? 'none';
  if (!PLAN_SYNC_TARGETS.has(syncTarget)) {
    throw new Error('不支持的同步目标');
  }

  const syncState = input.syncState ?? existingPlan?.syncState ?? (syncTarget === 'none' ? 'local-only' : 'pending-sync');
  if (!PLAN_SYNC_STATES.has(syncState)) {
    throw new Error('不支持的同步状态');
  }

  const startAt = Object.prototype.hasOwnProperty.call(input, 'startAt')
    ? normalizeTimestamp(input.startAt)
    : existingPlan?.startAt ?? null;
  const endAt = Object.prototype.hasOwnProperty.call(input, 'endAt')
    ? normalizeTimestamp(input.endAt)
    : existingPlan?.endAt ?? null;
  const dueAt = Object.prototype.hasOwnProperty.call(input, 'dueAt')
    ? normalizeTimestamp(input.dueAt)
    : existingPlan?.dueAt ?? null;
  const reminderAt = Object.prototype.hasOwnProperty.call(input, 'reminderAt')
    ? normalizeTimestamp(input.reminderAt)
    : existingPlan?.reminderAt ?? null;

  if (startAt && endAt && endAt < startAt) {
    throw new Error('结束时间不能早于开始时间');
  }

  return {
    title: title || existingPlan.title,
    notes: Object.prototype.hasOwnProperty.call(input, 'notes')
      ? sanitizeText(input.notes, 2000)
      : existingPlan?.notes ?? null,
    planType,
    status,
    source,
    startAt,
    endAt,
    dueAt,
    isAllDay: Object.prototype.hasOwnProperty.call(input, 'isAllDay')
      ? normalizeBoolean(input.isAllDay, false)
      : existingPlan?.isAllDay ?? false,
    timezone: Object.prototype.hasOwnProperty.call(input, 'timezone')
      ? sanitizeText(input.timezone, 100)
      : existingPlan?.timezone ?? null,
    reminderAt,
    syncTarget,
    syncState,
    externalId: Object.prototype.hasOwnProperty.call(input, 'externalId')
      ? sanitizeText(input.externalId, 255)
      : existingPlan?.externalId ?? null,
    externalContainerId: Object.prototype.hasOwnProperty.call(input, 'externalContainerId')
      ? sanitizeText(input.externalContainerId, 255)
      : existingPlan?.externalContainerId ?? null,
    metadata: typeof input.metadata === 'object' && input.metadata !== null
      ? input.metadata
      : existingPlan?.metadata ?? {}
  };
};

const getPlanByIdForUser = async (userId, planId) => {
  const plan = await Plan.findOne({ where: { id: planId, userId } });
  if (!plan) {
    throw new Error('计划不存在');
  }

  return plan;
};

const buildRangeFilter = (startDate, endDate) => {
  const startTimestamp = normalizeTimestamp(startDate);
  const endTimestamp = normalizeTimestamp(endDate);

  if (!startTimestamp && !endTimestamp) {
    return null;
  }

  const rangeStart = startTimestamp ?? 0;
  const rangeEnd = endTimestamp ?? Date.now() + 365 * 24 * 60 * 60 * 1000;

  return {
    [Op.or]: [
      { startAt: { [Op.between]: [rangeStart, rangeEnd] } },
      { endAt: { [Op.between]: [rangeStart, rangeEnd] } },
      { dueAt: { [Op.between]: [rangeStart, rangeEnd] } },
      {
        startAt: { [Op.lte]: rangeStart },
        endAt: { [Op.gte]: rangeEnd }
      }
    ]
  };
};

const listPlans = async (userId, query = {}) => {
  const where = { userId };

  if (query.status && PLAN_STATUSES.has(query.status)) {
    where.status = query.status;
  }

  if (query.planType && PLAN_TYPES.has(query.planType)) {
    where.planType = query.planType;
  }

  if (query.syncTarget && PLAN_SYNC_TARGETS.has(query.syncTarget)) {
    where.syncTarget = query.syncTarget;
  }

  const keyword = sanitizeText(query.keyword, 120);
  if (keyword) {
    where[Op.or] = [
      { title: { [Op.like]: `%${keyword}%` } },
      { notes: { [Op.like]: `%${keyword}%` } }
    ];
  }

  const rangeFilter = buildRangeFilter(query.startDate, query.endDate);
  if (rangeFilter) {
    where[Op.and] = [...(where[Op.and] || []), rangeFilter];
  }

  const limit = Number(query.limit);

  return Plan.findAll({
    where,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    order: [
      ['startAt', 'ASC'],
      ['dueAt', 'ASC'],
      ['createdAt', 'DESC']
    ]
  });
};

const getPlan = async (userId, planId) => getPlanByIdForUser(userId, planId);

const createPlan = async (userId, input) => {
  const payload = buildPlanPayload(input);
  return Plan.create({ userId, ...payload });
};

const updatePlan = async (userId, planId, input) => {
  const plan = await getPlanByIdForUser(userId, planId);
  const payload = buildPlanPayload(input, plan);
  await plan.update(payload);
  return plan;
};

const completePlan = async (userId, planId) => {
  const plan = await getPlanByIdForUser(userId, planId);
  await plan.update({
    status: 'completed',
    syncState: plan.syncTarget === 'none' ? plan.syncState : 'pending-sync'
  });
  return plan;
};

const cancelPlan = async (userId, planId) => {
  const plan = await getPlanByIdForUser(userId, planId);
  await plan.update({
    status: 'cancelled',
    syncState: plan.syncTarget === 'none' ? plan.syncState : 'pending-sync'
  });
  return plan;
};

const deletePlan = async (userId, planId) => {
  const plan = await getPlanByIdForUser(userId, planId);
  await plan.destroy();
};

module.exports = {
  cancelPlan,
  completePlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan
};