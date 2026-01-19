# LifePulse AI - 智能生活记录助手

LifePulse AI 是一个基于 AI 和 Web 技术的智能生活日志应用。它通过自然语言处理技术，帮助你轻松记录日常活动，并生成多维度的可视化分析与 AI 生活洞察。

## 🌟 核心功能

- **智能语音/文本录入**: 随手记下一句话，AI 自动提取活动名称、分类（工作、健康、琐事等）、时长、心情及重要程度。
- **全能历史回顾**: 支持按关键词搜索、日期筛选及活动分类过滤，清晰展示生活轨迹。
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

# 阿里云通义千问 API Key
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
QWEN_MODEL=qwen-plus
```

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

### 2. 跨端与 App 增强 (进行中)
- [x] **PWA (Progressive Web App)**: 支持手机桌面安装及离线图标。
- [x] **持久化云同步**: 接入 MySQL，完成从 LocalStorage 到云端数据库的无缝迁移。
- [ ] **多模态纪录**: 计划支持图片附件和地点捕捉。
- [ ] **Capacitor 原生化**: 计划包装为正式的 iOS/Android 应用。

### 3. AI 深度洞察 (长期)
- [ ] **周/月报汇总**: AI 自动生成长期生活趋势报告。
- [ ] **智能提醒**: 基于历史习惯提供个性化平衡建议。

## 🛡️ 注意事项

- **端口冲突**: 在 macOS 上，如果 5000/5001 端口被系统 AirPlay 占用，本项目已默认切换至 **5002** 端口。
- **权限申请**: 语音输入功能需在安全上下层（HTTPS 或 localhost）下运行，请根据浏览器提示允许麦克风权限。

---
*LifePulse AI - 记录生活脉动，开启数字觉察。*
