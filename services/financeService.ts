import { FinanceRecord } from '../types';

const API_BASE_URL = '/api/finance';

const getAuthHeader = () => {
  const token = localStorage.getItem('lifepulse_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const fetchFinanceRecords = async (): Promise<FinanceRecord[]> => {
  const response = await fetch(API_BASE_URL, {
    headers: getAuthHeader()
  });
  if (!response.ok) throw new Error('Failed to fetch finance records');
  return response.json();
};

export const fetchFinanceStats = async (startDate?: string, endDate?: string): Promise<any> => {
    let url = `${API_BASE_URL}/stats`;
    if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await fetch(url, { headers: getAuthHeader() });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
};

export const createFinanceRecord = async (record: Partial<FinanceRecord>): Promise<FinanceRecord> => {
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
};

export const deleteFinanceRecord = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  if (!response.ok) throw new Error('Failed to delete record');
};
