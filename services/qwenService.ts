import { LogEntry, ParseResult } from '../types';

const API_BASE_URL = '/api/ai';

const getAuthHeader = () => {
  const token = localStorage.getItem('lifepulse_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const parseLifeLog = async (text: string): Promise<ParseResult> => {
  const response = await fetch(`${API_BASE_URL}/parse`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'AI 解析失败');
  }

  return response.json();
};

export const getDailyInsight = async (logs: LogEntry[], period: 'day' | 'week' | 'month' = 'day'): Promise<string> => {
  if (logs.length === 0) return JSON.stringify({ summary: "暂无数据", bulletPoints: [] });
  
  const response = await fetch(`${API_BASE_URL}/insight`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ logs, period })
  });

  if (!response.ok) {
    return "暂时无法生成洞察";
  }

  const data = await response.json();
  return data.insight || "无法生成洞察";
};
