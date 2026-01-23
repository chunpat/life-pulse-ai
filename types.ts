
export type AuthStatus = 'unauthenticated' | 'guest' | 'authenticated';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  status: AuthStatus;
}

export interface LogEntry {
  id: string;
  userId: string; // 必填，游客使用 'guest_local'
  timestamp: number;
  rawText: string;
  activity: string;
  category: 'Work' | 'Leisure' | 'Health' | 'Chores' | 'Social' | 'Other';
  durationMinutes: number;
  mood: string;
  importance: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  images?: string[];
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface DaySummary {
  date: string;
  totalMinutes: number;
  categoryBreakdown: Record<string, number>;
  topMood: string;
  aiInsight: string;
}


export interface FinanceRecord {
  id?: string;
  userId?: string;
  logId?: string; // 关联的日志ID
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  currency?: string;
  category: string;
  description?: string;
  transactionDate: string;
}

export interface ParseResult extends Partial<LogEntry> {
  finance?: FinanceRecord[];
}

export enum ViewMode {
  LOGGER = 'LOGGER',
  TIMELINE = 'TIMELINE',
  ANALYTICS = 'ANALYTICS',
  FINANCE = 'FINANCE'
}
