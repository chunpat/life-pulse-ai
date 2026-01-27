import { FinanceRecord } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/finance';
const FINANCE_STORAGE_KEY = 'lifepulse_finance_v1';

const getLocalRecords = (): FinanceRecord[] => {
  const saved = localStorage.getItem(FINANCE_STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
};

const saveLocalRecords = (records: FinanceRecord[]) => {
  localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(records));
};

export const fetchFinanceRecords = async (): Promise<FinanceRecord[]> => {
  const token = localStorage.getItem('lifepulse_token');
  
  if (token) {
    try {
      const data = await apiClient(API_BASE_URL);
      saveLocalRecords(data);
      return data;
    } catch (e) {
      console.warn('Failed to fetch from backend, falling back to local', e);
    }
  }
  
  return getLocalRecords();
};

export const fetchFinanceStats = async (startDate?: string, endDate?: string): Promise<any> => {
    const token = localStorage.getItem('lifepulse_token');
    
    if (token) {
        return apiClient(`${API_BASE_URL}/stats`, {
            params: startDate && endDate ? { startDate, endDate } : undefined
        });
    }
    
    // Calculate stats locally for guest mode or offline
    const records = getLocalRecords();
    const filtered = records.filter(r => {
        if (!startDate || !endDate) return true;
        const d = new Date(r.transactionDate).getTime();
        return d >= new Date(startDate).getTime() && d <= new Date(endDate).getTime();
    });
    
    return filtered.reduce((acc, record) => {
        const amount = Number(record.amount);
        if (record.type === 'EXPENSE') {
            acc.totalExpense += amount;
            acc.byCategory[record.category] = (acc.byCategory[record.category] || 0) + amount;
        } else {
            acc.totalIncome += amount;
        }
        return acc;
    }, { totalExpense: 0, totalIncome: 0, byCategory: {} as Record<string, number> });
};

export const createFinanceRecord = async (record: Partial<FinanceRecord>): Promise<FinanceRecord> => {
  const token = localStorage.getItem('lifepulse_token');

  if (token) {
    return apiClient(API_BASE_URL, {
        method: 'POST',
        body: record
    });
  }

  // Local/Guest mode
  const newRecord = {
      ...record,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: 'guest_local',
      transactionDate: record.transactionDate || new Date().toISOString()
  } as FinanceRecord;

  const records = getLocalRecords();
  records.unshift(newRecord);
  saveLocalRecords(records);
  
  return newRecord;
};

// 新增：批量同步(更新/覆盖)某个日志的财务记录
export const syncFinanceRecordsForLog = async (logId: string, records: Partial<FinanceRecord>[]): Promise<void> => {
  const token = localStorage.getItem('lifepulse_token');

  if (token) {
    return apiClient(`${API_BASE_URL}/sync/${logId}`, {
        method: 'POST',
        body: { records }
    });
  }

  // Local/Guest mode: Remove old logs with this logId and add new ones
  const allRecords = getLocalRecords();
  const keptRecords = allRecords.filter(r => r.logId !== logId);
  
  const newRecords = records.map(r => ({
      ...r,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: 'guest_local',
      logId: logId,
      transactionDate: r.transactionDate || new Date().toISOString()
  })) as FinanceRecord[];

  saveLocalRecords([...newRecords, ...keptRecords]);
};

export const deleteFinanceRecord = async (id: string): Promise<void> => {
  const token = localStorage.getItem('lifepulse_token');

  if (token) {
    return apiClient(`${API_BASE_URL}/${id}`, {
        method: 'DELETE'
    });
  }

  // Local/Guest mode
  const records = getLocalRecords();
  const newRecords = records.filter(r => r.id !== id);
  saveLocalRecords(newRecords);
};
