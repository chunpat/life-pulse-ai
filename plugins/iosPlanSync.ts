import { registerPlugin } from '@capacitor/core';
import type { Plan, PlanSyncState, PlanSyncTarget } from '../types';

export type NativePermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';
export type NativePlanSyncTarget = Exclude<PlanSyncTarget, 'none'>;
export type NativePlanPayload = Pick<
  Plan,
  'id' | 'title' | 'notes' | 'planType' | 'status' | 'startAt' | 'endAt' | 'dueAt' | 'isAllDay' | 'timezone' | 'reminderAt' | 'syncTarget'
>;

export interface PlanAuthorizationStatusResult {
  calendar: NativePermissionState;
  reminder: NativePermissionState;
}

export interface UpsertNativePlanOptions {
  plan: NativePlanPayload;
  existingExternalId?: string | null;
  existingContainerId?: string | null;
}

export interface DeleteNativePlanOptions {
  syncTarget: NativePlanSyncTarget;
  externalId: string;
  externalContainerId?: string | null;
}

export interface NativePlanSyncResult {
  syncState: Extract<PlanSyncState, 'synced' | 'permission-denied' | 'failed'>;
  externalId?: string | null;
  externalContainerId?: string | null;
  message?: string;
}

export interface IOSPlanSyncPlugin {
  getAuthorizationStatus(): Promise<PlanAuthorizationStatusResult>;
  requestPermissions(options: { syncTarget: NativePlanSyncTarget }): Promise<PlanAuthorizationStatusResult>;
  upsertPlan(options: UpsertNativePlanOptions): Promise<NativePlanSyncResult>;
  deletePlan(options: DeleteNativePlanOptions): Promise<NativePlanSyncResult>;
}

export const iosPlanSyncPlugin = registerPlugin<IOSPlanSyncPlugin>('LifePulsePlanSync', {
  web: () => import('./iosPlanSync.web').then((module) => new module.IOSPlanSyncWeb())
});