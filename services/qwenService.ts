import { LogEntry, ParseResult } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/ai';

export const parseLifeLog = async (text: string, lang?: string): Promise<ParseResult> => {
  return apiClient(`${API_BASE_URL}/parse`, {
    method: 'POST',
    body: { text, lang }
  });
};

export const getDailyInsight = async (logs: LogEntry[], period: 'day' | 'week' | 'month' = 'day', lang: string = 'zh'): Promise<string> => {
  if (logs.length === 0) return JSON.stringify({ summary: "暂无数据", bulletPoints: [] });
  
  try {
    const data = await apiClient(`${API_BASE_URL}/insight`, {
      method: 'POST',
      body: { logs, period, lang }
    });
    return data.insight || "无法生成洞察";
  } catch (e) {
    return "暂时无法生成洞察";
  }
};

export const getSmartSuggestions = async (logs: LogEntry[], lang: string = 'zh'): Promise<any> => {
  if (logs.length === 0) return { suggestions: [] };

  const now = new Date();
  const currentHour = now.getHours();
  const currentWeekday = now.getDay(); // 0-6

  try {
    return await apiClient(`${API_BASE_URL}/suggestions`, {
      method: 'POST',
      body: { 
        logs: logs.slice(0, 50), 
        currentHour,
        currentWeekday,
        lang
      }
    });
  } catch (e) {
    return { suggestions: [] };
  }
};
