import { LogEntry } from '../types';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'lifepulse_logs_v1';
const TOKEN_KEY = 'lifepulse_token';
const API_BASE_URL = '/api/logs';
const UPLOAD_API_URL = '/api/upload';

export const storageService = {
  // 获取所有记录
  getLogs: async (): Promise<LogEntry[]> => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    // 如果有 token，优先从后端获取
    if (token) {
      try {
        const logs = await apiClient(API_BASE_URL);
        // 更新本地缓存，以便离线查看
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        return logs;
      } catch (e) {
        console.warn("Backend fetch failed, falling back to local storage", e);
      }
    }

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
    const token = localStorage.getItem(TOKEN_KEY);
    
    // 后端保存
    if (token) {
      try {
        await apiClient(API_BASE_URL, {
          method: 'POST',
          body: entry
        });
        // 注意：getLogs 已经更新了本地缓存，我们只需确保合并
        return;
      } catch (e) {
        console.error("Backend save failed", e);
      }
    }

    // 游客模式或后端失败的本地 fallback
    const logs = await storageService.getLogs();
    const newLogs = [entry, ...logs];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  },

  // 删除记录
  deleteLog: async (id: string): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (token) {
      try {
        await apiClient(`${API_BASE_URL}/${id}`, {
          method: 'DELETE'
        });
        return;
      } catch (e) {
        console.error("Backend delete failed", e);
      }
    }

    const logs = await storageService.getLogs();
    const newLogs = logs.filter(log => log.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  },

  // 更新记录
  updateLog: async (updatedLog: LogEntry): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (token) {
      try {
        await apiClient(`${API_BASE_URL}/${updatedLog.id}`, {
          method: 'PUT',
          body: updatedLog
        });
        return;
      } catch (e) {
        console.error("Backend update failed", e);
      }
    }

    const logs = await storageService.getLogs();
    const newLogs = logs.map(log => log.id === updatedLog.id ? updatedLog : log);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
  },

  // 同步本地数据到云端 (用于登录后)
  syncLocalToCloud: async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    const localLogs = localStorage.getItem(STORAGE_KEY);
    
    if (token && localLogs) {
      try {
        const logs = JSON.parse(localLogs);
        if (logs.length === 0) return;

        await apiClient(`${API_BASE_URL}/sync`, {
          method: 'POST',
          body: { logs }
        });
        
        console.log("Sync local logs to cloud successful");
      } catch (e) {
        console.error("Sync to cloud failed", e);
      }
    }
  },

  // 上传图片到腾讯云 COS
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const data = await apiClient(`${UPLOAD_API_URL}/image`, {
      method: 'POST',
      body: formData
    });

    return data.url;
  }
};

