
import { GoogleGenAI, Type } from "@google/genai";
import { LogEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseLifeLog = async (text: string): Promise<Partial<LogEntry>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请将以下日常记录笔记解析为结构化的 JSON 对象： "${text}"`,
    config: {
      systemInstruction: `你是一位专业的生活记录助手。你的任务是从用户的随手记笔记中提取活动和元数据。
      - 分类必须是以下之一：Work (工作), Leisure (休闲), Health (健康), Chores (琐事), Social (社交), Other (其他)。
      - 持续时间 (durationMinutes)：如果未提及，请根据活动内容估算一个合理的时长。
      - 心情 (mood)：用简洁的中文描述氛围（例如：开心、疲惫、高效）。
      - 重要程度 (importance)：从 1（琐碎）到 5（重要）进行评分。
      - 如果提到了多个活动，请关注主要活动或逻辑上合并它们。
      - 所有的文本字段（activity, mood）请使用中文回复。`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          activity: { type: Type.STRING },
          category: { type: Type.STRING, enum: ['Work', 'Leisure', 'Health', 'Chores', 'Social', 'Other'] },
          durationMinutes: { type: Type.NUMBER },
          mood: { type: Type.STRING },
          importance: { type: Type.NUMBER },
        },
        required: ["activity", "category", "durationMinutes", "mood", "importance"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text.trim());
    return data;
  } catch (e) {
    console.error("AI 解析失败", e);
    throw new Error("AI 无法结构化数据。");
  }
};

export const getDailyInsight = async (logs: LogEntry[]): Promise<string> => {
  if (logs.length === 0) return "开始记录你的第一条内容，获取 AI 洞察！";
  
  const logSummary = logs.map(l => `${l.activity} (耗时 ${l.durationMinutes}分钟, 类别 ${l.category})`).join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请回顾我的一天并提供一段简短、激励人心且具有分析性的中文总结，告诉我的时间都花在哪了，以及如何改进： ${logSummary}`,
    config: {
      systemInstruction: "字数控制在 100 字以内。语气要友好、专业且具有启发性。"
    }
  });
  
  return response.text.trim();
};
