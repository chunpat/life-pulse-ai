
export interface LogEntry {
  id: string;
  userId?: string; // 为未来多用户预留
  timestamp: number;
  rawText: string;
  activity: string;
  category: 'Work' | 'Leisure' | 'Health' | 'Chores' | 'Social' | 'Other';
  durationMinutes: number;
  mood: string;
  importance: 1 | 2 | 3 | 4 | 5;
  createdAt?: number; // 数据库创建时间
  updatedAt?: number; // 数据库更新时间
}

export interface DaySummary {
  date: string;
  totalMinutes: number;
  categoryBreakdown: Record<string, number>;
  topMood: string;
  aiInsight: string;
}

export enum ViewMode {
  LOGGER = 'LOGGER',
  TIMELINE = 'TIMELINE',
  ANALYTICS = 'ANALYTICS'
}
