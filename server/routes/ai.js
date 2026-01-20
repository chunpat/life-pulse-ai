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

// 获取洞察 (每日/周/月)
router.post('/insight', authenticateToken, async (req, res) => {
  try {
    // period: 'day' | 'week' | 'month' (default: 'day')
    const { logs, period = 'day', lang = 'zh' } = req.body;
    if (!logs || !Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });

    if (!apiKey) {
      return res.status(500).json({ message: '服务器未配置 AI API Key' });
    }

    const logSummary = logs.map(l => `${l.activity} (耗时 ${l.durationMinutes}分钟, 类别 ${l.category})`).join(', ');

    const isEn = lang && lang.startsWith('en');
    const periodTextMap = isEn ? {
      'day': 'day',
      'week': 'week',
      'month': 'month'
    } : {
      'day': '一天',
      'week': '一周',
      'month': '一月'
    };
    const periodText = periodTextMap[period] || (isEn ? 'period' : '一段时间');
  
    const systemPrompt = isEn 
    ? `You are a keen life data analyst. Review the user's activity logs for the ${periodText} and return a JSON analysis report.
Please do NOT use Markdown formatting, return the JSON object directly.

JSON Structure Requirements:
{
  "summary": "A short summary (max 40 words, qualitative like 'Productive ${periodText}')",
  "bulletPoints": [
    { "icon": "👍", "text": "Highlights (e.g., Maintained exercise habit)" },
    { "icon": "📊", "text": "Time allocation (e.g., Work ratio is high)" },
    { "icon": "💡", "text": "Suggestions (e.g., Take short breaks)" }
  ]
}
Ensure bulletPoints array has at least 3 items.`
    : `你是一个敏锐的生活数据分析师。请回顾用户${periodText}的活动日志，并返回 JSON 格式的分析报告。
请不要使用 Markdown 格式，直接返回 JSON 对象。

JSON 结构要求：
{
  "summary": "一句简短的总结 (30字以内，要有如'高效充实的${periodText}'这种定性)",
  "bulletPoints": [
    { "icon": "👍", "text": "做得好的地方 (例如：坚持了运动习惯)" },
    { "icon": "📊", "text": "时间分配简评 (例如：工作时长占比过高)" },
    { "icon": "💡", "text": "具体的改进建议 (例如：建议增加每小时的短暂休息)" }
  ]
}
确保 bulletPoints 数组至少包含 3 条内容。`;

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: isEn ? `My activities for this ${periodText}: ${logSummary}` : `我的${periodText}活动：${logSummary}`
        }
      ],
      response_format: { type: "json_object" }
    });
  
    res.json({ insight: response.choices[0].message.content || "{}" });
  } catch (error) {
    console.error("AI Insight Error:", error);
    res.status(500).json({ message: '生成洞察失败', error: error.message });
  }
});

// 获取智能生活建议 (基于历史习惯)
router.post('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { logs, currentHour, currentWeekday } = req.body;
    
    if (!logs || !Array.isArray(logs)) return res.status(400).json({ message: '数据格式错误' });
    if (!apiKey) return res.status(500).json({ message: 'AI API Key 未配置' });

    // 只取最近 50 条记录避免 Token 溢出，重点看时间戳最近的
    const recentLogs = logs.slice(0, 50).map(l => 
      `[${new Date(l.timestamp).toLocaleDateString()} ${l.category}] ${l.activity} (${l.durationMinutes}m)`
    ).join('\n');

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `你是一个贴心的生活管家。请根据用户最近的活动日志，结合当前时间（星期${currentWeekday}，${currentHour}点），提供 1-2 条暖心的生活平衡建议。
          
关注点：
1. 是否过度劳累（连续长时间工作）？
2. 是否缺乏运动或休闲？
3. 作息是否规律？
4. 如果当前是深夜，提醒休息；如果是周末，建议放松。

请直接返回 JSON 格式：
{
  "suggestions": [
    { 
      "id": "gen-id",
      "type": "health" | "work_life_balance" | "productivity" | "other",
      "content": "建议内容，语气要像朋友一样自然温暖 (20字以内)",
      "trigger": "触发原因 (例如：检测到连续3天熬夜)"
    }
  ]
}`
        },
        {
          role: "user",
          content: `最近活动记录：\n${recentLogs}\n\n当前状态：今天是星期${currentWeekday}，现在是${currentHour}点。请给出建议。`
        }
      ],
      response_format: { type: "json_object" }
    });

    res.json(JSON.parse(response.choices[0].message.content || '{"suggestions": []}'));

  } catch (error) {
    console.error("AI Suggestion Error:", error);
    res.status(500).json({ message: '生成建议失败', error: error.message });
  }
});

module.exports = router;
