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

export const getDailyInsight = async (logs: LogEntry[]): Promise<string> => {
  if (logs.length === 0) return "开始记录你的第一条内容，获取 AI 洞察！";
  
  const response = await fetch(`${API_BASE_URL}/insight`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ logs })
  });

  if (!response.ok) {
    return "暂时无法生成洞察";
  }

  const data = await response.json();
  return data.insight || "无法生成洞察";
};
