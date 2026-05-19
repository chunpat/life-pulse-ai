# CLAUDE.md

## 项目一句话

前后端分离的生活记录应用。聊天输入是统一入口，会分流到日志、计划、目标、奖励等业务。

## 常用命令

```bash
# 前端开发（端口 3000，/api 代理到后端 5002）
npm run dev

# 后端启动
cd server && node index.js

# 前端构建
npm run build

# iOS 构建 + 同步
npm run ios:build

# 同步 Capacitor 资源
npm run cap:sync:ios

# 在 Xcode 中打开 iOS 工程
npm run cap:open:ios

# 填充官方案例数据
npm run seed:official-demo
```

## 关键文件

| 文件 | 角色 |
|------|------|
| `App.tsx` | 前端全局状态中心（登录态、视图切换、数据刷新） |
| `components/Logger.tsx` | 聊天/日志/计划统一入口，最复杂的组件（130K） |
| `server/index.js` | 后端启动与路由挂载 |
| `types.ts` | 前端核心类型入口 |
| `server/routes/ai.js` | AI 解析、洞察、建议接口 |
| `server/services/goalService.js` | 目标核心业务逻辑 |

## 架构边界

- **前端**: React 19 + TypeScript + Vite + Tailwind，组件和 services 都在根目录（无 `src/`）
- **后端**: Node.js + Express 5 + Sequelize ORM（MySQL 主，SQLite 回退），`server/` 是独立 npm 项目
- **AI 调用**: 必须经后端 `/api/ai`，**禁止**在前端直连或暴露 API Key
- **认证**: 游客模式走 localStorage，登录用户走 JWT + 云端接口
- **iOS 同步**: 通过自定义 Capacitor 插件 `LifePulsePlanSync` 对接原生 EventKit

## 领域文档索引

改不同模块时，先看对应规则文档：

| 需求 | 文档 |
|------|------|
| 目标 / 积分 / 徽章 | `docs/goals-rewards-domain-guide.md` |
| 计划 / iOS 同步 | `docs/plans-ios-sync-domain-guide.md` |
| 登录 / token / 本地同步 | `docs/auth-and-sync-domain-guide.md` |
| AI 分流 / 日志解析 | `docs/ai-routing-log-domain-guide.md` |
| 接口变更 | `docs/interface-change-template.md` |
| 改现有功能前 | `docs/feature-change-checklist.md` |
| 总体开发流程 | `docs/ai-dev-guide.md` |

## 工作约定

- 改接口时同步检查前端 `services/*.ts` 与后端 `server/routes/*.js`
- 改后端后需要重启进程
- 新增用户可见文案时同步更新 `locales/zh/` 和 `locales/en/`
- `App.tsx` 和 `components/Logger.tsx` 是高危文件，优先做最小改动
- 设计稿（`GOAL_REWARDS_BADGES_DESIGN.md` 等）描述的是目标方案，不等于当前实现；以领域规则文档和当前代码为准
