# LifePulse AI 功能改动 Checklist

这份清单给人和 AI 共用。用途很简单：收到一个新需求后，按顺序过一遍，避免只修表面或漏掉跨模块联动。

## 1. 需求分类

先确定这次改动主要落在哪条链路：

- 聊天 / 日志解析 / AI 分流
- 目标 / 打卡 / 奖励
- 计划 / 日历 / iOS 同步
- 登录 / 鉴权 / 本地与云端同步
- 历史记录 / 财务 / 纯展示 UI
- 通用字段 / 通用接口 / 类型结构

如果一眼看不出来，优先从对应的 `services/*.ts` 找入口，不要先从组件里硬搜按钮。

## 2. 改动前

- 确认核心落点在哪一层：组件、service、route、service、model，还是跨层
- 如果改接口字段，先检查 `types.ts`
- 如果改前端请求，先检查对应 `services/*.ts`
- 如果改后端规则，先检查对应 `server/services/*.js`
- 如果改用户可见文案，确认是否要更新 `locales/zh/translation.json` 和 `locales/en/translation.json`
- 如果改数据库字段或模型，评估 `DB_SYNC_MODE=safe` 下是否仍可正常启动
- 如果改登录或同步逻辑，确认会不会影响游客模式或登录后本地数据上云

## 3. 前端改动中

- 不要在组件里直接拼接口，优先走 `services/*.ts`
- 不要把后端规则复制到前端，只在前端做展示和交互约束
- 如果数据由 `App.tsx` 统一拉取，确认是否需要在变更后刷新对应状态
- 如果改 `components/Logger.tsx`，默认按高风险改动处理
- 如果改 `services/runtimeConfig.ts` 或 API base URL，确认 Web 和 iOS 原生壳都还能工作

## 4. 后端改动中

- route 负责参数、鉴权、状态码与错误消息，不要把复杂规则堆在 route 里
- 真正规则优先放 `server/services/*.js`
- 如果接口返回结构变了，记得同步前端 service 和 `types.ts`
- 受保护接口确认仍然挂有 `authenticateToken`
- 改完后端后默认需要重启 `server/index.js`

## 5. 目标系统专项检查

- 规则是否落在 `server/services/goalService.js`
- 是否影响 `GoalPlanner.tsx` 和 `Logger.tsx` 的展示
- 是否影响主奖励目标 `rewardRole`
- 是否影响暂停 / 恢复 / 删除 / 重启 / 完成逻辑
- 是否影响积分和徽章发放

## 6. 计划系统专项检查

- 是否影响 `services/planService.ts` 和 `server/routes/plans.js`
- 是否影响 `types.ts` 的计划字段
- 是否影响 `services/planSyncService.ts` 的 fingerprint、binding 或删除队列
- 是否影响 `plugins/iosPlanSync.ts`、`plugins/iosPlanSync.web.ts`
- 如果涉及原生同步，是否需要同步改 `ios/App/App/LifePulsePlanSyncPlugin.swift`

## 7. AI 分流专项检查

- 真正分类逻辑是否改在 `server/routes/ai.js`
- 普通闲聊是否会被误判成计划
- 明确计划文本是否仍能识别成计划
- 日志型文本是否仍能走日志链路
- 是否把供应商密钥或直连请求错误地下沉到了前端

## 8. 登录专项检查

- 游客模式是否仍正常
- token 本地存储逻辑是否仍正常
- 401 是否仍会触发 `unauthorized` 事件
- 登录成功后本地日志与聊天是否仍会同步到云端
- 登录后是否仍刷新 logs、chatMessages、goals、plans、rewardProfile、rewardBadges、rewardLedger

## 9. 提交前验证

- 只改前端：运行 `npm run build`
- 只改后端：确认 `cd server && node index.js` 能启动
- 同时改前后端：至少完成一次前端构建和后端启动验证
- 确认你验证时不是旧的后端进程
- 至少手测一条受影响主链路

## 10. 常见错误

- 只改 UI，不改 service 或后端规则
- 只改前端限制，不改后端校验
- 改完后端不重启，就误判代码没生效
- 把 `DB_SYNC_MODE` 长期改成 `alter`
- 只在浏览器里验证 iOS 同步问题
- 只验证 happy path，不验证登录态、空态或失败态
