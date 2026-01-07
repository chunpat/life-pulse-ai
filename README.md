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
