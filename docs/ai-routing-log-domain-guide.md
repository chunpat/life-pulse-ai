# LifePulse AI AI 分流、日志解析与建议规则说明

这份文档描述的是当前代码里的已实现行为，主要对应：

- `components/Logger.tsx`
- `services/qwenService.ts`
- `server/routes/ai.js`

它不是提示词设计稿，而是帮助后续改 AI 分流、日志解析、计划识别、智能建议时快速理解当前链路。

## 1. 当前前后端链路

前端入口主要在 `components/Logger.tsx`。

前端调用：

- `parseLifeLog()` -> `/api/ai/parse`
- `getDailyInsight()` -> `/api/ai/insight`
- `getSmartSuggestions()` -> `/api/ai/suggestions`

后端统一在 `server/routes/ai.js` 处理。

## 2. 当前 `/api/ai/parse` 能做什么

`POST /api/ai/parse` 当前允许未登录访问，用于统一解析用户输入。

它会把输入归类为四类之一：

- `chat`
- `log`
- `plan`
- `finance`

返回结构里可能包含：

- `intent`
- `assistantReply`
- 日志字段
- `finance`
- `plan`

重点：这个接口不只是“日志解析”，而是当前统一输入分流器。

## 3. 当前计划分流 heuristics

后端在 `server/routes/ai.js` 里做了显式 heuristics。

### 强计划信号

例如：

- 提醒我
- 待办
- 截止
- appointment
- remind me
- todo

### 动作信号

例如：

- 开会
- 预约
- 面试
- 提交
- 航班
- train
- meeting

### 时间信号

例如：

- 明天
- 后天
- 周五
- 下周
- 晚上
- `8:30`
- `8点`

### 聊天 / 问句信号

例如：

- `?` / `？`
- 怎么
- 为什么
- hi
- hello
- 谢谢

当前策略不是只靠模型，而是：

- 先用 heuristics 形成 plan/chat 倾向
- 再让模型输出结构化 JSON
- 最后再用 `shouldAcceptPlanResult` 做一次后验过滤

## 4. 当前计划结果兜底机制

如果模型没有给出可信的 plan，但 heuristics 判断是强计划信号，后端会：

- 强制把 intent 调整为 `plan`
- 用 `buildFallbackPlan()` 生成一个低置信度的兜底计划

这保证了明显的提醒类文本不至于完全漏掉。

## 5. 当前聊天兜底机制

如果 intent 最终是 `chat`：

- 必须返回 `assistantReply`
- 如果模型没给出，就用 `buildDefaultAssistantReply()` 生成默认回复

重点：聊天兜底是在后端完成的，不是前端补字符串。

## 6. 当前上下文处理方式

前端会把最近聊天上下文和摘要传给 `/parse`：

- `context`
- `contextSummary`

后端会：

- 过滤不适合作为上下文的消息
- 合并最近对话
- 生成较早对话摘要
- 把上下文以 system prompt 形式传给模型

重点：上下文存在的目的主要是解决指代、省略和追问，不是改变当前这句输入的主分类对象。

## 7. 当前计划时间处理

当前后端会做这些时间相关补救：

- 把相对时间词如“明天”“后天”换算为时间戳
- 解析像 `8:30`、`8点半` 这种时间
- 如果是 event，会自动补默认时长
- 如果识别出的时间是“今天已经过去的时间”，会附带 `timeValidation`
- `timeValidation` 里可能给出“改到明天同一时间”的建议时间

## 8. 当前 `/api/ai/insight` 现状

`POST /api/ai/insight`：

- 需要鉴权
- 输入是 logs + period + lang
- 输出是一个 JSON 字符串形式的 insight

当前主要用于：

- day / week / month 洞察
- 对活动记录做总结、亮点和建议

## 9. 当前 `/api/ai/suggestions` 现状

`POST /api/ai/suggestions`：

- 需要鉴权
- 基于最近日志、当前小时、当前星期几生成 1-2 条建议
- 输出结构包含 `suggestions`
- 前端会再做一次 `normalizeSmartSuggestion()`

## 10. 模型配置现状

后端当前在 `server/routes/ai.js` 里通过通用 LLM 适配层调用模型。

默认选择规则：

- 如果设置了 `LLM_PROVIDER`，按该值选择
- 如果未设置 `LLM_PROVIDER` 但存在 `MINIMAX_API_KEY`，默认走 MiniMax
- 否则回退到 Qwen / DashScope

关键环境变量：

- `LLM_PROVIDER`
- `MINIMAX_API_KEY`
- `MINIMAX_MODEL`
- `MINIMAX_BASE_URL`
- `MINIMAX_API_FORMAT`
- `DASHSCOPE_API_KEY`
- `QWEN_MODEL`
- `QWEN_ENABLE_THINKING`

MiniMax 支持 Anthropic-compatible 和 OpenAI-compatible 两种配置。当前 `MINIMAX_BASE_URL` 如果包含 `/anthropic`，会走 Anthropic-compatible 适配；否则可以按 OpenAI-compatible 方式配置。

当前 `QWEN_ENABLE_THINKING` 只在支持的 Qwen 模型上透传。

重点：不要把模型密钥、供应商 Base URL 或 thinking 开关挪到前端。

## 11. 修改 AI 分流时必须一起检查的文件

- `components/Logger.tsx`
- `services/qwenService.ts`
- `server/routes/ai.js`
- 如果返回结构变了，再检查 `types.ts`

## 12. 最低手测建议

- 输入一句普通闲聊，确认 intent 仍是 `chat`
- 输入一句明确日志，确认 intent 是 `log`
- 输入一句明确计划文本，确认 intent 是 `plan`
- 输入一句财务文本，确认不会误落到 chat 或 plan
- 验证今天已过时间的计划会收到 `timeValidation`
- 验证 suggestions 和 insight 在 authenticated 用户下仍可正常返回
