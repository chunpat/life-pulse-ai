import { LogEntry } from '../types';

const STORAGE_KEY = 'lifepulse_logs_v1';

// 这是一个数据抽象层，未来你可以轻松地将这些函数改为调用后端 API (fetch/axios)
export const storageService = {
  // 获取所有记录
  getLogs: async (): Promise<LogEntry[]> => {
    // 未来这里可以改为: return fetch('/api/logs').then(res => res.json());
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse logs", e);
      return [];
    }
  },

  // 保存记录
  saveLog: async (entry: LogEntry): Promise<void> => {
    // 未来这里可以改为: return fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
    const logs = await storageService.getLogs();
    const newLogs = [entry, ...logs];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  },

  // 删除记录
  deleteLog: async (id: string): Promise<void> => {
    // 未来这里可以改为: return fetch(`/api/logs/${id}`, { method: 'DELETE' });
    const logs = await storageService.getLogs();
    const newLogs = logs.filter(log => log.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  }
};
