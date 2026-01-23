import { FinanceRecord } from '../types';

const API_BASE_URL = '/api/finance';
const FINANCE_STORAGE_KEY = 'lifepulse_finance_v1';

const getAuthHeader = () => {
  const token = localStorage.getItem('lifepulse_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

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
      const response = await fetch(API_BASE_URL, {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        saveLocalRecords(data);
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch from backend, falling back to local', e);
    }
  }
  
  return getLocalRecords();
};

export const fetchFinanceStats = async (startDate?: string, endDate?: string): Promise<any> => {
    const token = localStorage.getItem('lifepulse_token');
    
    if (token) {
        let url = `${API_BASE_URL}/stats`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const response = await fetch(url, { headers: getAuthHeader() });
        if (!response.ok) throw new Error('Failed to fetch stats');
        return response.json();
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
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
    });
    if (!response.ok) throw new Error('Failed to create record');
    return response.json();
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
    const response = await fetch(`${API_BASE_URL}/sync/${logId}`, {
        method: 'POST',
        headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records })
    });
    if (!response.ok) throw new Error('Failed to sync records');
    return;
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
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
    });
    if (!response.ok) throw new Error('Failed to delete record');
    return;
  }

  // Local/Guest mode
  const records = getLocalRecords();
  const newRecords = records.filter(r => r.id !== id);
  saveLocalRecords(newRecords);
};
