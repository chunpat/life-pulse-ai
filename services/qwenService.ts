import OpenAI from 'openai';
import { LogEntry } from '../types';

// Use polyfilled process.env from vite define or import.meta.env
// The vite config needs to be updated to expose DASHSCOPE_API_KEY
const apiKey = process.env.DASHSCOPE_API_KEY || '';

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  dangerouslyAllowBrowser: true 
});

export const parseLifeLog = async (text: string): Promise<Partial<LogEntry>> => {
  if (!apiKey) {
    throw new Error("请先配置 DASHSCOPE_API_KEY 环境变量");
  }

  const response = await client.chat.completions.create({
    model: "qwen-plus",
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

  try {
    console.log("API Response:", response); // 调试日志
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error("API 返回的响应格式不正确");
    }
    
    const content = response.choices[0].message.content;
    console.log("Content:", content); // 调试日志
    
    if (!content) {
      throw new Error("API 返回的内容为空");
    }
    
    // 尝试清理内容中的多余字符
    const cleanedContent = content.trim();
    console.log("Cleaned content:", cleanedContent); // 调试日志
    
    const data = JSON.parse(cleanedContent);
    console.log("Parsed data:", data); // 调试日志
    
    return data;
  } catch (e) {
    console.error("AI 解析失败", e);
    console.error("原始响应:", response);
    throw new Error(`AI 无法结构化数据: ${e.message}`);
  }
};

export const getDailyInsight = async (logs: LogEntry[]): Promise<string> => {
   if (!apiKey) {
    return "请配置 API Key 以获取 AI 洞察。";
  }
  if (logs.length === 0) return "开始记录你的第一条内容，获取 AI 洞察！";
  
  const logSummary = logs.map(l => `${l.activity} (耗时 ${l.durationMinutes}分钟, 类别 ${l.category})`).join(', ');
  
  const response = await client.chat.completions.create({
    model: "qwen-plus",
    messages: [
       {
        role: "user",
        content: `请回顾我的一天并提供一段简短、激励人心且具有分析性的中文总结，告诉我的时间都花在哪了，以及如何改进： ${logSummary}`
       }
    ]
  });
  
  return response.choices[0].message.content || "无法生成洞察";
};
