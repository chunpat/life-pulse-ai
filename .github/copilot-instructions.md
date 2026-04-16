# LifePulse AI 仓库说明（给代码助手）

## 1. 项目定位

这是一个前后端分离的生活记录应用：

- 前端：React 19 + TypeScript + Vite + Tailwind，代码主要在仓库根目录与 components、services。
- 后端：Node.js + Express + Sequelize，代码在 server。
- 数据库：MySQL。
- AI：通义千问经后端代理调用，不要把密钥逻辑放到前端。
- 移动端：已接入 Capacitor iOS 壳与计划同步插件骨架。

这不是纯聊天项目。聊天输入只是统一入口，实际会分流到日志、记账、计划、目标、奖励等业务。

## 2. 本地运行方式

- 前端开发：`npm run dev`
- 前端地址：`http://127.0.0.1:3000`
- 后端开发：`cd server && node index.js`
- 后端默认端口：`5002`
- 前端 Vite 代理：`/api -> http://127.0.0.1:5002`
- 前端构建：`npm run build`
- iOS 打包同步：`npm run ios:build`

注意：项目没有完善的自动化测试体系，修改后优先做构建验证和关键路径手测。

## 3. 关键入口文件

### 前端

- `App.tsx`：应用根状态，负责视图切换、登录态、日志/聊天/目标/计划/奖励数据拉取与刷新。
- `components/Logger.tsx`：核心对话式入口，日志解析、草稿确认、智能建议、目标侧边栏都从这里展开。
- `components/GoalPlanner.tsx`：目标创建与目标相关交互 UI。
- `components/PlanCenter.tsx`：计划中心。
- `components/Finance.tsx`：财务模块。
- `components/History.tsx`：历史记录查询。
- `components/Auth.tsx`：登录注册与 Apple 登录入口。
- `services/*.ts`：前端 API 封装与运行时配置。
- `services/runtimeConfig.ts`：决定 Web / 原生壳下 API 基址，不要写死接口域名。
- `types.ts`：前后端共享的核心类型入口，前端新增字段通常要先检查这里。

### 后端

- `server/index.js`：服务启动入口、路由挂载、数据库同步、官方计划模板初始化。
- `server/routes/*.js`：HTTP 路由层。
- `server/services/*.js`：主要业务逻辑层。
- `server/models/*.js`：Sequelize 模型。
- `server/middleware/auth.js`：登录态接口鉴权入口。
- `server/routes/ai.js`：AI 相关接口。
- `server/services/goalService.js`：目标规则核心实现。
- `server/services/officialPlanService.js`：官方计划模板初始化与读取。

### 高频调用链

- 聊天 / 日志主链路：`components/Logger.tsx` -> `services/qwenService.ts` / `services/storageService.ts` / `services/chatService.ts` -> `server/routes/ai.js`
- 目标主链路：`components/GoalPlanner.tsx` / `components/Logger.tsx` -> `services/goalService.ts` -> `server/routes/goals.js` -> `server/services/goalService.js`
- 计划主链路：`components/Logger.tsx` / `components/PlanCenter.tsx` -> `services/planService.ts` -> `server/routes/plans.js` -> `server/services/planService.js`
- 奖励主链路：`App.tsx` -> `services/rewardService.ts` -> `server/routes/rewards.js` -> `server/services/rewardService.js`
- 登录主链路：`components/Auth.tsx` -> `services/authService.ts` -> `server/routes/auth.js`

## 4. 代码结构与职责边界

### 前端状态分层

- `App.tsx` 是应用级状态中心，负责登录态、视图切换、日志/聊天/目标/计划/奖励数据拉取，以及登录后的本地数据上云同步。
- `components/Logger.tsx` 不只是聊天窗口，它同时承担日志解析、草稿确认、智能建议、目标侧栏和部分计划创建入口，是前端最容易牵一发而动全身的文件。
- `components/GoalPlanner.tsx` 主要负责目标列表展示、创建入口、官方模板选择和目标操作 UI，本身不承载目标规则判断，规则应尽量留在后端。
- `services/*.ts` 是前端和后端 API 的稳定边界。新增接口时优先在 service 层落地，不要在组件里直接拼接请求。
- `types.ts` 是前后端交互数据结构在前端的收口点，改接口字段时通常要同步更新这里。

### 后端职责分层

- `server/routes/*.js` 负责参数接收、鉴权、HTTP 状态码与错误消息映射，不应堆复杂业务规则。
- `server/services/*.js` 负责主要业务逻辑和规则判断。目标、奖励、计划模板等核心规则优先放这里。
- `server/models/*.js` 负责 Sequelize 模型定义。涉及字段新增、索引、约束时，需要一起核对数据库同步风险。
- `server/index.js` 会在启动时完成路由挂载、数据库同步、用户表 schema 补齐和官方计划模板补齐，因此服务启动行为本身也是业务的一部分。

### AI 调用边界

- 前端的解析与建议能力通过 `services/qwenService.ts` 走后端 `/api/ai` 接口。
- 真正的模型配置、启发式判断、上下文摘要与思考开关在 `server/routes/ai.js`。
- 不要在前端写任何供应商密钥、Base URL、签名逻辑或直连大模型请求。

## 5. 重要业务事实

### 登录与数据流

- 游客模式走本地存储。
- 已登录用户走云端接口。
- 登录成功后会把本地日志和本地聊天同步到云端，所以不要轻易改动登录后的同步时机。
- `App.tsx` 里登录后会重新拉取 logs、chatMessages、goals、plans、rewardProfile、rewardBadges、rewardLedger，不要只刷新单一模块导致状态不一致。
- 前端通过本地 `lifepulse_token` 判断是否走鉴权接口；接口 401 会触发 `unauthorized` 事件并执行登出。
- 如果改登录、登出或 token 逻辑，要同时检查 `App.tsx`、`services/apiClient.ts`、`services/authService.ts` 和相关本地存储键。

### AI / 聊天分流

- `Logger.tsx` 是统一输入口，但后续可能进入聊天、生活记录、财务记录、计划创建等不同分支。
- `server/routes/ai.js` 除了模型调用外，还有 plan/chat 的启发式分流逻辑。改这里要防止普通闲聊误判成计划，也要防止明确计划被漏掉。
- AI 相关安全边界是：前端只调后端 API，不在前端持有或直连供应商密钥。
- `QWEN_ENABLE_THINKING` 建议默认关闭，尤其是日志解析、智能建议、分流判断这类高频请求。

### 目标系统

目标相关修改优先关注这些文件：

- `server/routes/goals.js`
- `server/services/goalService.js`
- `server/models/Goal.js`
- `server/models/GoalCheckin.js`
- `components/GoalPlanner.tsx`
- `components/Logger.tsx`

当前已确认规则：

- 支持多条目标同时进行。
- 同一条日志只会给当天未打卡且与日志内容语义相关的 active 目标创建 check-in。
- paused 目标恢复后保留 `completedDays`，但 `currentStreak` 归零，`lastCheckInDate` 清空。
- failed 目标不会继续出现在 Logger 首页主卡，需在计划记录区手动重启。
- 重启额度按每 7 天 1 次计算：7_DAY = 1 次，21_DAY = 3 次。
- 重启会清空当轮 `completedDays/currentStreak/lastCheckInDate`，并删除旧 `GoalCheckin`。
- 删除规则：未开始目标可反复删除；已开始目标按用户 + 自然月统计，当月最多允许删除 1 个已开始目标。
- 奖励积分：有效日志 2 分、主奖励目标完成当日 1 分、7 天完成 20 分、21 天完成 60 分、每 50 分升一级。
- 设主奖励目标存在约束：有官方计划进行中时，不能把个人计划设为主奖励计划。
- 目标前端文案和展示不仅在 `GoalPlanner.tsx`，也会出现在 `Logger.tsx` 的目标侧边栏与首页卡片中。

目标改动时还要注意：

- 前端 `components/GoalPlanner.tsx` 里的展示规则、文案提示和官方计划卡片需要与后端规则一致。
- 前端 `services/goalService.ts` 已经固定了 REST 路径：列表、active、pause、resume、restart、complete、set-primary、delete、checkins。改路由时要同步更新。
- 日志打卡匹配逻辑在 `server/services/goalService.js`，不要把“日志是否命中目标”的判定复制到前端。

### 计划系统

- 计划既有 Web 端业务，也有同步到 iOS 日历 / 提醒事项的能力。
- 计划同步核心在 `services/planSyncService.ts`，它会维护本地 binding 和删除队列；不要只改 UI 而忽略这些状态。
- `plugins/iosPlanSync.ts` 定义 Capacitor 插件接口，`plugins/iosPlanSync.web.ts` 是 Web shim，`ios/App/App/LifePulsePlanSyncPlugin.swift` 是 iOS 原生实现。
- 改计划同步字段、权限、同步目标或返回结构时，这 4 处要一起检查。
- 计划同步到 iOS 的流程依赖计划字段完整性，例如 `title`、`notes`、`planType`、`status`、`startAt`、`dueAt`、`reminderAt`、`syncTarget`。修改这些字段时要检查同步指纹是否需要同步调整。

### 官方计划模板

- 服务启动时会自动执行 `ensureOfficialPlanTemplates`。
- 默认会确保存在 3 个官方模板：早睡重启、专注回归、运动节律。
- 不要假设这些模板只靠 seed 脚本存在；正常启动也会补齐。

### 国际化

- 用户可见文案优先走 i18n，不要把中文文案硬编码进组件。
- 新增或修改文案时，同时检查 `locales/zh/translation.json` 和 `locales/en/translation.json`。
- 如果组件当前已经直接写了中文，修改时优先沿用现状做最小改动，但新增文案仍尽量补到翻译文件。

### 计划同步到 iOS

- Web 与 iOS 原生壳共享前端代码。
- 计划同步逻辑在 `services/planSyncService.ts` 与 `plugins/iosPlanSync.ts` / `iosPlanSync.web.ts`。
- 如果改动计划同步协议，需同时检查前端调用、Capacitor 插件定义和 iOS 原生实现是否一致。
- 原生同步只在 iOS 容器中可用，Web 下不能假设同步能力存在。
- 同步失败会区分 `permission-denied` 与 `failed`，不要把权限问题和普通异常混成一个状态。
- 可同步目标目前是 `ios-reminder` 和 `ios-calendar`；非同步目标不应误触发原生插件。
- 计划同步绑定信息和删除队列保存在前端 localStorage；改动 syncState、externalId 或 containerId 结构时要考虑历史数据兼容。

### 计划与聊天入口

- 聊天输入会被 AI 判断为聊天、日志、计划或其他结构化内容，不要把 Logger 当成纯 IM 界面来改。
- `server/routes/ai.js` 里已经有针对计划文本的启发式判断和兜底聊天回复逻辑。修改计划识别率时，优先调整后端 heuristics，不要只改前端提示词。

## 6. 环境与配置约束

- 后端 `.env` 的 `DB_SYNC_MODE` 默认应保持 `safe`。
- 只有明确做数据库结构迁移时，才临时改为 `alter`；否则可能在 MySQL 上重复堆叠唯一索引。
- `QWEN_ENABLE_THINKING` 默认建议为 `false`，避免日志解析类请求被思考模型拉高延迟。
- iOS 原生壳优先读取 `VITE_NATIVE_API_BASE_URL`。
- Web 环境可使用 `VITE_API_BASE_URL`，不配置时默认走相对路径 + Vite 代理。
- Vite 本地开发默认把 `/api` 代理到 `http://127.0.0.1:5002`。
- 后端默认端口是 `5002`，不要重新写回 `5000` 或 `5001`。

## 7. 常见改动路径

### 新增或修改一个接口

- 先改后端 `server/routes/*.js` 与对应 `server/services/*.js`。
- 如果字段结构变化，再同步更新 `server/models/*.js` 与前端 `types.ts`。
- 前端通过 `services/*.ts` 接入接口，再让组件消费 service，不要在组件里直接写 fetch。
- 如果有新增用户可见文案，同步更新中英文翻译。

### 修改目标规则

- 以 `server/services/goalService.js` 为规则单点。
- 核对 `server/routes/goals.js` 的错误消息和状态码映射是否仍然成立。
- 核对 `components/GoalPlanner.tsx`、`components/Logger.tsx` 是否需要同步更新提示、按钮状态和展示文案。
- 如果改动影响积分，再检查 `server/services/rewardService.js`。

### 修改计划或 iOS 同步

- 同时检查 `types.ts`、`services/planService.ts`、`services/planSyncService.ts`、`plugins/iosPlanSync.ts`、`plugins/iosPlanSync.web.ts`。
- 如果改动同步字段、权限、容器 ID、外部 ID，需考虑本地已有绑定信息和待删除队列的兼容。
- 如果协议变化涉及原生壳，还要同步检查 `ios/App/App/LifePulsePlanSyncPlugin.swift`。

### 修改 AI 解析行为

- 优先改 `server/routes/ai.js` 中的启发式分类、上下文摘要与模型请求参数。
- 若前端提示词或调用参数也变了，再同步检查 `services/qwenService.ts` 与 `components/Logger.tsx`。
- 任何情况下都不要把模型密钥或供应商特定逻辑下沉到前端。

## 8. 修改时的工作约定

- 改前端接口时，先核对对应的 `services/*.ts` 与 `server/routes/*.js` 是否一一对应。
- 改后端模型、服务或路由后，需要重启 `server` 进程；旧的 `node index.js` 进程会继续提供旧行为。
- 新增用户可见文案时，优先同步更新 `locales/zh/translation.json` 和 `locales/en/translation.json`。
- 保持现有技术栈风格：前端用 TypeScript/ESM，后端目前是 CommonJS。
- 除非任务明确要求，否则不要顺手重构大文件；这个仓库很多状态集中在 `App.tsx` 和 `Logger.tsx`，应做最小改动。
- 不要把任何第三方 API Key、Apple 登录校验逻辑或 Qwen 直连逻辑放进前端。

### 高风险文件

- `App.tsx`：集中管理大量全局状态，改动容易引发跨模块回归。
- `components/Logger.tsx`：输入、解析、草稿、智能建议、目标入口都在这里，局部改动可能打断主链路。
- `server/routes/ai.js`：同时承载模型调用和输入分流逻辑，回归风险高。
- `server/services/goalService.js`：目标、check-in、重启、主奖励逻辑集中。

## 9. 常见高风险点

- `App.tsx` 和 `components/Logger.tsx` 状态很多，局部改动很容易影响登录态、草稿恢复、聊天记录加载、侧边栏状态或数据刷新时机。
- 后端改完如果不重启 `server/index.js` 进程，看起来像“代码没生效”，这是仓库里最常见的误判之一。
- `DB_SYNC_MODE` 不要为了省事长期改成 `alter`。
- 目标、计划、奖励三套逻辑彼此有关联，修改其中一个模块时要检查是否触发连带展示或积分变化。
- iOS 同步逻辑在 Web 下会降级，涉及原生能力的问题不要只在浏览器里验证就下结论。

## 10. 改动后的最低验证

### 只改前端

- 运行 `npm run build`
- 手动检查受影响页面是否能打开

### 只改后端

- 确认 `server/index.js` 能正常启动
- 手测对应接口至少一条主路径

### 同时改前后端

- 前端构建通过
- 后端能启动
- 受影响的主链路至少走通一次

### 建议的手测优先级

- 改聊天 / 日志：至少验证输入一句普通聊天、一句日志、一句计划型文本，各自分流正确。
- 改目标：至少验证创建、暂停 / 恢复、删除或重启中的关键一条。
- 改计划：至少验证创建 / 更新后 UI 正常，若涉及 iOS 同步则验证 Web 回退不报错。
- 改登录：至少验证游客进入、登录成功、登录后本地数据同步三步。

### 推荐手测主链路

- 登录或游客进入后，Logger 能正常打开并发送一条消息。
- 新建一条日志后，历史记录能看到数据。
- 如果改了目标相关逻辑，至少走通一次创建目标、日志触发、目标列表刷新。
- 如果改了计划相关逻辑，至少走通一次创建计划、编辑或取消计划，以及同步状态展示。

如果你需要快速理解项目，请先从 `App.tsx`、`components/Logger.tsx`、`server/index.js`、`server/services/goalService.js` 开始。