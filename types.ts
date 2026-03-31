
export type AuthStatus = 'unauthenticated' | 'guest' | 'authenticated';

export type GoalType = '7_DAY' | '21_DAY';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed';
export type GoalRewardRole = 'tracking' | 'primary';
export type GoalPlanScope = 'personal' | 'official';
export type PlanType = 'reminder' | 'event';
export type PlanStatus = 'pending' | 'completed' | 'cancelled';
export type PlanSource = 'manual' | 'ai' | 'imported';
export type PlanSyncTarget = 'none' | 'ios-reminder' | 'ios-calendar';
export type PlanSyncState = 'local-only' | 'pending-sync' | 'synced' | 'conflict' | 'permission-denied' | 'failed';
export type ChatMessageRole = 'user' | 'assistant';
export type ChatMessageType = 'text' | 'confirmation';

export interface LogGoalCheckin {
  goalId: string;
  goalLabel: string;
  dayNumber: number;
}

export interface GoalCreateInput {
  goalType: GoalType;
  title?: string;
  rewardTitle?: string;
  officialPlanTemplateId?: string;
}

export interface Plan {
  id: string;
  userId: string;
  title: string;
  notes?: string | null;
  planType: PlanType;
  status: PlanStatus;
  source: PlanSource;
  startAt?: number | null;
  endAt?: number | null;
  dueAt?: number | null;
  isAllDay: boolean;
  timezone?: string | null;
  reminderAt?: number | null;
  syncTarget: PlanSyncTarget;
  syncState: PlanSyncState;
  externalId?: string | null;
  externalContainerId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanCreateInput {
  title: string;
  notes?: string;
  planType: PlanType;
  source?: PlanSource;
  startAt?: number | null;
  endAt?: number | null;
  dueAt?: number | null;
  isAllDay?: boolean;
  timezone?: string;
  reminderAt?: number | null;
  syncTarget?: PlanSyncTarget;
  metadata?: Record<string, unknown>;
}

export interface PlanUpdateInput {
  title?: string;
  notes?: string | null;
  planType?: PlanType;
  status?: PlanStatus;
  startAt?: number | null;
  endAt?: number | null;
  dueAt?: number | null;
  isAllDay?: boolean;
  timezone?: string | null;
  reminderAt?: number | null;
  syncTarget?: PlanSyncTarget;
  syncState?: PlanSyncState;
  externalId?: string | null;
  externalContainerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PlanListQuery {
  status?: PlanStatus;
  planType?: PlanType;
  startDate?: string;
  endDate?: string;
  syncTarget?: PlanSyncTarget;
  keyword?: string;
  limit?: string;
}

export interface PlanParseResult {
  title: string;
  notes?: string;
  planType: PlanType;
  startAt?: number | null;
  endAt?: number | null;
  dueAt?: number | null;
  isAllDay?: boolean;
  reminderAt?: number | null;
  syncTargetSuggestion?: PlanSyncTarget;
  confidence?: number;
  originalText?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isOfficial?: boolean;
  status: AuthStatus;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  rewardTitle?: string | null;
  goalType: GoalType;
  totalDays: number;
  completedDays: number;
  currentStreak: number;
  startedAt: number;
  completedAt?: number | null;
  lastCheckInDate?: string | null;
  status: GoalStatus;
  planScope: GoalPlanScope;
  officialPlanId?: string | null;
  rewardRole: GoalRewardRole;
  completionPointsAwarded: number;
  completionBadgeCode?: string | null;
  completionBadgeTitle?: string | null;
  completionBadgeIssuedAt?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficialPlanTemplate {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  goalType: GoalType;
  totalDays: number;
  completionPoints: number;
  badgeCode: string;
  badgeTitle: string;
  badgeShortTitle: string;
  accentColor?: string | null;
  isPublished: boolean;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardBadge {
  id: string;
  goalId?: string | null;
  badgeCode: string;
  title: string;
  shortTitle: string;
  family: string;
  status: 'active' | 'revoked';
  issuedAt: number;
  accentColor: string;
  planScope: GoalPlanScope;
  officialPlanTitle?: string | null;
  theme?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardLedgerEntry {
  id: string;
  eventType: string;
  amount: number;
  balanceAfter: number;
  goalId?: string | null;
  logId?: string | null;
  badgeId?: string | null;
  status: 'posted' | 'reversed' | 'pending';
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardProfile {
  availablePoints: number;
  lifetimePoints: number;
  spentPoints: number;
  level: number;
  levelStepPoints: number;
  currentLevelFloor: number;
  nextLevelThreshold: number;
  pointsIntoCurrentLevel: number;
  pointsToNextLevel: number;
  totalBadgeCount: number;
  latestBadges: RewardBadge[];
}

export interface GoalCheckin {
  id: string;
  goalId: string;
  userId: string;
  logId: string;
  dateKey: string;
  dayNumber: number;
  createdAt?: string;
  updatedAt?: string;
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
  goalId?: string;
  goalLabel?: string;
  goalDayNumber?: number;
  isGoalCheckIn?: boolean;
  goalCheckins?: LogGoalCheckin[];
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  messageType: ChatMessageType;
  timestamp: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessageCreateInput {
  id?: string;
  role: ChatMessageRole;
  content: string;
  messageType?: ChatMessageType;
  timestamp?: number;
  metadata?: Record<string, unknown>;
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
  intent?: 'chat' | 'log' | 'plan' | 'finance';
  assistantReply?: string;
  plan?: PlanParseResult;
  finance?: FinanceRecord[];
}

export enum ViewMode {
  LOGGER = 'LOGGER',
  TIMELINE = 'TIMELINE',
  PLAN = 'PLAN',
  ANALYTICS = 'ANALYTICS',
  FINANCE = 'FINANCE'
}
