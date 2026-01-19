const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authenticateToken = require('../middleware/auth');

const apiKey = process.env.DASHSCOPE_API_KEY;
const modelName = process.env.QWEN_MODEL || 'qwen-plus';

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// 解析生活日志 - 允许游客访问，前端负责次数限制
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: '请提供文本内容' });

    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 AI API Key' });
    }

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `你是一位专业的生活记录及财务助手。你的任务是从用户的随手记笔记中提取活动元数据以及财务消费情况。
请返回纯 JSON 格式，不要包含 Markdown 格式（如 \`\`\`json）。

1. **生活记录** (作为根对象的属性):
   - activity: 活动内容摘要
   - category: 必须是以下之一：Work, Leisure, Health, Chores, Social, Other。
   - durationMinutes: 估算时长(分钟)
   - mood: 心情(如：开心、疲惫、高效)
   - importance: 1-5分

2. **财务记录** (放入 finance 数组中, 如果没有则为空数组):
   - type: "EXPENSE" (支出) 或 "INCOME" (收入)
   - amount: 金额 (数字)
   - category: 类别 (如: 餐饮, 交通, 购物, 工资, 理财 等)
   - description: 描述

返回格式示例：
{
  "activity": "吃午饭并买书",
  "category": "Leisure",
  "durationMinutes": 60,
  "mood": "开心",
  "importance": 3,
  "finance": [
    { "type": "EXPENSE", "amount": 50, "category": "餐饮", "description": "午饭" },
    { "type": "EXPENSE", "amount": 100, "category": "购物", "description": "买书" }
  ]
}`
        },
        {
          role: "user",
          content: `请将以下日常记录笔记解析为结构化的 JSON 对象： "${text}"`
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    res.json(parsedData);
  } catch (error) {
    console.error("AI Parse Error:", error);
    res.status(500).json({ message: 'AI 解析失败', error: error.message });
  }
});

// 获取每日洞察
router.post('/insight', authenticateToken, async (req, res) => {
  try {
    const { logs } = req.body;
    if (!logs || !Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });

    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 AI API Key' });
    }

    const logSummary = logs.map(l => `${l.activity} (耗时 ${l.durationMinutes}分钟, 类别 ${l.category})`).join(', ');
  
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "user",
          content: `请回顾我的一天并提供一段简短、激励人心且具有分析性的中文总结，告诉我的时间都花在哪了，以及如何改进： ${logSummary}`
        }
      ]
    });
  
    res.json({ insight: response.choices[0].message.content || "无法生成洞察" });
  } catch (error) {
    console.error("AI Insight Error:", error);
    res.status(500).json({ message: '生成洞察失败', error: error.message });
  }
});

module.exports = router;
