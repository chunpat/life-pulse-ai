import type { Plan, PlanSyncState, PlanSyncTarget } from '../types';
import { iosPlanSyncPlugin, type NativePlanSyncTarget } from '../plugins/iosPlanSync';
import { runtimeConfig } from './runtimeConfig';

const PLAN_BINDINGS_STORAGE_KEY = 'lifepulse_ios_plan_bindings_v1';
const PLAN_DELETE_QUEUE_STORAGE_KEY = 'lifepulse_ios_plan_delete_queue_v1';

type SyncablePlanTarget = Exclude<PlanSyncTarget, 'none'>;

export interface NativePlanBinding {
  planId: string;
  syncTarget: SyncablePlanTarget;
  externalId: string;
  externalContainerId?: string | null;
  lastSyncedAt: number;
  lastKnownFingerprint: string;
}

interface PendingNativePlanDeletion {
  planId: string;
  syncTarget: SyncablePlanTarget;
  externalId: string;
  externalContainerId?: string | null;
  queuedAt: number;
  attempts: number;
}

export interface PlanSyncOutcome {
  planId: string;
  syncState: PlanSyncState;
  performed: boolean;
  reason?: string;
  binding?: NativePlanBinding | null;
}

const isSyncableTarget = (value: PlanSyncTarget): value is SyncablePlanTarget => {
  return value === 'ios-reminder' || value === 'ios-calendar';
};

const readStorageValue = <T,>(storageKey: string, fallback: T): T => {
  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Failed to parse ${storageKey}`, error);
    return fallback;
  }
};

const writeStorageValue = <T,>(storageKey: string, value: T) => {
  localStorage.setItem(storageKey, JSON.stringify(value));
};

const getStoredBindings = () => readStorageValue<Record<string, NativePlanBinding>>(PLAN_BINDINGS_STORAGE_KEY, {});

const saveStoredBindings = (bindings: Record<string, NativePlanBinding>) => {
  writeStorageValue(PLAN_BINDINGS_STORAGE_KEY, bindings);
};

const getPendingDeletionQueue = () => readStorageValue<PendingNativePlanDeletion[]>(PLAN_DELETE_QUEUE_STORAGE_KEY, []);

const savePendingDeletionQueue = (queue: PendingNativePlanDeletion[]) => {
  writeStorageValue(PLAN_DELETE_QUEUE_STORAGE_KEY, queue);
};

const computePlanFingerprint = (plan: Plan) => {
  return JSON.stringify({
    title: plan.title,
    notes: plan.notes || null,
    planType: plan.planType,
    status: plan.status,
    startAt: plan.startAt || null,
    endAt: plan.endAt || null,
    dueAt: plan.dueAt || null,
    isAllDay: plan.isAllDay,
    timezone: plan.timezone || null,
    reminderAt: plan.reminderAt || null,
    syncTarget: plan.syncTarget
  });
};

const queuePlanDeletion = (entry: PendingNativePlanDeletion) => {
  const queue = getPendingDeletionQueue().filter((item) => item.planId !== entry.planId);
  queue.push(entry);
  savePendingDeletionQueue(queue);
};

const clearQueuedDeletion = (planId: string) => {
  const queue = getPendingDeletionQueue().filter((item) => item.planId !== planId);
  savePendingDeletionQueue(queue);
};

const normalizeFailureState = (message?: string): Extract<PlanSyncState, 'permission-denied' | 'failed'> => {
  if (message?.includes('denied') || message?.includes('权限')) {
    return 'permission-denied';
  }

  return 'failed';
};

const toNativeTarget = (syncTarget: SyncablePlanTarget): NativePlanSyncTarget => syncTarget;

export const planSyncService = {
  isAvailable() {
    return runtimeConfig.isNativeIos;
  },

  getBinding(planId: string) {
    return getStoredBindings()[planId] || null;
  },

  shouldSyncPlan(plan: Plan) {
    return isSyncableTarget(plan.syncTarget);
  },

  async syncPlan(plan: Plan): Promise<PlanSyncOutcome> {
    if (!isSyncableTarget(plan.syncTarget)) {
      return {
        planId: plan.id,
        syncState: plan.syncState,
        performed: false,
        binding: this.getBinding(plan.id)
      };
    }

    if (!this.isAvailable()) {
      return {
        planId: plan.id,
        syncState: 'failed',
        performed: false,
        reason: 'iOS 计划同步仅在原生 iOS 容器中可用',
        binding: this.getBinding(plan.id)
      };
    }

    if (plan.status === 'cancelled') {
      return this.deletePlan(plan);
    }

    const currentBinding = this.getBinding(plan.id);
    const nextFingerprint = computePlanFingerprint(plan);

    if (plan.syncState === 'synced' && currentBinding?.lastKnownFingerprint === nextFingerprint) {
      return {
        planId: plan.id,
        syncState: 'synced',
        performed: false,
        binding: currentBinding
      };
    }

    try {
      const pluginResult = await iosPlanSyncPlugin.upsertPlan({
        plan: {
          id: plan.id,
          title: plan.title,
          notes: plan.notes || null,
          planType: plan.planType,
          status: plan.status,
          startAt: plan.startAt || null,
          endAt: plan.endAt || null,
          dueAt: plan.dueAt || null,
          isAllDay: plan.isAllDay,
          timezone: plan.timezone || null,
          reminderAt: plan.reminderAt || null,
          syncTarget: plan.syncTarget
        },
        existingExternalId: currentBinding?.externalId || null,
        existingContainerId: currentBinding?.externalContainerId || null
      });

      if (pluginResult.syncState !== 'synced' || !pluginResult.externalId) {
        return {
          planId: plan.id,
          syncState: pluginResult.syncState,
          performed: true,
          reason: pluginResult.message,
          binding: currentBinding
        };
      }

      const nextBinding: NativePlanBinding = {
        planId: plan.id,
        syncTarget: plan.syncTarget,
        externalId: pluginResult.externalId,
        externalContainerId: pluginResult.externalContainerId || null,
        lastSyncedAt: Date.now(),
        lastKnownFingerprint: nextFingerprint
      };

      const bindings = getStoredBindings();
      bindings[plan.id] = nextBinding;
      saveStoredBindings(bindings);
      clearQueuedDeletion(plan.id);

      return {
        planId: plan.id,
        syncState: 'synced',
        performed: true,
        binding: nextBinding
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步到 iOS 失败';
      return {
        planId: plan.id,
        syncState: normalizeFailureState(message),
        performed: true,
        reason: message,
        binding: currentBinding
      };
    }
  },

  async deletePlan(plan: Pick<Plan, 'id' | 'syncTarget'>): Promise<PlanSyncOutcome> {
    if (!isSyncableTarget(plan.syncTarget)) {
      return {
        planId: plan.id,
        syncState: 'synced',
        performed: false,
        binding: null
      };
    }

    const currentBinding = this.getBinding(plan.id);
    if (!currentBinding) {
      clearQueuedDeletion(plan.id);
      return {
        planId: plan.id,
        syncState: 'synced',
        performed: false,
        binding: null
      };
    }

    const queuedEntry: PendingNativePlanDeletion = {
      planId: plan.id,
      syncTarget: currentBinding.syncTarget,
      externalId: currentBinding.externalId,
      externalContainerId: currentBinding.externalContainerId || null,
      queuedAt: Date.now(),
      attempts: 0
    };

    if (!this.isAvailable()) {
      queuePlanDeletion(queuedEntry);
      return {
        planId: plan.id,
        syncState: 'failed',
        performed: false,
        reason: 'iOS 计划同步仅在原生 iOS 容器中可用',
        binding: currentBinding
      };
    }

    try {
      const pluginResult = await iosPlanSyncPlugin.deletePlan({
        syncTarget: toNativeTarget(currentBinding.syncTarget),
        externalId: currentBinding.externalId,
        externalContainerId: currentBinding.externalContainerId || null
      });

      if (pluginResult.syncState !== 'synced') {
        queuePlanDeletion(queuedEntry);
        return {
          planId: plan.id,
          syncState: pluginResult.syncState,
          performed: true,
          reason: pluginResult.message,
          binding: currentBinding
        };
      }

      const bindings = getStoredBindings();
      delete bindings[plan.id];
      saveStoredBindings(bindings);
      clearQueuedDeletion(plan.id);

      return {
        planId: plan.id,
        syncState: 'synced',
        performed: true,
        binding: null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除 iOS 系统计划失败';
      queuePlanDeletion(queuedEntry);
      return {
        planId: plan.id,
        syncState: normalizeFailureState(message),
        performed: true,
        reason: message,
        binding: currentBinding
      };
    }
  },

  async flushPendingDeletions() {
    if (!this.isAvailable()) {
      return [] as PlanSyncOutcome[];
    }

    const queue = getPendingDeletionQueue();
    const outcomes: PlanSyncOutcome[] = [];
    const nextQueue: PendingNativePlanDeletion[] = [];

    for (const entry of queue) {
      try {
        const pluginResult = await iosPlanSyncPlugin.deletePlan({
          syncTarget: toNativeTarget(entry.syncTarget),
          externalId: entry.externalId,
          externalContainerId: entry.externalContainerId || null
        });

        if (pluginResult.syncState === 'synced') {
          const bindings = getStoredBindings();
          delete bindings[entry.planId];
          saveStoredBindings(bindings);
          outcomes.push({
            planId: entry.planId,
            syncState: 'synced',
            performed: true,
            binding: null
          });
          continue;
        }

        nextQueue.push({
          ...entry,
          attempts: entry.attempts + 1
        });
        outcomes.push({
          planId: entry.planId,
          syncState: pluginResult.syncState,
          performed: true,
          reason: pluginResult.message,
          binding: this.getBinding(entry.planId)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '刷新 iOS 删除队列失败';
        nextQueue.push({
          ...entry,
          attempts: entry.attempts + 1
        });
        outcomes.push({
          planId: entry.planId,
          syncState: normalizeFailureState(message),
          performed: true,
          reason: message,
          binding: this.getBinding(entry.planId)
        });
      }
    }

    savePendingDeletionQueue(nextQueue);
    return outcomes;
  }
};