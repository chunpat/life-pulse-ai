
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Goal, LogEntry, RewardBadge, RewardLedgerEntry, RewardProfile } from '../types';
import { getDailyInsight } from '../services/qwenService';
import AchievementArea from './AchievementArea';

interface AnalyticsProps {
  logs: LogEntry[];
  goals: Goal[];
  rewardProfile?: RewardProfile | null;
  rewardBadges?: RewardBadge[];
  rewardLedger?: RewardLedgerEntry[];
  isGuest?: boolean;
  insight: string;
  isGenerating: boolean;
  onLoginClick?: () => void;
}

const COLORS = ['#f59e0b', '#10b981', '#f97316', '#ef4444', '#14b8a6', '#64748b'];

const formatDateKey = (value: number | string | Date) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Analytics: React.FC<AnalyticsProps> = ({ 
  logs, 
  goals,
  rewardProfile = null,
  rewardBadges = [],
  rewardLedger = [],
  isGuest = false,
  insight: defaultInsight,
  isGenerating: isDefaultGenerating,
  onLoginClick
}) => {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  const CATEGORY_MAP: Record<string, string> = useMemo(() => ({
    'Work': t('common.category.Work'),
    'Leisure': t('common.category.Leisure'),
    'Health': t('common.category.Health'),
    'Social': t('common.category.Social'),
    'Chores': t('common.category.Chores'),
    'Other': t('common.category.Other')
  }), [t]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customInsight, setCustomInsight] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Helper to determine date range
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    
    if (period === 'week') {
      const day = start.getDay() || 7; // Make Sunday 7
      start.setDate(start.getDate() - day + 1); // Monday
      end.setDate(start.getDate() + 6); // Sunday
    } else if (period === 'month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }
    
    // Reset hours for accurate comparison
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    
    return { start, end };
  }, [selectedDate, period]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= dateRange.start.getTime() && logTime <= dateRange.end.getTime();
    });
  }, [logs, dateRange]);

  const handleGenerateReport = async () => {
    if (isGuest || filteredLogs.length === 0) return;
    setIsAnalysing(true);
    try {
      const { getDailyInsight } = await import('../services/qwenService');
      const res = await getDailyInsight(filteredLogs, period, i18n.language);
      setCustomInsight(res);
    } catch (e) {
      console.error(e);
      setCustomInsight(t('analytics.ai_card.failed'));
    } finally {
      setIsAnalysing(false);
    }
  };

  // Reset custom insight when filters change
  useEffect(() => {
    setCustomInsight(null);
  }, [period, selectedDate]);

  const currentInsight = customInsight || (period === 'day' && selectedDate === new Date().toISOString().split('T')[0] ? defaultInsight : null);
  const isGenerating = isAnalysing || (period === 'day' && selectedDate === new Date().toISOString().split('T')[0] && isDefaultGenerating);

  const displayInsight = useMemo(() => {
    if (isGuest) return t('analytics.ai_card.guest_msg');
    
    if (isGenerating) return t('analytics.ai_card.generating');
    
    if (currentInsight) return currentInsight;

    if (filteredLogs.length === 0) return t('analytics.ai_card.no_data');
    
    return t('analytics.ai_card.generate_hint');
  }, [isGuest, filteredLogs.length, isGenerating, currentInsight, t]);

  const parsedContent = useMemo(() => {
    try {
      if (!currentInsight || typeof currentInsight !== 'string') return null;
      if (currentInsight.trim().startsWith('{')) {
        return JSON.parse(currentInsight);
      }
      return null;
    } catch {
      return null;
    }
  }, [currentInsight]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach(log => {
      const label = CATEGORY_MAP[log.category] || log.category;
      map[label] = (map[label] || 0) + log.durationMinutes;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredLogs]);

  const totalTime = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  }, [filteredLogs]);
  const activeGoals = useMemo(() => goals.filter(goal => goal.status === 'active'), [goals]);
  const latestGoal = useMemo(() => activeGoals[0] || goals[0] || null, [activeGoals, goals]);
  const todayGoalDone = latestGoal?.lastCheckInDate === formatDateKey(Date.now());
  const latestGoalProgress = latestGoal ? Math.min((latestGoal.completedDays / latestGoal.totalDays) * 100, 100) : 0;
  const goalStatusText = latestGoal ? t(`goals.status.${latestGoal.status}`) : '';
  const goalSummaryText = latestGoal
    ? latestGoal.status === 'active'
      ? (todayGoalDone ? t('goals.analytics_today_done') : t('goals.analytics_today_pending'))
      : latestGoal.status === 'completed'
        ? t('goals.completed_hint', { days: latestGoal.totalDays })
        : latestGoal.status === 'failed'
          ? t('goals.failed_hint')
          : t('goals.resume_hint')
    : t('goals.analytics_empty');

  const hours = Math.floor(totalTime / 60);
  const mins = totalTime % 60;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 pb-10">
      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm flex flex-col gap-2">
        {/* Period Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['day', 'week', 'month'] as const).map((p) => (
             <button
               key={p}
               onClick={() => setPeriod(p)}
               className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                 period === p ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               {t(`analytics.filter.${p}`)}
             </button>
          ))}
        </div>

        {/* Date Selector */}
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-xs font-bold text-slate-500">
             {t(`analytics.date_selector.${period}`)}
          </span>
          <input  
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-800 outline-none text-right"
          />
        </div>
      </div>

      {/* AI Card */}
      <div className="bg-[linear-gradient(135deg,#f59e0b_0%,#d97706_58%,#92400e_100%)] rounded-3xl p-6 text-white shadow-xl shadow-amber-200 relative overflow-hidden transition-all duration-300 hover:shadow-amber-300/50">
        <div className="relative z-10 w-full animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/15 rounded-lg backdrop-blur-sm">
                  <svg className="w-5 h-5 text-amber-100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-100">
                {t(`analytics.ai_card.title.${period}`)}
              </span>
            </div>
            
            {!currentInsight && !isGenerating && filteredLogs.length > 0 && !isGuest && (
                 <button 
                  onClick={handleGenerateReport}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold border border-white/30 transition-all flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {t('analytics.ai_card.generate')}
                </button>
            )}
          </div>

          {parsedContent ? (
             <div className="space-y-4">
               <div className="text-lg font-bold leading-relaxed border-l-4 border-amber-300 pl-3">
                   {parsedContent.summary}
                </div>
                <div className="space-y-2.5 mt-2">
                   {parsedContent.bulletPoints?.map((pt: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                         <span className="text-lg select-none">{pt.icon}</span>
                         <span className="text-sm font-medium opacity-90 leading-snug pt-0.5">{pt.text}</span>
                      </div>
                   ))}
                </div>
             </div>
          ) : (
            <p className="text-lg leading-relaxed font-medium">
              {displayInsight}
            </p>
          )}

          {isGuest && onLoginClick && (
            <button 
              onClick={onLoginClick}
              className="mt-6 w-full py-3 bg-white text-amber-700 hover:bg-amber-50 rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-900/10"
            >
              {t('analytics.ai_card.unlock')}
            </button>
          )}
        </div>
        
        {/* Background Decor */}
        <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-amber-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-orange-300/25 rounded-full blur-3xl"></div>
      </div>

      {!isGuest && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('goals.analytics_title')}</p>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {latestGoal ? latestGoal.title : t('goals.title')}
              </h3>
              {activeGoals.length > 1 && (
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {t('goals.active_count', { count: activeGoals.length })}
                </p>
              )}
            </div>
            {latestGoal && (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                {goalStatusText}
              </span>
            )}
          </div>

          {latestGoal ? (
            <>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <GoalStat label={t('goals.progress_label')} value={`${latestGoal.completedDays}/${latestGoal.totalDays}`} />
                <GoalStat label={t('goals.streak_label')} value={`${latestGoal.currentStreak}`} />
                <GoalStat label={t('goals.today_label')} value={todayGoalDone ? t('goals.today_short_done') : t('goals.today_short_pending')} />
              </div>

              <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${latestGoalProgress}%` }}></div>
              </div>

              {latestGoal.rewardTitle && (
                <p className="mt-4 text-sm font-medium text-amber-700 leading-relaxed">
                  {t('goals.reward_inline', { reward: latestGoal.rewardTitle })}
                </p>
              )}

              <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                {goalSummaryText}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500 leading-relaxed">
              {goalSummaryText}
            </p>
          )}
        </div>
      )}

      {!isGuest && rewardProfile && (
        <AchievementArea
          rewardProfile={rewardProfile}
          rewardBadges={rewardBadges}
          rewardLedger={rewardLedger}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard label={t('analytics.stat.duration')} value={`${Math.floor(totalTime / 60)}h ${totalTime % 60}m`} sub={t(`analytics.stat.${period}_stat`)} />
        <StatCard label={t('analytics.stat.count')} value={filteredLogs.length.toString()} sub={t('analytics.stat.total_records')} />
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">{t('analytics.chart.time_alloc')}</h3>
        {categoryData.length > 0 ? (
          <div className="flex flex-col">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} min`, t('history.form.duration')]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-xs font-medium text-slate-600">{entry.name}: {entry.value}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs italic">
            {t('analytics.chart.no_data')}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">{t('analytics.chart.energy')}</h3>
        <p className="text-xs text-slate-500 mb-4">{t('analytics.chart.energy_desc')}</p>
        <div className="h-40">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logs.slice().reverse()}>
                <XAxis dataKey="id" hide />
                <Tooltip 
                   labelFormatter={() => t('history.modal_detail')}
                   formatter={(value: any, name: any, props: any) => [`${t('history.form.importance')}: ${value}`, props.payload.mood]}
                />
                 <Bar dataKey="importance" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
           </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-800">{value}</p>
    <p className="text-[10px] text-slate-500 font-medium">{sub}</p>
  </div>
);

const GoalStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center border border-slate-100">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

export default Analytics;
