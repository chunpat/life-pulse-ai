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

// 解析生活日志
router.post('/parse', authenticateToken, async (req, res) => {
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
          content: `你是一位专业的生活记录助手。你的任务是从用户的随手记笔记中提取活动和元数据。
请返回纯 JSON 格式，不要包含 Markdown 格式（如 \`\`\`json）。
- 分类 (category) 必须是以下之一：Work, Leisure, Health, Chores, Social, Other。
- 持续时间 (durationMinutes)：如果未提及，请根据活动内容估算一个合理的时长（分钟）。
- 心情 (mood)：用简洁的中文描述氛围（例如：开心、疲惫、高效）。
- 重要程度 (importance)：从 1（琐碎）到 5（重要）进行评分，数字类型。
- 如果提到了多个活动，请关注主要活动或逻辑上合并它们。
- 所有的文本字段（activity, mood）请使用中文回复。

返回格式示例：
{
  "activity": "写代码",
  "category": "Work",
  "durationMinutes": 60,
  "mood": "专注",
  "importance": 5
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
