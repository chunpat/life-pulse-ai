# 掌控生活 · LifePulse AI

掌控生活是 LifePulse AI 的中文产品名。它把生活记录、财务记账和计划安排合并到一个对话式入口里，让你用一句话就能完成记录、识别和整理。

## 目录

- [核心功能](#核心功能)
- [技术架构](#技术架构)
- [环境准备](#环境准备)
- [快速开始](#快速开始)
- [iOS 原生开发](#ios-原生开发)
- [全平台路线图](#全平台路线图)
- [AI 协作参考](#ai-协作参考)
- [注意事项](#注意事项)

## 核心功能

- **对话式语音 / 文本入口**: 像聊天一样说一句，AI 会自动识别这是生活记录、财务记账，还是未来计划。
- **全能历史回顾**: 支持按关键词搜索、日期筛选及活动分类过滤，清晰展示生活轨迹。
- **计划与日历**: 支持把未来安排识别成 Plan，并在应用内查看今日、日历和清单视图。
- **AI 深度洞察**: 基于每日数据生成个性化总结，分析时间去向并提供改进建议。
- **多端同步与备份**: 支持用户注册登录，数据实时同步云端，同时提供一键导出 CSV/JSON 功能。
- **PWA 支持**: 可作为独立 App 安装至手机主屏幕，享受类原生的流畅体验。

## 技术架构

| 层级 | 技术栈 |
|------|--------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + Recharts |
| 后端 | Node.js + Express + Sequelize ORM |
| 数据库 | MySQL 8.x（支持 SQLite 回退） |
| AI | 阿里云通义千问 (Qwen)，通过后端代理调用，确保 API Key 不被泄露 |
| 移动端 | Capacitor 7 + 自定义 iOS 插件 (EventKit 同步) |
| 国际化 | i18next (中 / 英) |

## 环境准备

- [Node.js](https://nodejs.org/) (建议 v18.0.0 或更高版本)
- [MySQL](https://www.mysql.com/) (建议 8.0+)

## 快速开始

### 1. 克隆与安装

```bash
git clone https://github.com/your-repo/life-pulse-ai.git
cd life-pulse-ai

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
```

### 2. 后端环境配置

在 `server/` 目录下创建 `.env` 文件：

```env
PORT=5002
JWT_SECRET=your_jwt_secret_key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=你的数据库密码
DB_NAME=lifepulse_db
DB_SYNC_MODE=safe

# 阿里云通义千问 API Key
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
QWEN_MODEL=qwen-plus
QWEN_ENABLE_THINKING=false
```

> `qwen3.5-plus` 这类混合思考模型默认会先思考再回答。建议保持 `QWEN_ENABLE_THINKING=false`，能明显降低返回延迟。
>
> 数据库启动建议使用 `DB_SYNC_MODE=safe`。只有在明确要让 Sequelize 自动修改表结构时，才临时改成 `alter`，否则 MySQL 上可能重复堆叠唯一索引。

### 3. 启动项目

需要同时开启两个终端：

**终端 1 — 后端服务**:

```bash
cd server
node index.js
```

**终端 2 — 前端界面**:

```bash
npm run dev
```

浏览器访问 `http://localhost:3000` 即可使用。

## iOS 原生开发

当前仓库已接入 Capacitor 基础配置、iOS 工程壳和自定义计划同步插件骨架。

### 环境要求

除了 Node.js 外，还需要：

- Xcode（不是仅 Command Line Tools）
- CocoaPods
- 在 Xcode 的 Signing & Capabilities 中为 App Target 打开 `Sign In with Apple`

### 环境变量

根目录 `.env` 或 `.env.local` 中配置：

```env
VITE_NATIVE_API_BASE_URL=http://192.168.1.10:5002
```

### Apple 登录配置

- 前端（根目录 `.env`）：`VITE_APPLE_CLIENT_ID`，默认回退到 `ai.lifepulse.app`
- 后端（`server/.env`）：`APPLE_CLIENT_IDS=ai.lifepulse.app`
- 若同时接入 Web 版 Apple 登录，多个 client id 用逗号拼接：`APPLE_CLIENT_IDS=ai.lifepulse.app,com.example.web`

首次接入 Apple 登录时，服务启动会自动补齐 `Users.authProvider` 和 `Users.appleSubject` 字段及唯一索引，无需手动改表。

### 常用命令

```bash
# 构建前端并同步到 iOS 工程
npm run ios:build

# 仅同步 Capacitor 资源并补注册配置
npm run cap:sync:ios

# 在 Xcode 中打开 iOS 工程
npm run cap:open:ios
```

如果当前机器只有 Command Line Tools，`pod install` 会失败，需要先安装完整 Xcode 并执行：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## 全平台路线图

### 1. 核心体验与安全性（已完成）

- [x] 搜索与筛选：关键词、分类、日期多维度查询
- [x] 智能记账：AI 自动从对话中分离财务开支，支持独立账本管理与收支统计
- [x] 数据安全：后端中转 AI 请求，彻底解决 API Key 泄露风险
- [x] 数据导出：支持 CSV 及 JSON 原始数据导出

### 2. 智能化与体验增强（迭代中）

- [x] AI 深度洞察：支持日/周/月多维度个性化总结报告
- [x] PWA：支持手机桌面安装及离线图标
- [x] 持久化云同步：接入 MySQL，全端数据实时同步
- [ ] 多模态记录：计划支持图片附件、地点自动捕捉与天气记录
- [ ] 智能提醒：基于历史习惯提供个性化生活平衡建议

### 3. 全球化与原生出海（下一步核心）

将 LifePulse AI 打造为适应全球用户的通用产品，并登录主流应用商店。

- [ ] **国际化 (i18n) 架构**：引入 `i18next` 生态，支持中、英、日、西等多语言一键切换；针对不同语境优化 AI Prompt
- [ ] **App Store / Google Play 上架**：使用 Capacitor 进行原生封装
  - [x] 集成原生 iOS Apple Sign In
  - [ ] 集成 Google Login
  - [ ] Capacitor 工程、运行时 API 基址、自定义 iOS EventKit 插件骨架已接入，待完成 Xcode / pod install / 真机联调
- [ ] **全球化适配**：多币种支持 ($, €, £, ¥)、时区智能处理、欧盟 GDPR 隐私合规

### 4. 商业化探索（远期）

- [ ] AI 顾问订阅：接入更高级推理模型，提供一对一生活教练服务
- [ ] 高级报表：提供年度深度复盘 PDF 导出功能

## AI 协作参考

本项目为 AI 代码助手准备了多份参考文档：

| 文档 | 用途 |
|------|------|
| `AGENTS.md` | 通用代理入口说明 |
| `.github/copilot-instructions.md` | GitHub Copilot 专用详细说明 |
| `docs/README.md` | 文档总索引 |
| `docs/ai-dev-guide.md` | 独立开发指南 |
| `docs/feature-change-checklist.md` | 功能改动清单 |
| `docs/goals-rewards-domain-guide.md` | 目标 / 积分 / 徽章规则 |
| `docs/plans-ios-sync-domain-guide.md` | 计划 / iOS 同步规则 |
| `docs/auth-and-sync-domain-guide.md` | 登录 / 鉴权 / 本地同步规则 |
| `docs/ai-routing-log-domain-guide.md` | AI 分流 / 日志解析规则 |
| `docs/interface-change-template.md` | 接口变更模板 |

遇到不同需求时，优先查阅对应领域的规则文档。

## 注意事项

- **端口冲突**：macOS 上 5000/5001 端口可能被 AirPlay 占用，本项目已默认使用 **5002** 端口。
- **权限申请**：语音输入功能需在安全上下文（HTTPS 或 localhost）下运行，请根据浏览器提示允许麦克风权限。
- **i18n**：新增用户可见文案时，需同步更新 `locales/zh/translation.json` 和 `locales/en/translation.json`。

---

*掌控生活 - 用一句话管理记录、账本与计划。*
