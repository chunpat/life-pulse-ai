import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Goal, GoalCreateInput, GoalType, OfficialPlanTemplate } from '../types';
import { fetchOfficialPlanTemplates } from '../services/officialPlanService';
import { buildSafeAreaPaddingStyle } from '../utils/safeArea';
import NoticeToast from './NoticeToast';
import ConfirmDialog from './ConfirmDialog';

const hexToRgba = (hex: string, alpha: number) => {
  const safeHex = hex.replace('#', '');
  const normalized = safeHex.length === 3
    ? safeHex.split('').map((char) => `${char}${char}`).join('')
    : safeHex;

  if (normalized.length !== 6) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const OFFICIAL_ACCENT_COLOR_MAP: Record<string, string> = {
  '#1d4ed8': '#f59e0b',
  '#7c3aed': '#d97706',
  '#059669': '#c2410c'
};

const normalizeOfficialAccentColor = (accentColor?: string | null) => {
  const normalized = typeof accentColor === 'string' ? accentColor.trim().toLowerCase() : '';
  return OFFICIAL_ACCENT_COLOR_MAP[normalized] || accentColor || '#f59e0b';
};

const getGoalAccentColor = (goal: Goal) => {
  const accentColor = typeof goal.metadata?.accentColor === 'string' && goal.metadata.accentColor
    ? goal.metadata.accentColor
    : '#f59e0b';

  return goal.planScope === 'official'
    ? normalizeOfficialAccentColor(accentColor)
    : accentColor;
};

const getGoalShortBadge = (goal: Goal, fallback: string) => typeof goal.metadata?.officialPlanBadgeShortTitle === 'string' && goal.metadata.officialPlanBadgeShortTitle
  ? goal.metadata.officialPlanBadgeShortTitle
  : fallback;

const getGoalMetaNumber = (goal: Goal, key: string) => {
  const value = goal.metadata?.[key];
  return typeof value === 'number' ? value : Number(value || 0);
};

const getGoalRestartLimit = (goal: Goal) => Math.max(1, getGoalMetaNumber(goal, 'restartLimit') || Math.floor(goal.totalDays / 7));

const getGoalRestartCount = (goal: Goal) => Math.max(0, getGoalMetaNumber(goal, 'restartCount'));

const getGoalRemainingRestarts = (goal: Goal) => Math.max(getGoalRestartLimit(goal) - getGoalRestartCount(goal), 0);

const getGoalSurfaceTone = (goal: Goal) => {
  if (goal.status === 'completed') {
    return {
      badge: 'bg-emerald-100 text-emerald-700',
      shell: 'border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)]'
    };
  }

  if (goal.status === 'failed') {
    return {
      badge: 'bg-rose-100 text-rose-700',
      shell: 'border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)]'
    };
  }

  if (goal.status === 'paused') {
    return {
      badge: 'bg-amber-100 text-amber-700',
      shell: 'border-amber-100 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_100%)]'
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-700',
    shell: 'border-slate-100 bg-white'
  };
};

interface GoalPlannerProps {
  goals: Goal[];
  logsCount: number;
  isGoalActionLoading?: boolean;
  onCreateGoal: (goalInput: GoalCreateInput) => Promise<void>;
  onPauseGoal: (goalId: string) => Promise<void>;
  onResumeGoal: (goalId: string) => Promise<void>;
  onSetPrimaryGoal: (goalId: string) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

const GoalPlanner: React.FC<GoalPlannerProps> = ({
  goals,
  logsCount,
  isGoalActionLoading = false,
  onCreateGoal,
  onPauseGoal,
  onResumeGoal,
  onSetPrimaryGoal,
  onDeleteGoal
}) => {
  const { t } = useTranslation();
  const [showComposer, setShowComposer] = useState(false);
  const [showAddSection, setShowAddSection] = useState(goals.length === 0);
  const [createMode, setCreateMode] = useState<'personal' | 'official'>('personal');
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType>('7_DAY');
  const [titleInput, setTitleInput] = useState('');
  const [rewardInput, setRewardInput] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [goalPendingDelete, setGoalPendingDelete] = useState<Goal | null>(null);
  const activeGoals = useMemo(() => goals.filter(goal => goal.status === 'active'), [goals]);
  const hasActiveOfficialGoal = useMemo(() => activeGoals.some(goal => goal.planScope === 'official'), [activeGoals]);
  const latestGoal = goals[0] || null;
  const hasStarterPrompt = logsCount >= 3;
  const todayKey = formatDateKey(Date.now());
  const goalRecords = useMemo(() => goals.filter(goal => goal.status !== 'active').slice(0, 8), [goals]);
  const [officialPlans, setOfficialPlans] = useState<OfficialPlanTemplate[]>([]);
  const [isOfficialPlansLoading, setIsOfficialPlansLoading] = useState(false);
  const titlePresets = useMemo(() => ({
    '7_DAY': [
      t('goals.title_presets.7_day.focus_reset'),
      t('goals.title_presets.7_day.workout_restart'),
      t('goals.title_presets.7_day.daily_capture'),
      t('goals.title_presets.7_day.reading_restart')
    ],
    '21_DAY': [
      t('goals.title_presets.21_day.early_sleep'),
      t('goals.title_presets.21_day.daily_review'),
      t('goals.title_presets.21_day.exercise_habit'),
      t('goals.title_presets.21_day.writing_habit')
    ]
  }), [t]);
  const rewardPresets = useMemo(() => [
    t('goals.reward_presets.coffee'),
    t('goals.reward_presets.movie'),
    t('goals.reward_presets.rest_half_day'),
    t('goals.reward_presets.small_gift')
  ], [t]);

  const getGoalLabel = (goalType: GoalType) => goalType === '21_DAY'
    ? t('goals.type_21_day')
    : t('goals.type_7_day');
  const summaryItems = useMemo(() => ([
    { key: 'active', label: t('goals.ongoing_title'), value: activeGoals.length, shell: 'bg-white/85 border-white/80 text-slate-950' },
    { key: 'records', label: t('goals.records_title'), value: goalRecords.length, shell: 'bg-white/75 border-white/70 text-slate-950' },
    { key: 'total', label: t('goals.compose_label'), value: goals.length, shell: 'bg-slate-900 border-slate-900 text-white' }
  ]), [activeGoals.length, goalRecords.length, goals.length, t]);

  useEffect(() => {
    if (goals.length === 0) {
      setShowAddSection(true);
    }
  }, [goals.length]);

  useEffect(() => {
    let isMounted = true;

    const loadOfficialPlans = async () => {
      setIsOfficialPlansLoading(true);
      try {
        const templates = await fetchOfficialPlanTemplates();
        if (isMounted) {
          setOfficialPlans(templates);
        }
      } catch (error) {
        console.error('Official plan fetch error:', error);
      } finally {
        if (isMounted) {
          setIsOfficialPlansLoading(false);
        }
      }
    };

    loadOfficialPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const openComposer = (goalType: GoalType) => {
    setSelectedGoalType(goalType);
    setTitleInput('');
    setRewardInput('');
    setShowComposer(true);
  };

  const closeComposer = () => {
    if (isGoalActionLoading) return;
    setShowComposer(false);
  };

  const handleSubmitGoal = async () => {
    try {
      await onCreateGoal({
        goalType: selectedGoalType,
        title: titleInput,
        rewardTitle: rewardInput
      });
      setShowComposer(false);
      setShowAddSection(false);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    }
  };

  const handleDelete = async (goal: Goal) => {
    try {
      await onDeleteGoal(goal.id);
      setNotice({ message: t('goals.delete_success'), tone: 'success' });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    } finally {
      setGoalPendingDelete(null);
    }
  };

  const handlePause = async (goalId: string) => {
    try {
      await onPauseGoal(goalId);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    }
  };

  const handleResume = async (goalId: string) => {
    try {
      await onResumeGoal(goalId);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    }
  };

  const handleSetPrimary = async (goalId: string) => {
    try {
      await onSetPrimaryGoal(goalId);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    }
  };

  const handleCreateOfficialPlan = async (officialPlan: OfficialPlanTemplate) => {
    try {
      await onCreateGoal({
        goalType: officialPlan.goalType,
        officialPlanTemplateId: officialPlan.id
      });
      setShowAddSection(false);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('goals.operation_failed'), tone: 'error' });
    }
  };

  return (
    <>
      <NoticeToast
        open={Boolean(notice)}
        message={notice?.message || ''}
        tone={notice?.tone || 'info'}
        onClose={() => setNotice(null)}
      />
      <ConfirmDialog
        open={Boolean(goalPendingDelete)}
        title={t('goals.records_title')}
        message={goalPendingDelete ? t('goals.delete_confirm', { title: goalPendingDelete.title }) : ''}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onCancel={() => setGoalPendingDelete(null)}
        onConfirm={() => {
          if (goalPendingDelete) {
            void handleDelete(goalPendingDelete);
          }
        }}
      />
      {activeGoals.length > 0 && (
        <div className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,#fff8e8_0%,#fff2d2_42%,#ffffff_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
                {t('goals.ongoing_title')}
              </p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {t('goals.active_count', { count: activeGoals.length })}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t('goals.parallel_desc')}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
              {summaryItems.map((item) => (
                <div key={item.key} className={`rounded-[1.4rem] border p-4 shadow-sm ${item.shell}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{item.label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {activeGoals.map(goal => (
              <ActiveGoalCard
                key={goal.id}
                goal={goal}
                todayKey={todayKey}
                getGoalLabel={getGoalLabel}
                canSetPrimary={!hasActiveOfficialGoal || goal.planScope === 'official'}
                onPause={() => handlePause(goal.id)}
                onSetPrimary={() => handleSetPrimary(goal.id)}
                onDelete={() => setGoalPendingDelete(goal)}
                isGoalActionLoading={isGoalActionLoading}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAddSection(prev => !prev)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">
              {t('goals.compose_label')}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              {goals.length > 0 ? t('goals.add_more_title') : t('goals.start_title')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {goals.length > 0
                ? t('goals.add_more_desc')
                : (hasStarterPrompt ? t('goals.start_prompt') : t('goals.start_desc'))}
            </p>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-[11px] font-black text-slate-600 whitespace-nowrap">
            {showAddSection ? t('goals.compose_expanded') : t('goals.compose_collapsed')}
            <svg className={`w-4 h-4 transition-transform ${showAddSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </span>
        </button>

        {latestGoal && activeGoals.length === 0 && (
          <div className="mt-4 rounded-[1.5rem] border border-slate-100 bg-[linear-gradient(180deg,#fafaf9_0%,#fffaf0_100%)] px-4 py-4 text-sm text-slate-600">
            {latestGoal.status === 'completed'
              ? t('goals.completed_hint', { days: latestGoal.totalDays })
              : latestGoal.status === 'failed'
                ? t('goals.failed_restart_hint')
                : latestGoal.status === 'paused'
                  ? t('goals.paused_hint')
                  : t('goals.resume_hint')}
          </div>
        )}

        {showAddSection && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="rounded-2xl bg-slate-100 p-1 flex gap-1">
              <button
                type="button"
                onClick={() => setCreateMode('personal')}
                className={`flex-1 rounded-[1rem] px-3 py-2 text-sm font-black transition-colors ${createMode === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('goals.personal_tab')}
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('official')}
                className={`flex-1 rounded-[1rem] px-3 py-2 text-sm font-black transition-colors ${createMode === 'official' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('goals.official_tab')}
              </button>
            </div>

            {createMode === 'personal' ? (
              <>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => openComposer('7_DAY')}
                    disabled={isGoalActionLoading}
                    className="rounded-[1.5rem] bg-slate-900 text-white px-4 py-5 text-left hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="block text-sm font-black">{t('goals.type_7_day')}</span>
                    <span className="mt-1 block text-xs text-slate-300">{t('goals.type_7_day_desc')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComposer('21_DAY')}
                    disabled={isGoalActionLoading}
                    className="rounded-[1.5rem] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] border border-slate-200 text-slate-900 px-4 py-5 text-left hover:border-amber-200 hover:bg-amber-50/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="block text-sm font-black">{t('goals.type_21_day')}</span>
                    <span className="mt-1 block text-xs text-slate-500">{t('goals.type_21_day_desc')}</span>
                  </button>
                </div>

                <div className="mt-4 space-y-2 rounded-[1.5rem] bg-[linear-gradient(180deg,#fafaf9_0%,#fffaf0_100%)] border border-slate-100 px-4 py-4">
                  <p className="text-sm font-black text-slate-700 leading-relaxed">{t('goals.multi_active_hint')}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('goals.delete_policy_hint')}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('goals.primary_hint')}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('goals.pause_detail')}</p>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,#fafaf9_0%,#fffaf0_100%)] border border-slate-100 px-4 py-4">
                  <p className="text-sm font-black text-slate-700 leading-relaxed">{t('goals.official_desc')}</p>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{t('goals.official_primary_hint')}</p>
                </div>

                {isOfficialPlansLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {t('goals.official_loading')}
                  </div>
                ) : officialPlans.length > 0 ? officialPlans.map(plan => (
                  <OfficialPlanCard
                    key={plan.id}
                    plan={plan}
                    isCreating={isGoalActionLoading}
                    onCreate={() => handleCreateOfficialPlan(plan)}
                    t={t}
                  />
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {t('goals.official_empty')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {goalRecords.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('goals.records_title')}</p>
              <h3 className="mt-2 text-lg font-black text-slate-900 tracking-tight">{t('goals.records_title')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('goals.records_desc')}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-[11px] font-black text-slate-500">
              {goalRecords.length}
            </span>
          </div>

          <div className="space-y-3">
            {goalRecords.map(goal => {
              const rewardText = goal.rewardTitle || t('goals.no_reward');
              const statusTone = getStatusTone(goal.status);
              const remainingRestarts = getGoalRemainingRestarts(goal);
              const isInterrupted = goal.status === 'failed';
              const surfaceTone = getGoalSurfaceTone(goal);

              return (
                <div
                  key={goal.id}
                  className={`rounded-[1.75rem] border p-4 shadow-sm ${surfaceTone.shell}`}
                  style={goal.planScope === 'official'
                    ? {
                        borderColor: hexToRgba(getGoalAccentColor(goal), 0.22),
                        background: `linear-gradient(135deg, ${hexToRgba(getGoalAccentColor(goal), 0.14)} 0%, rgba(248,250,252,0.96) 55%, rgba(255,255,255,0.98) 100%)`
                      }
                    : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 truncate">{goal.title}</h4>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${statusTone}`}>
                          {t(`goals.status.${goal.status}`)}
                        </span>
                        {goal.planScope === 'official' && (
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-black text-white"
                            style={{ backgroundColor: getGoalAccentColor(goal) }}
                          >
                            {t('goals.official_plan_badge')}
                          </span>
                        )}
                        {!isInterrupted && (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${isGoalStarted(goal) ? 'bg-slate-200 text-slate-700' : 'bg-sky-100 text-sky-700'}`}>
                            {isGoalStarted(goal) ? t('goals.started_badge') : t('goals.not_started_badge')}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {getGoalLabel(goal.goalType)} · {t(isInterrupted ? 'goals.interrupted_progress_inline' : 'goals.progress_inline', { current: goal.completedDays, total: goal.totalDays })}
                      </p>
                      {isInterrupted ? (
                        <>
                          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            {t('goals.failed_restart_hint')}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${remainingRestarts > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                              {remainingRestarts > 0
                                ? t('goals.restart_remaining_badge', { count: remainingRestarts })
                                : t('goals.restart_exhausted_badge')}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-xs text-slate-500">
                            {goal.lastCheckInDate
                              ? t('goals.last_checkin', { date: goal.lastCheckInDate })
                              : t('goals.not_started_record')}
                          </p>
                          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            {goal.status === 'paused'
                              ? t('goals.resume_detail')
                              : goal.status === 'completed'
                                ? t('goals.completed_hint', { days: goal.totalDays })
                                : t('goals.resume_hint')}
                          </p>
                          <p className="mt-2 text-xs text-amber-700 font-medium">
                            {t('goals.reward_inline', { reward: rewardText })}
                          </p>
                        </>
                      )}
                      {!isInterrupted && goal.completionBadgeCode && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                            {t('goals.completion_badge')}
                          </span>
                          {goal.planScope === 'official' ? (
                            <span
                              className="px-2.5 py-1 rounded-full text-[10px] font-black"
                              style={{
                                backgroundColor: hexToRgba(getGoalAccentColor(goal), 0.14),
                                color: getGoalAccentColor(goal)
                              }}
                            >
                              {getGoalShortBadge(goal, goal.completionBadgeTitle || t(`rewards.badges.${goal.completionBadgeCode}.short`, { defaultValue: goal.completionBadgeCode }))}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                              {goal.completionBadgeTitle || t(`rewards.badges.${goal.completionBadgeCode}.short`, { defaultValue: goal.completionBadgeCode })}
                            </span>
                          )}
                          {goal.completionPointsAwarded > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">
                              {t('goals.completion_points', { points: goal.completionPointsAwarded })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {goal.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleResume(goal.id)}
                          disabled={isGoalActionLoading}
                            className="px-3 py-2 rounded-xl bg-white text-xs font-black text-slate-600 border border-slate-200 hover:border-amber-200 hover:text-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {t('goals.resume')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setGoalPendingDelete(goal)}
                        disabled={isGoalActionLoading}
                        className="px-3 py-2 rounded-xl bg-white text-xs font-black text-slate-600 border border-slate-200 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {t('goals.delete')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((goal.completedDays / goal.totalDays) * 100, 100)}%`,
                        backgroundColor: goal.planScope === 'official' ? getGoalAccentColor(goal) : '#f59e0b'
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showComposer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center" style={buildSafeAreaPaddingStyle({ top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' })}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeComposer} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d6_45%,#ffffff_100%)] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">{t('goals.compose_label')}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{t('goals.compose_title')}</h3>
              </div>
              <button type="button" onClick={closeComposer} className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('goals.type_label')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['7_DAY', '21_DAY'] as GoalType[]).map(goalType => (
                    <button
                      key={goalType}
                      type="button"
                      onClick={() => setSelectedGoalType(goalType)}
                      className={`rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${selectedGoalType === goalType ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] text-slate-700 hover:border-amber-200'}`}
                    >
                      <span className="block text-sm font-black">{getGoalLabel(goalType)}</span>
                      <span className={`mt-1 block text-xs ${selectedGoalType === goalType ? 'text-slate-300' : 'text-slate-500'}`}>
                        {goalType === '21_DAY' ? t('goals.type_21_day_desc') : t('goals.type_7_day_desc')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t('goals.name_label')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {titlePresets[selectedGoalType].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTitleInput(preset)}
                      className={`px-3 py-2 rounded-full text-xs font-black border transition-colors ${titleInput === preset ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  placeholder={t('goals.name_placeholder')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t('goals.reward_label')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {rewardPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRewardInput(preset)}
                      className={`px-3 py-2 rounded-full text-xs font-black border transition-colors ${rewardInput === preset ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={rewardInput}
                  onChange={(event) => setRewardInput(event.target.value)}
                  placeholder={t('goals.reward_placeholder')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300"
                />
                <p className="mt-2 text-xs text-slate-400">{t('goals.reward_hint')}</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeComposer}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('history.btn.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmitGoal}
                disabled={isGoalActionLoading}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('goals.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const GoalMetric: React.FC<{ label: string; value: string; dark?: boolean }> = ({ label, value, dark = false }) => (
  <div className={`rounded-2xl px-3 py-3 ${dark ? 'bg-white/70 border border-white/80' : 'bg-slate-50 border border-slate-100'}`}>
    <p className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
    <p className={`mt-1 text-lg font-black ${dark ? 'text-slate-900' : 'text-slate-900'}`}>{value}</p>
  </div>
);

const ActiveGoalCard: React.FC<{
  goal: Goal;
  todayKey: string;
  getGoalLabel: (goalType: GoalType) => string;
  canSetPrimary: boolean;
  onPause: () => void;
  onSetPrimary: () => void;
  onDelete: () => void;
  isGoalActionLoading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ goal, todayKey, getGoalLabel, canSetPrimary, onPause, onSetPrimary, onDelete, isGoalActionLoading, t }) => {
  const isTodayCompleted = goal.lastCheckInDate === todayKey;
  const progress = Math.min((goal.completedDays / goal.totalDays) * 100, 100);
  const remainingDays = Math.max(goal.totalDays - goal.completedDays, 0);
  const isPrimary = goal.rewardRole === 'primary';
  const accentColor = goal.planScope === 'official' ? getGoalAccentColor(goal) : '#f59e0b';

  return (
    <div
      className="rounded-[1.75rem] border p-4 shadow-sm"
      style={{
        borderColor: hexToRgba(accentColor, 0.24),
        background: `linear-gradient(135deg, ${hexToRgba(accentColor, goal.planScope === 'official' ? 0.28 : 0.18)} 0%, rgba(255,250,240,0.96) 50%, rgba(255,255,255,0.98) 100%)`
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0 max-w-2xl">
          <h4 className="text-lg font-black tracking-tight text-slate-950 truncate">{goal.title}</h4>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            {isTodayCompleted ? t('goals.today_done') : t('goals.today_pending')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isPrimary && canSetPrimary && (
            <button
              type="button"
              onClick={onSetPrimary}
              disabled={isGoalActionLoading}
              className="px-3 py-2 rounded-xl bg-white/80 text-xs font-black text-amber-700 ring-1 ring-amber-200 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t('goals.set_primary')}
            </button>
          )}
          <button
            type="button"
            onClick={onPause}
            disabled={isGoalActionLoading}
            className="px-3 py-2 rounded-xl bg-white/80 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('goals.pause')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isGoalActionLoading}
            className="px-3 py-2 rounded-xl bg-white/80 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:text-red-500 hover:ring-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('goals.delete')}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="px-3 py-1.5 rounded-full bg-white/80 text-[11px] font-black text-slate-700 ring-1 ring-white">
          {getGoalLabel(goal.goalType)}
        </span>
        {goal.planScope === 'official' && (
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-black border"
            style={{
              backgroundColor: hexToRgba(accentColor, 0.14),
              color: accentColor,
              borderColor: hexToRgba(accentColor, 0.28)
            }}
          >
            {t('goals.official_plan_badge')}
          </span>
        )}
        {isPrimary && (
          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-[11px] font-black text-amber-700">
            {t('goals.primary_badge')}
          </span>
        )}
        {goal.rewardTitle && (
          <span className="px-3 py-1.5 rounded-full bg-white/80 text-[11px] font-black text-slate-700 ring-1 ring-white">
            {t('goals.reward_badge', { reward: goal.rewardTitle })}
          </span>
        )}
      </div>

      <div className="mt-5 h-2 rounded-full bg-white/80 overflow-hidden ring-1 ring-white/70">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: accentColor }}
        ></div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <GoalMetric label={t('goals.progress_label')} value={`${goal.completedDays}/${goal.totalDays}`} dark />
        <GoalMetric label={t('goals.streak_label')} value={`${goal.currentStreak}`} dark />
        <GoalMetric label={t('goals.remaining_label')} value={`${remainingDays}`} dark />
      </div>
    </div>
  );
};

const getStatusTone = (status: Goal['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'paused':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
};

const isGoalStarted = (goal: Goal) => goal.completedDays > 0 || Boolean(goal.lastCheckInDate);

const formatDateKey = (value: number | string | Date): string => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const OfficialPlanCard: React.FC<{
  plan: OfficialPlanTemplate;
  isCreating: boolean;
  onCreate: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ plan, isCreating, onCreate, t }) => {
  const accentColor = normalizeOfficialAccentColor(plan.accentColor || '#f59e0b');

  return (
  <div
    className="rounded-[1.75rem] border p-5 shadow-sm"
    style={{
      borderColor: hexToRgba(accentColor, 0.2),
      background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.2)} 0%, rgba(255,250,240,0.96) 58%, rgba(255,255,255,0.98) 100%)`
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-black text-white"
            style={{ backgroundColor: accentColor }}
          >
            {t('goals.official_plan_badge')}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
            {t('goals.official_points', { points: plan.completionPoints })}
          </span>
        </div>
        <h4 className="mt-3 text-base font-black text-slate-900 tracking-tight">{plan.title}</h4>
        {plan.subtitle && (
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{plan.subtitle}</p>
        )}
        {plan.description && (
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">{plan.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="shrink-0 rounded-2xl px-4 py-3 text-sm font-black text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: accentColor }}
      >
        {t('goals.join_official_plan')}
      </button>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="px-3 py-1.5 rounded-full bg-white text-[11px] font-black text-slate-600 border border-slate-200">
        {plan.goalType === '21_DAY' ? t('goals.type_21_day') : t('goals.type_7_day')}
      </span>
      <span className="px-3 py-1.5 rounded-full bg-white text-[11px] font-black text-slate-600 border border-slate-200">
        {t('goals.official_badge_preview', { badge: plan.badgeShortTitle })}
      </span>
    </div>
  </div>
  );
};

export default GoalPlanner;