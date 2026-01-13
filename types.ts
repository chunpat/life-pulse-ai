
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

export enum ViewMode {
  LOGGER = 'LOGGER',
  TIMELINE = 'TIMELINE',
  ANALYTICS = 'ANALYTICS'
}
