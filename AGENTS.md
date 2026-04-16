# LifePulse AI Agent Guide

这是给通用代码代理的入口版说明。详细规则不要堆在这里，统一从下列文档进入：

- 文档总入口：`docs/README.md`
- Copilot 详细说明：`.github/copilot-instructions.md`
- 独立开发指南：`docs/ai-dev-guide.md`

## 项目一句话

这是一个前后端分离的生活记录应用。聊天输入不是纯 IM，而是统一入口，会分流到日志、计划、目标、奖励等业务。

## 最先该看的文件

- `App.tsx`：前端全局状态中心
- `components/Logger.tsx`：聊天 / 日志 / 计划统一入口
- `server/index.js`：后端启动与路由挂载
- `types.ts`：前端核心类型入口

## 关键边界

- 前端：React 19 + TypeScript + Vite + Tailwind
- 后端：Node.js + Express + Sequelize
- AI 调用必须经后端 `/api/ai`，不要把密钥或直连逻辑放前端
- 游客模式走本地存储，登录用户走云端接口

## 本地运行

- 前端：`npm run dev`
- 后端：`cd server && node index.js`
- 前端构建：`npm run build`
- iOS 同步构建：`npm run ios:build`

## 遇到不同需求时先去哪

- 改目标 / 积分 / 徽章：`docs/goals-rewards-domain-guide.md`
- 改计划 / iOS 同步：`docs/plans-ios-sync-domain-guide.md`
- 改登录 / token / 本地同步：`docs/auth-and-sync-domain-guide.md`
- 改 AI 分流 / 日志解析：`docs/ai-routing-log-domain-guide.md`
- 改接口：`docs/interface-change-template.md`
- 改现有功能前先过清单：`docs/feature-change-checklist.md`

## 最小工作约定

- 改接口时先检查前端 `services/*.ts` 与后端 `server/routes/*.js` 是否对应
- 改后端后默认需要重启进程
- 新增用户可见文案时同步更新中英文翻译
- 优先做最小改动，不要顺手重构 `App.tsx` 或 `components/Logger.tsx`