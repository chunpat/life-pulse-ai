# LifePulse AI 登录、鉴权与本地同步规则说明

这份文档描述的是当前代码里的已实现行为，主要对应：

- `components/Auth.tsx`
- `services/authService.ts`
- `services/apiClient.ts`
- `services/storageService.ts`
- `services/chatService.ts`
- `App.tsx`
- `server/routes/auth.js`
- `server/middleware/auth.js`
- `server/models/User.js`

它不是账号体系规划文档，而是给后续改登录、token、游客模式、本地同步时快速对齐当前现状。

## 1. 当前登录模式

当前支持三种进入方式：

- 游客模式
- 本地账号注册 / 登录
- Apple 登录

前端用户状态使用：

- `unauthenticated`
- `guest`
- `authenticated`

## 2. 游客模式现状

- 游客用户在前端由 `App.tsx` 构造，`id` 固定为 `guest_local`
- 游客身份会写入本地 `guest_user_v1`
- 游客数据主要走 localStorage fallback，不走鉴权接口
- 当前游客模式有数量限制，日志相关限制在前端交互里处理

重点：游客不是后端匿名账号，而是前端本地模式。

## 3. 本地账号登录现状

### 注册

后端接口：`POST /api/auth/register`

当前行为：

- 昵称唯一
- 邮箱如果提供，也必须唯一
- 注册成功后直接返回 token 和 user

### 登录

后端接口：`POST /api/auth/login`

当前行为：

- 支持通过昵称或邮箱登录
- 如果账号已经绑定 Apple 登录，会拦截普通密码登录
- 登录成功后返回 token 和 user

## 4. Apple 登录现状

### 前端

`components/Auth.tsx` 中只有原生 iOS 场景显示 Apple 登录按钮。

当前使用：

- `@capacitor-community/apple-sign-in`
- `VITE_APPLE_CLIENT_ID`
- `VITE_APPLE_REDIRECT_URI`

### 后端

后端接口：`POST /api/auth/apple`

当前行为：

- 校验 `identityToken`
- audience 来自 `APPLE_CLIENT_IDS` 或 `APPLE_CLIENT_ID`
- 优先按 `appleSubject` 找用户
- 若找不到且有 verified email，会尝试绑定已有邮箱账号
- 若仍找不到，则新建 Apple 用户
- Apple 用户默认返回 `authProvider: 'apple'`

## 5. token 与鉴权现状

### token 存储

- token 本地 key：`lifepulse_token`
- 登录成功后由 `App.tsx` 写入 localStorage

### 鉴权请求

- 前端统一通过 `services/apiClient.ts` 附带 `Authorization: Bearer <token>`
- 后端受保护接口通过 `authenticateToken` 校验

### 401 / 403 回收逻辑

`apiClient.ts` 当前行为：

- 如果接口返回 401 或 403
- 会删除 `lifepulse_token`
- 会删除 `guest_user_v1`
- 会派发 `unauthorized` 事件

`App.tsx` 会监听这个事件并执行：

- `handleLogout()`
- 弹出“登录已过期，请重新登录”提示

重点：改鉴权逻辑时，不要只改请求头，还要同步检查这条回收链路。

## 6. 登录后的本地数据上云现状

登录成功后，`App.tsx` 的 `handleLogin` 会做两件事：

1. 写入 token
2. 并发同步本地日志和本地聊天到云端

当前调用：

- `storageService.syncLocalToCloud()`
- `syncLocalChatToCloud()`

然后会重新拉取：

- `logs`
- `chatMessages`
- `goals`
- `plans`
- `rewardProfile`
- `rewardBadges`
- `rewardLedger`

重点：登录成功不是只切换 token，还会触发一次数据迁移和全量刷新。

## 7. 日志本地 / 云端存储现状

`services/storageService.ts` 当前采用“有 token 走后端，失败则 fallback 本地”策略。

### getLogs

- 有 token 时优先从后端取
- 成功后刷新本地缓存 `lifepulse_logs_v1`
- 后端失败时 fallback 到本地

### saveLog / updateLog / deleteLog

- 有 token 时优先调后端
- 后端失败时 fallback 到 localStorage

### syncLocalToCloud

- 会读取本地 `lifepulse_logs_v1`
- 如果有 token 且本地存在日志，会调用 `/api/logs/sync`

## 8. 聊天本地 / 云端存储现状

`services/chatService.ts` 也采用相同思路。

本地 key：`lifepulse_chat_messages_v1`

### fetchChatMessages

- 有 token 时优先走后端分页
- 成功后会合并并刷新本地缓存
- 后端失败时 fallback 到本地消息

### createChatMessage / deleteChatMessages

- 有 token 时优先走后端
- 后端失败时 fallback 到本地

### syncLocalChatToCloud

- 登录后会把本地消息通过 `/api/chat-messages/sync` 同步到云端

## 9. 修改登录或同步时必须一起检查的文件

- `components/Auth.tsx`
- `services/authService.ts`
- `services/apiClient.ts`
- `services/storageService.ts`
- `services/chatService.ts`
- `App.tsx`
- `server/routes/auth.js`
- `server/middleware/auth.js`
- `server/models/User.js`

## 10. 最低手测建议

- 游客进入正常
- 本地注册正常
- 本地登录正常
- Apple 登录在 iOS 原生容器里正常
- token 失效后能正确登出回收
- 登录成功后本地日志和聊天能同步到云端
- 登录后全局数据会重新刷新，而不是只刷新单一模块
