# 掌控生活 · LifePulse AI

掌控生活是 LifePulse AI 的中文产品名。它把生活记录、财务记账和计划安排合并到一个对话式入口里，让你用一句话就能完成记录、识别和整理。

## 🌟 核心功能

- **对话式语音 / 文本入口**: 像聊天一样说一句，AI 会自动识别这是生活记录、财务记账，还是未来计划。
- **全能历史回顾**: 支持按关键词搜索、日期筛选及活动分类过滤，清晰展示生活轨迹。
- **计划与日历雏形**: 支持把未来安排识别成 Plan，并在应用内查看今日、日历和清单视图。
- **AI 深度洞察**: 基于每日数据生成个性化总结，分析时间去向并提供改进建议。
- **多端同步与备份**: 支持用户注册登录，数据实时同步云端。同时提供一键导出 CSV/JSON 功能。
- **PWA 支持**: 可作为独立 App 安装至手机主屏幕，享受类原生的流畅体验。

## 🚀 技术架构

本项目采用全栈分离架构，并在安全性与性能上做了深度优化：

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Recharts。
- **后端**: Node.js + Express + Sequelize ORM。
- **数据库**: MySQL 8.x。
- **AI 能力**: 阿里云通义千问 (Qwen) 通过后端代理调用，**确保 API Key 不被泄露**。

## 🛠️ 环境准备

- [Node.js](https://nodejs.org/) (建议 v18.0.0 或更高版本)
- [MySQL](https://www.mysql.com/) (建议 8.0+)

## 📦 快速开始

### 1. 克隆与安装

```bash
# 克隆项目
git clone https://github.com/your-repo/life-pulse-ai.git
cd life-pulse-ai

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
```

### 2. 环境配置

#### 后端配置 (server/.env)
在 `server` 文件夹下创建 `.env` 文件：
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

`qwen3.5-plus` 这类混合思考模型默认会先思考再回答。如果你用它来做日志解析、洞察和建议，建议保持 `QWEN_ENABLE_THINKING=false`，能明显降低返回延迟。

数据库启动默认建议使用 `DB_SYNC_MODE=safe`。只有在你明确要让 Sequelize 自动修改表结构时，才临时改成 `alter`，否则 MySQL 上可能重复堆叠唯一索引。

### 3. 运行项目

你需要同时开启两个终端：

**终端 1 (后端服务)**:
```bash
cd server
node index.js
```

**终端 2 (前端界面)**:
```bash
# 回到项目根目录
npm run dev
```

浏览器访问 `http://localhost:3000` 即可使用。

## 🗺️ 全平台路线图 (Roadmap)

### 1. 核心体验与安全性 (已完成)
- [x] **搜索与筛选**: 关键词、分类、日期多维度查询。
- [x] **智能记账**: AI 自动从对话中分离财务开支，支持独立账本管理与收支统计。
- [x] **数据安全**: 后端中转 AI 请求，彻底解决 API Key 泄露风险。
- [x] **数据导出**: 支持 Excel 友好的 CSV 格式及 JSON 原始数据导出。

### 2. 智能化与体验增强 (迭代中)
- [x] **AI 深度洞察**: 支持日/周/月多维度生成个性化总结报告。
- [x] **PWA (Progressive Web App)**: 支持手机桌面安装及离线图标。
- [x] **持久化云同步**: 接入 MySQL，全端数据实时同步。
- [ ] **多模态纪录**: 计划支持图片附件、地点自动捕捉与天气记录。
- [ ] **智能提醒**: 基于历史习惯提供个性化生活平衡建议。

### 3. 全球化与原生出海 (下一步核心)
这一阶段的目标是将 LifePulse AI 打造为适应全球用户的通用产品，并登录主流应用商店。
- [ ] **国际化 (i18n) 架构**: 
    - 引入 `i18next` 生态，支持中、英、日、西等多语言一键切换。
    - 针对不同语境优化 AI Prompt，确保洞察建议符合当地文化。
- [ ] **App Store / Google Play 上架**: 
    - 使用 **Capacitor** 进行原生封装，适配 iOS 安全区域与原生手势。
    - 集成 Apple Sign In 与 Google Login。
- [ ] **全球化适配**:
    - **多币种支持**: 财务模块支持根据地区自动切换货币符号 ($, €, £, ¥) 及汇率估算。
    - **时区智能处理**: 解决跨国旅行时的时区偏移问题，确保日志时间准确。
    - **合规性**: 针对欧盟 GDPR 的隐私合规升级（数据导出与彻底删除）。

### 4. 商业化探索 (远期)
- [ ] **AI 顾问订阅**: 接入更高级推理模型，提供一对一生活教练服务。
- [ ] **高级报表**: 提供年度深度复盘 pdf 导出功能。

### 5. IOS APP, 单向同步，App 为主
- [ ] Capacitor + 自定义 iOS 插件；本地存 externalId；删除/编辑同步落系统侧

## 🛡️ 注意事项

- **端口冲突**: 在 macOS 上，如果 5000/5001 端口被系统 AirPlay 占用，本项目已默认切换至 **5002** 端口。
- **权限申请**: 语音输入功能需在安全上下层（HTTPS 或 localhost）下运行，请根据浏览器提示允许麦克风权限。

---
*掌控生活 - 用一句话管理记录、账本与计划。*
