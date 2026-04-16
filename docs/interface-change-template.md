# LifePulse AI 接口变更模板

这份模板给人和 AI 共用，用来规范“新增或修改一个接口”时最少要检查哪些层。

## 使用方式

收到接口变更需求后，复制下面模板，按项填写。不要只改一层就结束。

---

## 1. 变更概述

- 需求名称：
- 变更类型：新增接口 / 修改字段 / 调整状态流转 / 删除接口
- 影响模块：聊天 / 目标 / 计划 / 登录 / 奖励 / 其他
- 是否涉及鉴权：是 / 否
- 是否涉及 i18n 文案：是 / 否
- 是否涉及数据库字段或模型：是 / 否

## 2. 后端改动

### Route

- 目标文件：`server/routes/...`
- 是否新增或修改路由路径：
- 是否需要 `authenticateToken`：
- 成功返回结构：
- 错误状态码与错误消息：

### Service

- 目标文件：`server/services/...`
- 业务规则落点：
- 是否影响现有状态流转：
- 是否需要幂等控制：

### Model

- 目标文件：`server/models/...`
- 是否新增字段：
- 是否改索引 / 约束 / 默认值：
- `DB_SYNC_MODE=safe` 下是否仍可正常处理：

## 3. 前端改动

### Types

- 目标文件：`types.ts`
- 新增 / 修改的字段：
- 是否影响联合类型或枚举：

### Service

- 目标文件：`services/...`
- 对应路径是否和后端一致：
- 请求方法：GET / POST / PUT / DELETE
- 参数位置：params / body / path

### Component / App 状态

- 目标文件：`components/...` / `App.tsx`
- 谁消费这个接口：
- 是否需要刷新全局状态：
- 是否会影响空态 / 错误态 / 加载态：

## 4. 文案与国际化

- 是否新增用户可见文案：
- 是否同步更新：`locales/zh/translation.json`
- 是否同步更新：`locales/en/translation.json`

## 5. 风险检查

- 是否改到了 `App.tsx`：
- 是否改到了 `components/Logger.tsx`：
- 是否改到了 `server/routes/ai.js`：
- 是否改到了 `server/services/goalService.js`：
- 是否涉及 iOS 原生同步：

## 6. 验证

- 只改前端：`npm run build`
- 只改后端：`cd server && node index.js`
- 同时改前后端：前端构建 + 后端启动
- 需要手测的主链路：
- 是否确认不是旧后端进程：

---

## 快速规则

- 不要在组件里直接拼 fetch，优先改 `services/*.ts`
- 不要把后端规则复制到前端
- 不要改了 route 忘记改 `types.ts`
- 不要改了后端却忘记重启服务
- 不要新增文案却漏掉中英文翻译
