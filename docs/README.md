# LifePulse AI 文档索引

这个目录收口了仓库里给人和代码助手共用的开发说明。建议把这里当作总入口，再按需求跳到专项文档。

## 文档元信息

- 适用范围：仓库开发、代码修改、AI 代理协作
- 最后整理：2026-04-16
- 使用方式：先看总览，再按需求或按文件跳到专项文档

## 快速入口

- 总体开发指南：`docs/ai-dev-guide.md`
- 功能改动清单：`docs/feature-change-checklist.md`
- 接口变更模板：`docs/interface-change-template.md`

## 领域规则

- 目标 / 积分 / 徽章当前实现：`docs/goals-rewards-domain-guide.md`
- 计划 / iOS 同步当前实现：`docs/plans-ios-sync-domain-guide.md`
- 登录 / 鉴权 / 本地同步当前实现：`docs/auth-and-sync-domain-guide.md`
- AI 分流 / 日志解析当前实现：`docs/ai-routing-log-domain-guide.md`

## 按文件找文档

### 前端入口文件

- `App.tsx`：优先看 `docs/ai-dev-guide.md`、`docs/auth-and-sync-domain-guide.md`
- `components/Logger.tsx`：优先看 `docs/ai-routing-log-domain-guide.md`、`docs/goals-rewards-domain-guide.md`
- `components/GoalPlanner.tsx`：优先看 `docs/goals-rewards-domain-guide.md`
- `components/PlanCenter.tsx`：优先看 `docs/plans-ios-sync-domain-guide.md`
- `components/Auth.tsx`：优先看 `docs/auth-and-sync-domain-guide.md`

### 前端 service / 类型

- `services/qwenService.ts`：优先看 `docs/ai-routing-log-domain-guide.md`
- `services/goalService.ts`：优先看 `docs/goals-rewards-domain-guide.md`
- `services/planService.ts`：优先看 `docs/plans-ios-sync-domain-guide.md`
- `services/planSyncService.ts`：优先看 `docs/plans-ios-sync-domain-guide.md`
- `services/authService.ts` / `services/apiClient.ts` / `services/storageService.ts` / `services/chatService.ts`：优先看 `docs/auth-and-sync-domain-guide.md`
- `types.ts`：接口或字段变更时同时看 `docs/interface-change-template.md`

### 后端核心文件

- `server/routes/ai.js`：优先看 `docs/ai-routing-log-domain-guide.md`
- `server/routes/auth.js` / `server/middleware/auth.js`：优先看 `docs/auth-and-sync-domain-guide.md`
- `server/routes/goals.js` / `server/services/goalService.js` / `server/services/rewardService.js`：优先看 `docs/goals-rewards-domain-guide.md`
- `server/routes/plans.js` / `server/services/planService.js` / `server/models/Plan.js`：优先看 `docs/plans-ios-sync-domain-guide.md`
- `server/index.js`：优先看 `docs/ai-dev-guide.md`

### 原生与设计稿

- `plugins/iosPlanSync.ts` / `plugins/iosPlanSync.web.ts` / `ios/App/App/LifePulsePlanSyncPlugin.swift`：优先看 `docs/plans-ios-sync-domain-guide.md`
- `GOAL_REWARDS_BADGES_DESIGN.md`：设计稿，配合 `docs/goals-rewards-domain-guide.md` 一起看

## 设计与方案

- 目标、积分、官方徽章设计稿：`GOAL_REWARDS_BADGES_DESIGN.md`

## 推荐阅读顺序

### 第一次接手仓库

1. 先看 `docs/ai-dev-guide.md`
2. 再看 `AGENTS.md` 或 `.github/copilot-instructions.md`
3. 然后按模块跳到专项规则文档

### 要改一个现有功能

1. 先看 `docs/feature-change-checklist.md`
2. 如果是接口变更，再套用 `docs/interface-change-template.md`
3. 如果是目标或计划相关，再看对应领域规则文档

### 要改目标系统

1. 先看 `docs/goals-rewards-domain-guide.md`
2. 再看 `GOAL_REWARDS_BADGES_DESIGN.md`

### 要改计划或 iOS 同步

1. 先看 `docs/plans-ios-sync-domain-guide.md`
2. 再检查 `services/planSyncService.ts`、`plugins/iosPlanSync.ts` 和原生插件实现

### 要改登录、token 或本地同步

1. 先看 `docs/auth-and-sync-domain-guide.md`
2. 再检查 `App.tsx`、`services/apiClient.ts`、`services/storageService.ts`、`services/chatService.ts`

### 要改 AI 分流或日志解析

1. 先看 `docs/ai-routing-log-domain-guide.md`
2. 再检查 `components/Logger.tsx`、`services/qwenService.ts`、`server/routes/ai.js`

## 文档使用原则

- 设计稿描述的是目标方案，不一定等于当前实现
- 领域规则文档描述的是当前代码现状，改逻辑前优先看这里
- checklist 和模板是执行辅助，不替代代码阅读
- 如果同一主题同时存在“设计稿”和“领域规则”，默认以领域规则和当前代码为准
- 如果文档与代码不一致，应先修正文档，不要继续扩散过期规则
