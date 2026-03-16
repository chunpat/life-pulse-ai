import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Goal, GoalCreateInput, GoalType } from '../types';

interface GoalPlannerProps {
  goals: Goal[];
  logsCount: number;
  isGoalActionLoading?: boolean;
  onCreateGoal: (goalInput: GoalCreateInput) => Promise<void>;
  onPauseGoal: (goalId: string) => Promise<void>;
  onResumeGoal: (goalId: string) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

const GoalPlanner: React.FC<GoalPlannerProps> = ({
  goals,
  logsCount,
  isGoalActionLoading = false,
  onCreateGoal,
  onPauseGoal,
  onResumeGoal,
  onDeleteGoal
}) => {
  const { t } = useTranslation();
  const [showComposer, setShowComposer] = useState(false);
  const [showAddSection, setShowAddSection] = useState(goals.length === 0);
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType>('7_DAY');
  const [titleInput, setTitleInput] = useState('');
  const [rewardInput, setRewardInput] = useState('');
  const activeGoals = useMemo(() => goals.filter(goal => goal.status === 'active'), [goals]);
  const latestGoal = goals[0] || null;
  const hasStarterPrompt = logsCount >= 3;
  const todayKey = formatDateKey(Date.now());
  const goalRecords = useMemo(() => goals.filter(goal => goal.status !== 'active').slice(0, 8), [goals]);
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

  useEffect(() => {
    if (goals.length === 0) {
      setShowAddSection(true);
    }
  }, [goals.length]);

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
      window.alert(error instanceof Error ? error.message : t('goals.operation_failed'));
    }
  };

  const handleDelete = async (goal: Goal) => {
    const confirmed = window.confirm(t('goals.delete_confirm', { title: goal.title }));
    if (!confirmed) return;
    try {
      await onDeleteGoal(goal.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('goals.operation_failed'));
    }
  };

  const handlePause = async (goalId: string) => {
    try {
      await onPauseGoal(goalId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('goals.operation_failed'));
    }
  };

  const handleResume = async (goalId: string) => {
    try {
      await onResumeGoal(goalId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('goals.operation_failed'));
    }
  };

  return (
    <>
      {activeGoals.length > 0 && (
        <div className="rounded-[2rem] p-5 shadow-sm border border-slate-900 bg-slate-900 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200">
                {t('goals.ongoing_title')}
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight">
                {t('goals.active_count', { count: activeGoals.length })}
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {t('goals.parallel_desc')}
              </p>
            </div>

            <span className="px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold text-slate-100 whitespace-nowrap">
              {activeGoals.length}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {activeGoals.map(goal => (
              <ActiveGoalCard
                key={goal.id}
                goal={goal}
                todayKey={todayKey}
                getGoalLabel={getGoalLabel}
                onPause={() => handlePause(goal.id)}
                onDelete={() => handleDelete(goal)}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-500">
              {t('goals.compose_label')}
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {goals.length > 0 ? t('goals.add_more_title') : t('goals.start_title')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {goals.length > 0
                ? t('goals.add_more_desc')
                : (hasStarterPrompt ? t('goals.start_prompt') : t('goals.start_desc'))}
            </p>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 whitespace-nowrap">
            {showAddSection ? t('goals.compose_expanded') : t('goals.compose_collapsed')}
            <svg className={`w-4 h-4 transition-transform ${showAddSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </span>
        </button>

        {latestGoal && activeGoals.length === 0 && (
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
            {latestGoal.status === 'completed'
              ? t('goals.completed_hint', { days: latestGoal.totalDays })
              : latestGoal.status === 'failed'
                ? t('goals.failed_hint')
                : latestGoal.status === 'paused'
                  ? t('goals.paused_hint')
                  : t('goals.resume_hint')}
          </div>
        )}

        {showAddSection && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openComposer('7_DAY')}
                disabled={isGoalActionLoading}
                className="rounded-2xl bg-slate-900 text-white px-4 py-4 text-left hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="block text-sm font-black">{t('goals.type_7_day')}</span>
                <span className="mt-1 block text-xs text-slate-300">{t('goals.type_7_day_desc')}</span>
              </button>
              <button
                type="button"
                onClick={() => openComposer('21_DAY')}
                disabled={isGoalActionLoading}
                className="rounded-2xl bg-white border border-slate-200 text-slate-900 px-4 py-4 text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="block text-sm font-black">{t('goals.type_21_day')}</span>
                <span className="mt-1 block text-xs text-slate-500">{t('goals.type_21_day_desc')}</span>
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">{t('goals.multi_active_hint')}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{t('goals.delete_policy_hint')}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{t('goals.pause_detail')}</p>
            </div>
          </div>
        )}
      </div>

      {goalRecords.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('goals.records_title')}</h3>
              <p className="text-sm text-slate-500 mt-1">{t('goals.records_desc')}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
              {goalRecords.length}
            </span>
          </div>

          <div className="space-y-3">
            {goalRecords.map(goal => {
              const progressText = `${goal.completedDays}/${goal.totalDays}`;
              const rewardText = goal.rewardTitle || t('goals.no_reward');
              const statusTone = getStatusTone(goal.status);

              return (
                <div key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 truncate">{goal.title}</h4>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusTone}`}>
                          {t(`goals.status.${goal.status}`)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isGoalStarted(goal) ? 'bg-slate-200 text-slate-700' : 'bg-sky-100 text-sky-700'}`}>
                          {isGoalStarted(goal) ? t('goals.started_badge') : t('goals.not_started_badge')}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {getGoalLabel(goal.goalType)} · {t('goals.progress_inline', { current: goal.completedDays, total: goal.totalDays })}
                      </p>
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
                            : goal.status === 'failed'
                              ? t('goals.failed_hint')
                              : t('goals.resume_hint')}
                      </p>
                      <p className="mt-2 text-xs text-amber-700 font-medium">
                        {t('goals.reward_inline', { reward: rewardText })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {goal.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => handleResume(goal.id)}
                          disabled={isGoalActionLoading}
                          className="px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-600 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {t('goals.resume')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(goal)}
                        disabled={isGoalActionLoading}
                        className="px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-600 border border-slate-200 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {t('goals.delete')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min((goal.completedDays / goal.totalDays) * 100, 100)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showComposer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeComposer} />
          <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-white shadow-2xl border border-slate-100 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-500">{t('goals.compose_label')}</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">{t('goals.compose_title')}</h3>
              </div>
              <button type="button" onClick={closeComposer} className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t('goals.type_label')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['7_DAY', '21_DAY'] as GoalType[]).map(goalType => (
                    <button
                      key={goalType}
                      type="button"
                      onClick={() => setSelectedGoalType(goalType)}
                      className={`rounded-2xl border px-4 py-4 text-left transition-colors ${selectedGoalType === goalType ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200'}`}
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">{t('goals.name_label')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {titlePresets[selectedGoalType].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTitleInput(preset)}
                      className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${titleInput === preset ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-2">{t('goals.reward_label')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {rewardPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRewardInput(preset)}
                      className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${rewardInput === preset ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                />
                <p className="mt-2 text-xs text-slate-400">{t('goals.reward_hint')}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeComposer}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('history.btn.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmitGoal}
                disabled={isGoalActionLoading}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
  <div className={`rounded-2xl px-3 py-3 ${dark ? 'bg-white/5' : 'bg-slate-50 border border-slate-100'}`}>
    <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
    <p className={`mt-1 text-lg font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
  </div>
);

const ActiveGoalCard: React.FC<{
  goal: Goal;
  todayKey: string;
  getGoalLabel: (goalType: GoalType) => string;
  onPause: () => void;
  onDelete: () => void;
  isGoalActionLoading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ goal, todayKey, getGoalLabel, onPause, onDelete, isGoalActionLoading, t }) => {
  const isTodayCompleted = goal.lastCheckInDate === todayKey;
  const progress = Math.min((goal.completedDays / goal.totalDays) * 100, 100);
  const remainingDays = Math.max(goal.totalDays - goal.completedDays, 0);

  return (
    <div className="rounded-[1.5rem] bg-white/8 border border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-lg font-black tracking-tight text-white truncate">{goal.title}</h4>
          <p className="mt-1 text-sm text-slate-300 leading-relaxed">
            {isTodayCompleted ? t('goals.today_done') : t('goals.today_pending')}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onPause}
            disabled={isGoalActionLoading}
            className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('goals.pause')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isGoalActionLoading}
            className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-red-500/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('goals.delete')}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-bold text-slate-100">
          {getGoalLabel(goal.goalType)}
        </span>
        {goal.rewardTitle && (
          <span className="px-3 py-1.5 rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-200">
            {t('goals.reward_badge', { reward: goal.rewardTitle })}
          </span>
        )}
      </div>

      <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-300 transition-all duration-500" style={{ width: `${progress}%` }}></div>
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
      return 'bg-indigo-100 text-indigo-700';
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

export default GoalPlanner;