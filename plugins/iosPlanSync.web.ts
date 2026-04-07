import { WebPlugin } from '@capacitor/core';
import type {
  DeleteNativePlanOptions,
  IOSPlanSyncPlugin,
  NativePlanSyncResult,
  PlanAuthorizationStatusResult,
  UpsertNativePlanOptions
} from './iosPlanSync';

const unavailableMessage = 'iOS 计划同步插件仅在原生 iOS 容器中可用';

export class IOSPlanSyncWeb extends WebPlugin implements IOSPlanSyncPlugin {
  async getAuthorizationStatus(): Promise<PlanAuthorizationStatusResult> {
    return {
      calendar: 'unavailable',
      reminder: 'unavailable'
    };
  }

  async requestPermissions(): Promise<PlanAuthorizationStatusResult> {
    return this.getAuthorizationStatus();
  }

  async upsertPlan(_options: UpsertNativePlanOptions): Promise<NativePlanSyncResult> {
    return {
      syncState: 'failed',
      message: unavailableMessage,
      externalId: null,
      externalContainerId: null
    };
  }

  async deletePlan(_options: DeleteNativePlanOptions): Promise<NativePlanSyncResult> {
    return {
      syncState: 'failed',
      message: unavailableMessage,
      externalId: null,
      externalContainerId: null
    };
  }
}