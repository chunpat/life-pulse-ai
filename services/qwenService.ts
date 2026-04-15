import { LogEntry, ParseResult } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/ai';

export interface SmartSuggestion {
  id?: string;
  content: string;
  type: string;
  trigger: string;
}

export interface ParseContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const normalizeSmartSuggestion = (payload: unknown): SmartSuggestion | null => {
  const candidates = Array.isArray((payload as { suggestions?: unknown[] } | null)?.suggestions)
    ? (payload as { suggestions: unknown[] }).suggestions
    : [payload];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const content = typeof (candidate as { content?: unknown }).content === 'string'
      ? (candidate as { content: string }).content.trim()
      : '';

    if (!content) {
      continue;
    }

    const type = typeof (candidate as { type?: unknown }).type === 'string'
      && (candidate as { type: string }).type.trim()
      ? (candidate as { type: string }).type.trim()
      : 'other';

    const trigger = typeof (candidate as { trigger?: unknown }).trigger === 'string'
      ? (candidate as { trigger: string }).trigger.trim()
      : '';

    const id = typeof (candidate as { id?: unknown }).id === 'string'
      && (candidate as { id: string }).id.trim()
      ? (candidate as { id: string }).id.trim()
      : undefined;

    return {
      id,
      content,
      type,
      trigger
    };
  }

  return null;
};

export const parseLifeLog = async (
  text: string,
  lang?: string,
  mode: 'auto' | 'log' = 'auto',
  context: ParseContextMessage[] = []
): Promise<ParseResult> => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return apiClient(`${API_BASE_URL}/parse`, {
    method: 'POST',
    body: { text, lang, timezone, mode, context }
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

export const getSmartSuggestions = async (logs: LogEntry[], lang: string = 'zh'): Promise<SmartSuggestion | null> => {
  if (logs.length === 0) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentWeekday = now.getDay(); // 0-6

  try {
    const data = await apiClient(`${API_BASE_URL}/suggestions`, {
      method: 'POST',
      body: { 
        logs: logs.slice(0, 50), 
        currentHour,
        currentWeekday,
        lang
      }
    });
    return normalizeSmartSuggestion(data);
  } catch (e) {
    return null;
  }
};
