# LifePulse AI - 智能生活记录助手

LifePulse AI 是一个基于 Web 的智能生活日志应用，可以帮助你轻松记录日常活动，并利用 AI 分析你的时间分配、情绪状态和生活重心。

本项目针对中国大陆网络环境进行了优化，替换了所有受限资源，并集成了阿里云通义千问 (Qwen) 大模型。

## 主要功能

- **语音/文本记录**: 支持自然语言输入，AI 自动提取关键信息（活动、类别、时长、心情、重要性）。
- **历史时间轴**: 清晰展示每天的活动轨迹。
- **智能分析**: 可视化图表展示时间分布，AI 提供每日生活摘要和改进建议。
- **本地优先**: 数据存储在浏览器本地 (LocalStorage)，保护隐私。

## 特性

- ✅ **国内优化**: Tailwind CSS、字体等资源已替换为国内稳定 CDN。
- ✅ **通义千问**: 集成阿里云 Qwen-Plus 模型，提供强大的中文理解能力。
- ✅ **React + TypeScript**: 现代化前端技术栈，响应迅速。

## 快速开始

### 1. 准备工作

确保你的电脑已安装 [Node.js](https://nodejs.org/).

### 2. 获取 API Key

本项目使用阿里云通义千问模型，你需要获取一个 API Key：
1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/).
2. 开通 "通义千问" 服务（通常有免费额度）。
3. 创建一个新的 API Key。

### 3. 安装依赖

在项目根目录下运行：

```bash
npm install
```

如遇到网络问题，建议使用淘宝镜像：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 4. 配置环境变量

在项目根目录下创建一个名为 `.env` 的文件，并添加你的 API Key：

```env
# 请将 <YOUR_API_KEY> 替换为你实际的阿里云 API Key
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 可选：指定使用的模型 (默认使用 qwen-plus)
# 可选值: qwen-plus, qwen-plus-2025-12-01, qwen-turbo 等
QWEN_MODEL=qwen-plus
```

### 5. 启动项目

```bash
npm run dev
```

浏览器访问 `http://localhost:3000` 即可开始使用。

## 技术栈

- **前端框架**: React 19, Vite
- **UI 组件**: Tailwind CSS (Staticfile CDN), Recharts
- **AI模型**: 通义千问 (Qwen-Plus) via OpenAI SDK
- **开发语言**: TypeScript

## 注意事项

- 本项目通过前端直接调用 AI 接口，仅供个人学习和本地使用。请勿将包含 API Key 的代码部署到公共网络，以免 Key 被盗用。
- 首次使用可能需要允许浏览器的麦克风权限以使用语音输入功能。

## 全平台路线图 (Roadmap)

本项目致力于提供极致的跨端生活记录体验，计划支持 H5、PWA 以及 iOS/Android 原生应用。

### 1. 核心体验增强 (进行中)
- [x] **搜索与筛选**: 能够按关键词、分类或日期筛选历史记录。
- [x] **数据导出/备份**: 支持导出为 CSV (Excel 友好) 和 JSON 格式。
- [x] **筛选 UI 优化**: 采用折叠式设计，适配移动端窄屏。
- [ ] **多模态录入**: 支持图片附件纪录。

### 2. 跨端与 App 规划 (当前重点)
- [x] **PWA (Progressive Web App)**: 支持“添加到主屏幕”，提供离线图标和类原生体验。
- [ ] **Capacitor 原生化**:
    - 使用 Capacitor 将 Web 包装为 iOS/Android 原生工程。
    - 接入原生声音驱动，优化微信等环境下的录音成功率。
    - 适配原生系统级通知。
- [ ] **WeChat H5 适配**: 引入微信 JS-SDK，解决 iOS 微信内录音受限问题。

### 3. 数据云端同步 (中期)
- [ ] **后端架构**: 使用 Node.js 搭建中转服务，**保护 API Key 不被泄露**。
- [ ] **持久化存储**: 接入 MySQL 数据库，替换目前的 LocalStorage。
- [ ] **多端同步**: 确保手机 App、电脑网页数据实时同步。

### 4. AI 深度洞察 (长期)
- [ ] **周/月报生成**: AI 总结这一周/月的变化趋势。
- [ ] **智能提醒**: 根据历史规律，提醒用户平衡工作与休息。
- [ ] **情绪轨迹分析**: 深度分析情绪波动与活动之间的关联。
