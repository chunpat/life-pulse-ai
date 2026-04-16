# LifePulse AI 计划与 iOS 同步规则说明

这份文档描述的是当前代码里的已实现行为，主要对应：

- `services/planService.ts`
- `services/planSyncService.ts`
- `components/PlanCenter.tsx`
- `App.tsx`
- `server/routes/plans.js`
- `server/services/planService.js`
- `server/models/Plan.js`
- `plugins/iosPlanSync.ts`
- `plugins/iosPlanSync.web.ts`
- `ios/App/App/LifePulsePlanSyncPlugin.swift`

它不是未来规划文档，而是给后续改计划和同步逻辑的人快速对齐当前现状。

## 1. 计划数据分层

当前计划逻辑分三层：

- 后端计划业务：负责 CRUD、字段校验、状态流转
- 前端计划展示：负责列表、时间轴、完成和取消等交互
- 前端 iOS 同步层：负责把计划写入原生日历 / 提醒事项，并维护本地 binding 与删除队列

重点：当前 iOS 同步不是后端职责，而是前端在 authenticated 用户下协同完成的。

## 2. 当前计划类型与状态

### 计划类型

- `reminder`
- `event`

### 计划状态

- `pending`
- `completed`
- `cancelled`

### 计划来源

- `manual`
- `ai`
- `imported`

### 同步目标

- `none`
- `ios-reminder`
- `ios-calendar`

### 同步状态

- `local-only`
- `pending-sync`
- `synced`
- `conflict`
- `permission-denied`
- `failed`

这些枚举同时存在于前端 `types.ts`、后端 `server/services/planService.js` 和 `server/models/Plan.js`，改动时必须一起核对。

## 3. 后端计划接口现状

当前前端主要通过 `services/planService.ts` 调用这些接口：

- `GET /api/plans`
- `GET /api/plans/:id`
- `POST /api/plans`
- `PUT /api/plans/:id`
- `POST /api/plans/:id/complete`
- `POST /api/plans/:id/cancel`
- `DELETE /api/plans/:id`

后端还提供：

- `GET /api/plans/calendar`

当前 `/calendar` 实际仍走 `listPlans`，并不是独立日历查询逻辑。

## 4. 当前后端校验规则

后端计划校验主要在 `server/services/planService.js` 的 `buildPlanPayload` 和 `validatePlanTime`。

### 标题与类型

- 新建计划必须有标题
- `planType` 只支持 `reminder` 和 `event`
- `status`、`source`、`syncTarget`、`syncState` 都有白名单校验

### 时间字段

- `startAt`、`endAt`、`dueAt`、`reminderAt` 都按时间戳处理
- `endAt` 不能早于 `startAt`
- `pending` 且非 `imported` 的计划会校验“计划时间不能早于现在”
- `isAllDay` 计划按时区 dateKey 比较是否过期

### 创建 / 更新 / 完成 / 取消

- 新建时通过 `Plan.create`
- 更新时会基于旧数据合并 payload
- 完成和取消会把 `status` 改掉
- 如果 `syncTarget !== 'none'`，完成或取消后会把 `syncState` 置为 `pending-sync`

### 删除

- 后端删除当前是直接 `destroy`
- `Plan` 模型启用了 `paranoid: true`，因此是软删除

## 5. 前端计划调用链现状

### 创建计划

当前在 `App.tsx` 的 `handleCreatePlan`：

1. 调后端 `createPlan`
2. 调 `syncPlanStateToIos`
3. 调 `refreshPlans`

### 完成 / 取消计划

当前在 `App.tsx`：

1. 调后端 complete / cancel
2. 调 `syncPlanStateToIos`
3. 调 `refreshPlans`

### 删除计划

当前在 `App.tsx` 的 `handleDeletePlan`：

1. 先从前端列表里临时移除
2. 调后端 `DELETE /api/plans/:id`
3. 如果本地有这条计划对象，再调用 `planSyncService.deletePlan`
4. 最后 `refreshPlans`

重点：删除计划时，iOS 删除不是后端自动完成，而是前端额外调用同步层处理。

## 6. iOS 同步层现状

当前同步核心在 `services/planSyncService.ts`。

### 它负责什么

- 判断一个计划是否需要同步
- 根据计划字段计算 fingerprint
- 调原生插件 upsert / delete
- 在 localStorage 里维护 binding
- 在 localStorage 里维护删除失败后的重试队列

### 当前参与 fingerprint 的字段

- `title`
- `notes`
- `planType`
- `status`
- `startAt`
- `endAt`
- `dueAt`
- `isAllDay`
- `timezone`
- `reminderAt`
- `syncTarget`

如果改这些字段的语义或默认值，要重新评估同步是否会被误判为“未变化”。

### 当前 binding 本地存储

- key: `lifepulse_ios_plan_bindings_v1`

binding 中记录：

- `planId`
- `syncTarget`
- `externalId`
- `externalContainerId`
- `lastSyncedAt`
- `lastKnownFingerprint`

### 当前删除队列本地存储

- key: `lifepulse_ios_plan_delete_queue_v1`

删除失败时会把原生删除任务放入本地队列，后续 authenticated 用户登录后会尝试 `flushPendingDeletions`。

## 7. Web 与原生差异

### Web

- `plugins/iosPlanSync.web.ts` 返回 `unavailable`
- `upsertPlan` / `deletePlan` 在 Web 下都返回 `failed`
- 原生权限状态在 Web 下也是 `unavailable`

### 原生 iOS

- `runtimeConfig.isNativeIos` 为真时，计划同步层才真正可用
- 只有 `ios-reminder` 和 `ios-calendar` 会触发原生写入

因此：Web 场景的同步相关改动，不能假设一定真的写入系统日历或提醒事项。

## 8. 前端展示层现状

当前计划主要展示在 `components/PlanCenter.tsx`：

- 支持 `board` 和 `schedule` 两种视图
- 前端会根据 `status` 和时间戳推导 `pending` / `overdue` / `completed` / `cancelled` 视图桶
- 时间展示优先取 reminder / due / start 等主时间字段

说明：计划展示桶不完全等于后端 `status`，因为前端还会根据时间推导 `overdue`。

## 9. 修改计划或同步时必须一起检查的文件

- `types.ts`
- `services/planService.ts`
- `services/planSyncService.ts`
- `components/PlanCenter.tsx`
- `App.tsx`
- `server/routes/plans.js`
- `server/services/planService.js`
- `server/models/Plan.js`
- `plugins/iosPlanSync.ts`
- `plugins/iosPlanSync.web.ts`
- `ios/App/App/LifePulsePlanSyncPlugin.swift`

## 10. 最低手测建议

- 新建一条 `reminder` 计划
- 新建一条 `event` 计划
- 测一次完成计划
- 测一次取消计划
- 测一次删除计划
- 如果改动涉及同步：验证 Web 下不报错，iOS 下同步状态能正确更新
- 如果改动涉及字段：验证前端展示、后端落库、同步 fingerprint 三者一致
