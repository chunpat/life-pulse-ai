# LifePulse AI AI 开发指南

本指南给人和代码助手共用，目标不是重复 README，而是帮助你在收到需求后快速判断：应该改哪几层、哪些文件最关键、哪些地方不能偷懒只修表面。

相关文档：

- 文档索引：`docs/README.md`
- 通用改动清单：`docs/feature-change-checklist.md`
- 目标 / 积分 / 徽章规则：`docs/goals-rewards-domain-guide.md`
- 计划 / iOS 同步规则：`docs/plans-ios-sync-domain-guide.md`
- 登录 / 鉴权 / 本地同步规则：`docs/auth-and-sync-domain-guide.md`
- AI 分流 / 日志解析规则：`docs/ai-routing-log-domain-guide.md`
- 接口变更模板：`docs/interface-change-template.md`
- 目标体系设计稿：`GOAL_REWARDS_BADGES_DESIGN.md`

## 1. 先判断需求属于哪一类

### 聊天 / 日志解析 / AI 分流

- 先看 `components/Logger.tsx`
- 再看 `services/qwenService.ts`
- 最后看 `server/routes/ai.js`
- 如果只是分类不准，优先改后端 heuristics，不要只改前端提示词
- 涉及当前规则时，同时参考 `docs/ai-routing-log-domain-guide.md`

### 目标 / 打卡 / 奖励联动

- 先看 `server/services/goalService.js`
- 再看 `server/routes/goals.js`
- 然后看 `components/GoalPlanner.tsx` 和 `components/Logger.tsx`
- 如果影响积分，再看 `server/services/rewardService.js`
- 涉及当前规则时，同时参考 `docs/goals-rewards-domain-guide.md`

### 计划 / 日历 / iOS 同步

- 先看 `services/planService.ts` 和 `server/routes/plans.js`
- 再看 `services/planSyncService.ts`
- 如果涉及原生同步，再看 `plugins/iosPlanSync.ts`、`plugins/iosPlanSync.web.ts`、`ios/App/App/LifePulsePlanSyncPlugin.swift`
- 如果字段有变化，再看 `types.ts`
- 涉及当前规则时，同时参考 `docs/plans-ios-sync-domain-guide.md`

### 登录 / 鉴权 / 本地与云端同步

- 先看 `App.tsx`
- 再看 `services/apiClient.ts`、`services/authService.ts`
- 后端看 `server/routes/auth.js` 和 `server/middleware/auth.js`
- 注意 401 会触发 `unauthorized` 事件并走登出回收
- 涉及当前规则时，同时参考 `docs/auth-and-sync-domain-guide.md`

### 通用接口或字段变更

- 后端顺序通常是：`server/routes/*.js` -> `server/services/*.js` -> `server/models/*.js`
- 前端顺序通常是：`types.ts` -> `services/*.ts` -> `components/*.tsx` -> `App.tsx`
- 如果是接口类改动，优先套用 `docs/interface-change-template.md`

## 2. 哪些文件是状态中心

- `App.tsx`：前端全局状态中心，负责登录态、视图切换、日志、聊天、目标、计划、奖励数据拉取与刷新
- `components/Logger.tsx`：不是纯聊天窗口，它还是日志解析入口、草稿确认入口、智能建议入口、目标侧栏入口
- `server/routes/ai.js`：不是单纯模型调用层，它还做聊天 / 计划的启发式分流
- `server/services/goalService.js`：目标规则、日志命中、重启、主奖励计划等核心逻辑都在这里

如果需求触发其中任意一个文件，默认按高风险改动处理，不要先假设只是 UI 小修。

## 3. 哪些事情不要只改前端

- 目标规则不要只在前端禁按钮，真正约束要放在 `server/services/goalService.js`
- AI 分流不要只改前端 prompt，真正分类逻辑在 `server/routes/ai.js`
- 鉴权不要只靠前端判断，受保护接口仍要走 `authenticateToken`
- 计划同步不要只改按钮文案，要同步检查 binding、删除队列、权限返回和原生插件接口
- 新增接口不要在组件里直接写 fetch，优先收敛到 `services/*.ts`

## 4. 关键业务约束速查

### 目标系统

- 支持多条目标同时进行
- 同一条日志只会给当天未打卡且语义相关的 active 目标创建 check-in
- paused 恢复后保留 `completedDays`，但 `currentStreak` 归零，`lastCheckInDate` 清空
- failed 目标不会继续出现在 Logger 首页主卡，需要在记录区手动重启
- 重启额度按每 7 天 1 次计算：7_DAY = 1 次，21_DAY = 3 次
- 已开始目标按用户 + 自然月统计，当月最多删除 1 个
- 有官方计划进行中时，不能将个人计划设为主奖励计划

### 计划同步

- iOS 同步只在原生 iOS 容器中可用，Web 下是降级路径
- 可同步目标只有 `ios-reminder` 和 `ios-calendar`
- 同步失败需要区分 `permission-denied` 和 `failed`
- `services/planSyncService.ts` 会维护本地 binding 与待删除队列，不能只看接口返回

### 登录与数据流

- 游客模式走本地存储
- 登录用户走云端接口
- 登录成功后会同步本地日志和本地聊天到云端
- `App.tsx` 登录后会刷新 logs、chatMessages、goals、plans、rewardProfile、rewardBadges、rewardLedger

## 5. 变更前检查清单

- 先判断这是前端显示问题、后端规则问题，还是两边字段不同步
- 先确认需求影响的是聊天、目标、计划、登录还是奖励
- 先找对应 service，不要直接从组件里开改
- 如果字段会穿过接口，先检查 `types.ts`
- 如果是用户可见文案，先确认是否要补 `locales/zh/translation.json` 和 `locales/en/translation.json`
- 如果要改数据库字段或模型，先评估 `DB_SYNC_MODE=safe` 下是否需要额外处理

## 6. 改动中检查清单

- 前端改接口时，确保 `services/*.ts` 和 `server/routes/*.js` 路径一致
- 后端 route 改动后，确认错误消息和状态码映射没有被破坏
- 目标逻辑改动后，确认 `GoalPlanner.tsx` 和 `Logger.tsx` 的展示没有过时
- 计划字段改动后，确认同步指纹、插件 payload、Web shim 和原生实现保持一致
- 登录逻辑改动后，确认本地 token、401 回收、登录后同步链路仍成立
- AI 分流改动后，确认普通闲聊不会被误判成计划

## 7. 提交前检查清单

- 只改前端：运行 `npm run build`
- 只改后端：确认 `cd server && node index.js` 能启动
- 同时改前后端：至少做一次前端构建和后端启动验证
- 后端代码修改后，确认你验证时用的不是旧进程
- 受影响主链路至少手测一次，不要只看编译通过

## 8. 推荐手测场景

### 改聊天 / 日志 / AI 分流

- 输入一句普通闲聊，确认不会被误识别为计划
- 输入一句明显日志，确认会进入日志链路
- 输入一句明确计划文本，确认计划识别与落库正确

### 改目标

- 创建一个目标
- 触发一次日志命中
- 验证目标列表刷新
- 如改了暂停 / 恢复 / 删除 / 重启逻辑，至少验证其中一条完整路径

### 改计划

- 创建一条计划
- 编辑或取消一条计划
- 如果涉及 iOS 同步，确认 Web 下不会因为无原生能力而报错

### 改登录

- 游客进入正常
- 登录成功正常
- 登录后本地日志和聊天能同步到云端

## 9. 常见误区

- 只改组件，不改 service 或后端规则
- 只改前端按钮状态，不改后端校验
- 改完后端不重启进程，就误判“代码没生效”
- 为了省事把 `DB_SYNC_MODE` 长期改成 `alter`
- 在前端写供应商密钥、模型直连逻辑或固定 API 域名
- 只在浏览器里验证 iOS 同步相关问题

## 10. 推荐阅读顺序

- 第一次接手仓库：先看 `App.tsx`、`components/Logger.tsx`、`server/index.js`
- 要改目标：再看 `server/services/goalService.js`、`components/GoalPlanner.tsx`
- 要改计划同步：再看 `services/planSyncService.ts`、`plugins/iosPlanSync.ts`
- 要改 AI 分流：再看 `server/routes/ai.js`
