import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../types';
import NoticeToast from './NoticeToast';

type PlanViewMode = 'board' | 'schedule';
type PlanFilter = 'all' | 'pending' | 'overdue' | 'completed' | 'cancelled';

interface PlanCenterProps {
  plans: Plan[];
  isGuest?: boolean;
  onCompletePlan: (planId: string) => Promise<void>;
  onCancelPlan: (planId: string) => Promise<void>;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const BOARD_THEMES = [
  {
    shell: 'border-[#edd7ac] bg-[linear-gradient(135deg,#fff8ea_0%,#fff3d6_55%,#f7e2bb_100%)] text-stone-900 shadow-lg shadow-amber-100/50',
    subtle: 'text-stone-600/80',
    badge: 'bg-white/72 text-stone-700 ring-1 ring-[#efdfbf]',
    actionPrimary: 'bg-[#efd3a1] text-stone-900 hover:bg-[#f6e3bf]',
    actionSecondary: 'bg-white/78 text-stone-700 ring-1 ring-[#efdfbf] hover:bg-white',
    arrow: 'bg-white text-stone-800'
  },
  {
    shell: 'border-[#edd7ac] bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d6_60%,#f5ddb4_100%)] text-stone-900 shadow-lg shadow-amber-100/50',
    subtle: 'text-stone-700/80',
    badge: 'bg-white/72 text-stone-700 ring-1 ring-[#efdfbf]',
    actionPrimary: 'bg-[#efd3a1] text-stone-900 hover:bg-[#f6e3bf]',
    actionSecondary: 'bg-white/78 text-stone-700 ring-1 ring-[#efdfbf] hover:bg-white',
    arrow: 'bg-white text-stone-800'
  },
  {
    shell: 'border-[#edd7ac] bg-[linear-gradient(135deg,#fff9ec_0%,#fff3d6_62%,#f4ddb7_100%)] text-stone-900 shadow-lg shadow-amber-100/50',
    subtle: 'text-stone-700/78',
    badge: 'bg-white/72 text-stone-700 ring-1 ring-[#efdfbf]',
    actionPrimary: 'bg-[#efd3a1] text-stone-900 hover:bg-[#f6e3bf]',
    actionSecondary: 'bg-white/72 text-stone-700 ring-1 ring-[#efdfbf] hover:bg-white',
    arrow: 'bg-white text-stone-800'
  },
  {
    shell: 'border-[#edd7ac] bg-[linear-gradient(135deg,#fff9ee_0%,#fff3d6_64%,#f4e2c3_100%)] text-stone-900 shadow-lg shadow-amber-100/45',
    subtle: 'text-stone-600',
    badge: 'bg-white text-stone-600 ring-1 ring-[#efdfbf]',
    actionPrimary: 'bg-[#efd3a1] text-stone-900 hover:bg-[#f6e3bf]',
    actionSecondary: 'bg-white text-stone-700 ring-1 ring-[#efdfbf] hover:bg-stone-50',
    arrow: 'bg-white text-stone-700'
  }
] as const;

const getDateKey = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPlanPrimaryTimestamp = (plan: Plan) => {
  return plan.planType === 'reminder'
    ? (plan.dueAt || plan.reminderAt || plan.startAt || 0)
    : (plan.startAt || plan.dueAt || plan.reminderAt || 0);
};

const getPlanBucket = (plan: Plan, now = Date.now()): Exclude<PlanFilter, 'all'> => {
  if (plan.status === 'completed') return 'completed';
  if (plan.status === 'cancelled') return 'cancelled';

  const timestamp = getPlanPrimaryTimestamp(plan);
  if (timestamp > 0 && timestamp < now) {
    return 'overdue';
  }

  return 'pending';
};

const getBucketWeight = (bucket: Exclude<PlanFilter, 'all'>) => {
  if (bucket === 'overdue') return 0;
  if (bucket === 'pending') return 1;
  if (bucket === 'completed') return 2;
  return 3;
};

const getWeekDays = (anchor: Date) => {
  const base = new Date(anchor);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + mondayOffset);
  base.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    return current;
  });
};

const getTimelineInterval = (plan: Plan) => {
  if (plan.isAllDay) {
    return null;
  }

  if (plan.planType === 'event') {
    const start = plan.startAt || plan.reminderAt || plan.dueAt;
    const end = plan.endAt || (start ? start + HOUR : null);
    if (!start || !end) return null;
    return { start, end };
  }

  const start = plan.reminderAt || plan.dueAt || plan.startAt;
  if (!start) return null;
  return { start, end: start + 45 * MINUTE };
};

const getLocalizedNoTimeLabel = (locale: string) => locale.startsWith('zh') ? '未设置时间' : 'No time set';

const getAgendaPeriodLabel = (period: 'morning' | 'afternoon' | 'evening', locale: string) => {
  if (locale.startsWith('zh')) {
    if (period === 'morning') return '上午';
    if (period === 'afternoon') return '下午';
    return '晚上';
  }

  if (period === 'morning') return 'Morning';
  if (period === 'afternoon') return 'Afternoon';
  return 'Evening';
};

const getNoTimedPlansCopy = (locale: string) => {
  if (locale.startsWith('zh')) {
    return {
      title: '这一天没有具体时段安排',
      description: '当前日期只有全天事项，或还没有可放入时间轴的日程。'
    };
  }

  return {
    title: 'No timed agenda for this day',
    description: 'Only all-day items exist for this date, or there is nothing to place on the timeline yet.'
  };
};

const formatPlanTimeLabel = (plan: Plan, locale: string) => {
  const timestamp = getPlanPrimaryTimestamp(plan);
  if (!timestamp) return getLocalizedNoTimeLabel(locale);

  return new Intl.DateTimeFormat(locale, plan.isAllDay ? {
    month: 'short',
    day: 'numeric'
  } : {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

const formatPlanWindow = (plan: Plan, locale: string) => {
  if (plan.isAllDay) {
    return locale.startsWith('zh') ? '全天' : 'All day';
  }

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !locale.startsWith('zh')
  });

  if (plan.planType === 'event') {
    const start = plan.startAt || plan.reminderAt || plan.dueAt;
    const end = plan.endAt || (start ? start + HOUR : null);
    if (!start) return getLocalizedNoTimeLabel(locale);
    if (!end) return timeFormatter.format(new Date(start));
    return `${timeFormatter.format(new Date(start))} - ${timeFormatter.format(new Date(end))}`;
  }

  const due = plan.dueAt || plan.reminderAt || plan.startAt;
  return due ? timeFormatter.format(new Date(due)) : getLocalizedNoTimeLabel(locale);
};

const getBoardTheme = (plan: Plan, index: number) => {
  const bucket = getPlanBucket(plan);
  if (bucket === 'overdue') {
    return BOARD_THEMES[0];
  }
  if (bucket === 'completed') {
    return BOARD_THEMES[3];
  }
  if (bucket === 'cancelled') {
    return BOARD_THEMES[3];
  }
  return BOARD_THEMES[index % (BOARD_THEMES.length - 1) + 1];
};

const PlanCenter: React.FC<PlanCenterProps> = ({
  plans,
  isGuest = false,
  onCompletePlan,
  onCancelPlan
}) => {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<PlanViewMode>('schedule');
  const [filter, setFilter] = useState<PlanFilter>('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const now = Date.now();
  const selectedDateKey = getDateKey(selectedDate.getTime());
  const todayKey = getDateKey(now);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((left, right) => {
      const leftBucket = getPlanBucket(left, now);
      const rightBucket = getPlanBucket(right, now);
      const bucketDiff = getBucketWeight(leftBucket) - getBucketWeight(rightBucket);
      if (bucketDiff !== 0) return bucketDiff;

      const leftTime = getPlanPrimaryTimestamp(left) || Number.MAX_SAFE_INTEGER;
      const rightTime = getPlanPrimaryTimestamp(right) || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [plans, now]);

  const filterCounts = useMemo(() => {
    return {
      all: plans.length,
      pending: plans.filter((plan) => getPlanBucket(plan, now) === 'pending').length,
      overdue: plans.filter((plan) => getPlanBucket(plan, now) === 'overdue').length,
      completed: plans.filter((plan) => getPlanBucket(plan, now) === 'completed').length,
      cancelled: plans.filter((plan) => getPlanBucket(plan, now) === 'cancelled').length
    };
  }, [plans, now]);

  const filteredPlans = useMemo(() => {
    if (filter === 'all') return sortedPlans;
    return sortedPlans.filter((plan) => getPlanBucket(plan, now) === filter);
  }, [filter, sortedPlans, now]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const selectedDayPlans = useMemo(() => {
    return filteredPlans
      .filter((plan) => {
        const timestamp = getPlanPrimaryTimestamp(plan);
        return timestamp > 0 && getDateKey(timestamp) === selectedDateKey;
      })
      .sort((left, right) => {
        if (left.isAllDay !== right.isAllDay) {
          return left.isAllDay ? -1 : 1;
        }

        const leftTime = getPlanPrimaryTimestamp(left) || Number.MAX_SAFE_INTEGER;
        const rightTime = getPlanPrimaryTimestamp(right) || Number.MAX_SAFE_INTEGER;
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        return getBucketWeight(getPlanBucket(left, now)) - getBucketWeight(getPlanBucket(right, now));
      });
  }, [filteredPlans, now, selectedDateKey]);

  const selectedDayAllDayPlans = useMemo(() => selectedDayPlans.filter((plan) => plan.isAllDay), [selectedDayPlans]);
  const selectedDayTimedPlans = useMemo(() => selectedDayPlans.filter((plan) => !plan.isAllDay), [selectedDayPlans]);
  const selectedDaySummary = useMemo(() => {
    const pending = selectedDayPlans.filter((plan) => getPlanBucket(plan, now) === 'pending' || getPlanBucket(plan, now) === 'overdue').length;
    const completed = selectedDayPlans.filter((plan) => plan.status === 'completed').length;

    return {
      total: selectedDayPlans.length,
      timed: selectedDayTimedPlans.length,
      allDay: selectedDayAllDayPlans.length,
      pending,
      completed
    };
  }, [now, selectedDayAllDayPlans.length, selectedDayPlans, selectedDayTimedPlans.length]);

  const selectedDayTimedSections = useMemo(() => {
    const sections: Array<{ key: 'morning' | 'afternoon' | 'evening'; label: string; plans: Plan[] }> = [
      { key: 'morning', label: getAgendaPeriodLabel('morning', i18n.language), plans: [] },
      { key: 'afternoon', label: getAgendaPeriodLabel('afternoon', i18n.language), plans: [] },
      { key: 'evening', label: getAgendaPeriodLabel('evening', i18n.language), plans: [] }
    ];

    selectedDayTimedPlans.forEach((plan) => {
      const timestamp = getPlanPrimaryTimestamp(plan);
      const hour = timestamp ? new Date(timestamp).getHours() : 0;
      const key = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const section = sections.find((item) => item.key === key);
      if (section) {
        section.plans.push(plan);
      }
    });

    return sections.filter((section) => section.plans.length > 0);
  }, [i18n.language, selectedDayTimedPlans]);

  const timelineHours = useMemo(() => {
    if (selectedDayTimedPlans.length === 0) {
      return Array.from({ length: 10 }, (_, index) => index + 8);
    }

    const hours = selectedDayTimedPlans
      .map((plan) => getTimelineInterval(plan))
      .filter(Boolean) as Array<{ start: number; end: number }>;

    const minHour = Math.max(6, Math.min(...hours.map((item) => new Date(item.start).getHours())) - 1);
    const maxHour = Math.min(23, Math.max(...hours.map((item) => new Date(item.end).getHours())) + 2);

    return Array.from({ length: maxHour - minHour + 1 }, (_, index) => minHour + index);
  }, [selectedDayTimedPlans]);

  const timelineBars = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(timelineHours[0] || 8, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const totalMinutes = Math.max(1, timelineHours.length * 60);

    const laneEndTimes: number[] = [];
    const placements = selectedDayTimedPlans.map((plan) => {
      const interval = getTimelineInterval(plan);
      if (!interval) return null;

      let laneIndex = laneEndTimes.findIndex((laneEndTime) => interval.start >= laneEndTime);
      if (laneIndex === -1) {
        laneIndex = laneEndTimes.length;
        laneEndTimes.push(interval.end);
      } else {
        laneEndTimes[laneIndex] = interval.end;
      }

      return { plan, interval, laneIndex };
    }).filter(Boolean) as Array<{ plan: Plan; interval: { start: number; end: number }; laneIndex: number }>;

    const laneCount = Math.max(1, laneEndTimes.length);
    const laneSlotWidth = laneCount === 1 ? 94 : 92 / laneCount;

    return placements.map(({ plan, interval, laneIndex }, index) => {
      const startMinutes = Math.max(0, (interval.start - dayStartMs) / MINUTE);
      const endMinutes = Math.max(startMinutes + 30, (interval.end - dayStartMs) / MINUTE);
      const top = (startMinutes / totalMinutes) * 100;
      const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

      return {
        plan,
        top,
        height: Math.max(height, 7.5),
        left: laneCount === 1 ? 3 : 4 + laneIndex * laneSlotWidth,
        width: laneCount === 1 ? 94 : Math.max(24, laneSlotWidth - 2),
        tone: getBoardTheme(plan, index)
      };
    }) as Array<{
      plan: Plan;
      top: number;
      height: number;
      left: number;
      width: number;
      tone: typeof BOARD_THEMES[number];
    }>;
  }, [selectedDate, selectedDayTimedPlans, timelineHours]);

  const queueSummary = useMemo(() => {
    const pending = filterCounts.pending + filterCounts.overdue;
    const done = filterCounts.completed;
    const cancelled = filterCounts.cancelled;
    const total = Math.max(1, pending + done + cancelled);
    return {
      pendingWidth: `${(pending / total) * 100}%`,
      doneWidth: `${(done / total) * 100}%`,
      cancelledWidth: `${(cancelled / total) * 100}%`
    };
  }, [filterCounts]);

  const highlightedPlan = filteredPlans[0] || null;
  const stackedPlans = filteredPlans.slice(1, 7);

  const runPlanAction = async (runner: () => Promise<void>) => {
    try {
      await runner();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('plans.operation_failed'), tone: 'error' });
    } finally {
      setActionPlanId(null);
    }
  };

  const filterItems: Array<{ key: PlanFilter; label: string; count: number }> = [
    { key: 'all', label: t('plans.filters.all'), count: filterCounts.all },
    { key: 'pending', label: t('plans.filters.pending'), count: filterCounts.pending },
    { key: 'overdue', label: t('plans.filters.overdue'), count: filterCounts.overdue },
    { key: 'completed', label: t('plans.filters.completed'), count: filterCounts.completed }
  ];

  const viewItems: Array<{ key: PlanViewMode; label: string }> = [
    { key: 'board', label: t('plans.views.board') },
    { key: 'schedule', label: t('plans.views.schedule') }
  ];

  return (
    <>
      <NoticeToast
        open={Boolean(notice)}
        message={notice?.message || ''}
        tone={notice?.tone || 'info'}
        onClose={() => setNotice(null)}
      />

      <div className="space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-[linear-gradient(180deg,#fffdf8_0%,#fbf3dd_100%)] p-4 shadow-sm ring-1 ring-amber-100/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid flex-1 grid-cols-3 gap-2">
              <StatCard label={t('plans.sections.today')} value={filterCounts.pending + filterCounts.overdue} accent="amber" compact />
              <StatCard label={t('plans.sections.completed')} value={filterCounts.completed} accent="stone" compact />
              <StatCard label={t('plans.sections.overdue')} value={filterCounts.overdue} accent="rose" compact />
            </div>

            <div className="inline-flex rounded-[1.2rem] border border-[#edd7ac] bg-[#fff7e8] p-1 shadow-inner shadow-amber-100/40">
              {viewItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setViewMode(item.key)}
                  className={`rounded-[0.95rem] px-4 py-2 text-xs font-black transition-all ${viewMode === item.key ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`inline-flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-xs font-black transition-all ${filter === item.key ? 'bg-[#efd3a1] text-stone-900 shadow-sm ring-1 ring-[#d7b274]' : 'bg-[#fff7e8] text-stone-600 hover:bg-[#fff1d8] ring-1 ring-[#efdfbf]'}`}
              >
                <span>{item.label}</span>
                <span className={`inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-full px-1.5 text-[10px] ${filter === item.key ? 'bg-white/55 text-stone-800' : 'bg-white text-stone-500'}`}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {isGuest && (
            <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              {t('plans.guest_hint')}
            </div>
          )}
        </section>

        {viewMode === 'board' ? (
          <section className="space-y-4">
            {highlightedPlan ? (
              <>
                <TaskShowcaseCard
                  plan={highlightedPlan}
                  locale={i18n.language}
                  theme={getBoardTheme(highlightedPlan, 0)}
                  index={0}
                  actionPlanId={actionPlanId}
                  completeLabel={t('plans.complete')}
                  cancelLabel={t('plans.cancel')}
                  onComplete={() => {
                    setActionPlanId(highlightedPlan.id);
                    void runPlanAction(() => onCompletePlan(highlightedPlan.id));
                  }}
                  onCancel={() => {
                    setActionPlanId(highlightedPlan.id);
                    void runPlanAction(() => onCancelPlan(highlightedPlan.id));
                  }}
                />

                <section className="rounded-[1.6rem] border border-[#edd7ac] bg-[linear-gradient(180deg,#fff9ee_0%,#fff3d6_100%)] p-3 shadow-sm shadow-amber-100/25">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">{t('plans.queue_title')}</p>
                      <h3 className="mt-1 text-sm font-black tracking-tight text-stone-900">{t('plans.queue_desc')}</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-stone-500 ring-1 ring-[#efdfbf]">{filteredPlans.length}</span>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-full bg-white/90 ring-1 ring-[#efdfbf]">
                    <div className="flex h-4 w-full">
                      <div className="bg-[#f0d7a8]" style={{ width: queueSummary.pendingWidth }} />
                      <div className="bg-[#e7c489]" style={{ width: queueSummary.doneWidth }} />
                      <div className="bg-[#f5e8cc]" style={{ width: queueSummary.cancelledWidth }} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold text-stone-500">
                    <span>{t('plans.filters.pending')} {filterCounts.pending + filterCounts.overdue}</span>
                    <span>{t('plans.filters.completed')} {filterCounts.completed}</span>
                    <span>{t('plans.filters.cancelled')} {filterCounts.cancelled}</span>
                  </div>
                </section>

                <div className="space-y-3">
                  {stackedPlans.map((plan, index) => (
                    <TaskShowcaseCard
                      key={plan.id}
                      plan={plan}
                      locale={i18n.language}
                      theme={getBoardTheme(plan, index + 1)}
                      index={index + 1}
                      actionPlanId={actionPlanId}
                      completeLabel={t('plans.complete')}
                      cancelLabel={t('plans.cancel')}
                      onComplete={() => {
                        setActionPlanId(plan.id);
                        void runPlanAction(() => onCompletePlan(plan.id));
                      }}
                      onCancel={() => {
                        setActionPlanId(plan.id);
                        void runPlanAction(() => onCancelPlan(plan.id));
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyStateCard title={t('plans.empty_board_title')} description={t('plans.empty_board_desc')} />
            )}
          </section>
        ) : (
          <section className="rounded-[1.65rem] border border-[#edd7ac] bg-[linear-gradient(180deg,#fffaf1_0%,#fff3d6_55%,#f9e6be_100%)] p-3.5 shadow-sm shadow-amber-100/25 ring-1 ring-white/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-400">{t('plans.views.schedule')}</p>
                <h3 className="mt-1 text-[1.05rem] font-black tracking-tight text-stone-900">{t('plans.schedule_title')}</h3>
                <p className="mt-1 text-xs font-medium text-stone-500">{t('plans.schedule_desc')}</p>
              </div>
              <div className="rounded-[1rem] bg-white/90 px-3 py-1.5 text-[11px] font-black leading-tight text-stone-600 ring-1 ring-[#efdfbf] shadow-sm shadow-amber-100/20">
                {new Intl.DateTimeFormat(i18n.language, { month: 'long', day: 'numeric' }).format(selectedDate)}
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const dayKey = getDateKey(day.getTime());
                const isSelected = dayKey === selectedDateKey;
                const isToday = dayKey === todayKey;
                const dayCount = plans.filter((plan) => {
                  const timestamp = getPlanPrimaryTimestamp(plan);
                  return timestamp > 0 && getDateKey(timestamp) === dayKey;
                }).length;

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedDate(new Date(day))}
                    className={`relative flex h-[64px] min-w-0 flex-col items-center justify-center rounded-[0.9rem] px-1 py-1.5 text-sm font-black transition-all ${isSelected ? 'bg-[#efd3a1] text-stone-900 shadow-sm ring-1 ring-[#d7b274]' : 'bg-white/92 text-stone-500 ring-1 ring-[#efdfbf] hover:bg-[#fff7e8]'} ${isToday && !isSelected ? 'ring-2 ring-[#f1d18e]' : ''}`}
                  >
                    {isToday && <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-stone-800' : 'bg-[#d49f37]'}`} />}
                    {dayCount > 0 && <span className={`absolute bottom-1.5 right-1.5 inline-flex min-w-[1rem] items-center justify-center rounded-full px-1 py-0.5 text-[8px] leading-none ${isSelected ? 'bg-white/70 text-stone-700' : 'bg-[#fff3d6] text-stone-500'}`}>{dayCount}</span>}
                    <span className="text-[8px] uppercase tracking-[0.14em]">{new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }).format(day)}</span>
                    <span className="mt-1 text-[14px] leading-none">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2 md:grid-cols-4">
              <ScheduleSnapshotCard label={t('plans.queue_title')} value={selectedDaySummary.total} tone="default" />
              <ScheduleSnapshotCard label={t('plans.all_day_label')} value={selectedDaySummary.allDay} tone="default" />
              <ScheduleSnapshotCard label={t('plans.sections.today')} value={selectedDaySummary.pending} tone="accent" />
              <ScheduleSnapshotCard label={t('plans.sections.completed')} value={selectedDaySummary.completed} tone="soft" />
            </div>

            {selectedDayAllDayPlans.length > 0 && (
              <div className="mt-3.5 rounded-[1.15rem] border border-[#edd7ac] bg-white/60 p-2.5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-stone-400">
                  <span>{t('plans.all_day_label')}</span>
                  <span className="h-px flex-1 bg-[#efdfbf]" />
                </div>
                <div className="flex flex-wrap gap-2">
                {selectedDayAllDayPlans.map((plan) => (
                    <span key={plan.id} className="rounded-full bg-[#fff3d6] px-3 py-1.5 text-xs font-black text-stone-700 ring-1 ring-[#efdfbf]">
                      {plan.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDayPlans.length === 0 ? (
              <EmptyStateCard title={t('plans.timeline_empty_title')} description={t('plans.timeline_empty_desc')} compact />
            ) : (
              <>
                <div className="mt-3.5 grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
                  <div className="space-y-0.5 pt-4">
                    {timelineHours.map((hour) => (
                      <div key={hour} className="h-[62px] text-[10px] font-bold tracking-[0.08em] text-stone-400">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  <div className="relative rounded-[1.15rem] border border-[#edd7ac] bg-[linear-gradient(180deg,#fffefb_0%,#fff7e5_32%,#fff3d6_100%)] px-2 py-3.5 shadow-inner shadow-white/50">
                    <div className="pointer-events-none absolute inset-0 rounded-[1.15rem]">
                      {timelineHours.map((hour, index) => (
                        <div key={hour} className={`absolute inset-x-0 border-t border-dashed border-[#efdfbf] ${index === timelineHours.length - 1 ? '' : ''}`} style={{ top: `${(index / timelineHours.length) * 100}%` }} />
                      ))}
                    </div>

                    <div className="relative min-h-[calc(62px*8)]" style={{ height: `${timelineHours.length * 62}px` }}>
                      {timelineBars.map((bar, index) => (
                        <div
                          key={bar.plan.id}
                          className={`absolute overflow-hidden rounded-[1rem] border px-2.5 py-2 ${bar.tone.shell}`}
                          style={{ top: `${bar.top}%`, left: `${bar.left}%`, width: `${bar.width}%`, minHeight: `${Math.max(46, (bar.height / 100) * timelineHours.length * 62)}px` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${bar.tone.subtle}`}>{getBucketLabel(getPlanBucket(bar.plan), t)}</p>
                              <h4 className="mt-1 line-clamp-2 text-[12px] font-black tracking-tight">{bar.plan.title}</h4>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-black ${bar.tone.badge}`}>{index + 1}</span>
                          </div>
                          <p className={`mt-1.5 text-[10px] font-bold ${bar.tone.subtle}`}>{formatPlanWindow(bar.plan, i18n.language)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedDayTimedPlans.length === 0 ? (
                  <div className="mt-5 rounded-[1.35rem] border border-dashed border-[#edd7ac] bg-white/55 px-4 py-5 text-center">
                    <p className="text-sm font-black text-stone-800">{getNoTimedPlansCopy(i18n.language).title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{getNoTimedPlansCopy(i18n.language).description}</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {selectedDayTimedSections.map((section, sectionIndex) => (
                      <div key={section.key} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{section.label}</span>
                          <span className="h-px flex-1 bg-[#efdfbf]" />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {section.plans.map((plan, index) => (
                            <DayAgendaCard
                              key={plan.id}
                              plan={plan}
                              locale={i18n.language}
                              theme={getBoardTheme(plan, sectionIndex + index)}
                              actionPlanId={actionPlanId}
                              completeLabel={t('plans.complete')}
                              cancelLabel={t('plans.cancel')}
                              onComplete={() => {
                                setActionPlanId(plan.id);
                                void runPlanAction(() => onCompletePlan(plan.id));
                              }}
                              onCancel={() => {
                                setActionPlanId(plan.id);
                                void runPlanAction(() => onCancelPlan(plan.id));
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
};

const StatCard: React.FC<{ label: string; value: number; accent: 'amber' | 'stone' | 'rose'; compact?: boolean }> = ({ label, value, accent, compact = false }) => {
  const palette = accent === 'amber'
    ? 'bg-[linear-gradient(180deg,#fff8ea_0%,#fff3d6_100%)] text-amber-900 border-[#edd7ac]'
    : accent === 'rose'
      ? 'bg-[linear-gradient(180deg,#fff8ea_0%,#fff0db_100%)] text-stone-900 border-[#edd7ac]'
      : 'bg-[linear-gradient(180deg,#fff8ea_0%,#fff3d6_100%)] text-stone-900 border-[#edd7ac]';

  return (
    <div className={`border shadow-sm ${compact ? 'rounded-[1rem] px-3 py-2' : 'rounded-[1.4rem] p-4'} ${palette}`}>
      {compact ? (
        <div className="flex items-end justify-between gap-2">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
          <p className="text-[1.3rem] font-black leading-none tracking-tight">{value}</p>
        </div>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
        </>
      )}
    </div>
  );
};

const ScheduleSnapshotCard: React.FC<{ label: string; value: number; tone: 'default' | 'accent' | 'soft' }> = ({ label, value, tone }) => {
  const palette = tone === 'accent'
    ? 'bg-[#efd3a1] text-stone-900 border-[#d7b274]'
    : tone === 'soft'
      ? 'bg-white/85 text-stone-700 border-[#efdfbf]'
      : 'bg-[linear-gradient(180deg,#fff8ea_0%,#fff3d6_100%)] text-stone-800 border-[#edd7ac]';

  return (
    <div className={`rounded-[1rem] border px-3 py-2 shadow-sm ${palette}`}>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-60">{label}</p>
        <p className="text-[1.1rem] font-black leading-none tracking-tight">{value}</p>
      </div>
    </div>
  );
};

const TaskShowcaseCard: React.FC<{
  plan: Plan;
  locale: string;
  theme: typeof BOARD_THEMES[number];
  index: number;
  actionPlanId: string | null;
  completeLabel: string;
  cancelLabel: string;
  onComplete: () => void;
  onCancel: () => void;
}> = ({ plan, locale, theme, index, actionPlanId, completeLabel, cancelLabel, onComplete, onCancel }) => {
  const { t } = useTranslation();
  const bucket = getPlanBucket(plan);
  const isBusy = actionPlanId === plan.id;
  const isPrimaryCard = index === 0;

  return (
    <article className={`overflow-hidden rounded-[1.6rem] border ${isPrimaryCard ? 'p-4' : 'p-3.5'} ${theme.shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${theme.badge}`}>
              {getBucketLabel(bucket, t)}
            </span>
            <span className={`text-[11px] font-bold ${theme.subtle}`}>{index + 1}</span>
          </div>
          <h3 className={`mt-2 font-black leading-tight tracking-tight ${isPrimaryCard ? 'text-[1.2rem]' : 'text-[1rem]'}`}>{plan.title}</h3>
          <p className={`mt-2 text-xs font-bold ${theme.subtle}`}>{formatPlanWindow(plan, locale)}</p>
          {plan.notes && <p className={`mt-2 max-w-2xl text-xs leading-relaxed line-clamp-2 ${theme.subtle}`}>{plan.notes}</p>}
        </div>

        <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${theme.arrow}`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M7 7h10v10" /></svg>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${theme.badge}`}>{t(`plans.type.${plan.planType}`)}</span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${theme.badge}`}>{formatPlanTimeLabel(plan, locale)}</span>
      </div>

      {plan.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onComplete}
            disabled={isBusy}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${theme.actionPrimary}`}
          >
            {completeLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className={`rounded-full px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${theme.actionSecondary}`}
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </article>
  );
};

const DayAgendaCard: React.FC<{
  plan: Plan;
  locale: string;
  theme: typeof BOARD_THEMES[number];
  actionPlanId: string | null;
  completeLabel: string;
  cancelLabel: string;
  onComplete: () => void;
  onCancel: () => void;
}> = ({ plan, locale, theme, actionPlanId, completeLabel, cancelLabel, onComplete, onCancel }) => {
  const { t } = useTranslation();
  const isBusy = actionPlanId === plan.id;
  const bucket = getPlanBucket(plan);

  return (
    <article className="rounded-[1.2rem] border border-[#edd7ac] bg-[linear-gradient(180deg,#fffdf7_0%,#fff3d6_100%)] p-3 shadow-sm shadow-amber-100/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{t(`plans.type.${plan.planType}`)}</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${theme.badge}`}>{getBucketLabel(bucket, t)}</span>
          </div>
          <h4 className="mt-1.5 line-clamp-1 text-[15px] font-black tracking-tight text-stone-900">{plan.title}</h4>
          <p className="mt-1 text-[11px] font-bold text-stone-500">{formatPlanWindow(plan, locale)}</p>
          {plan.notes && <p className="mt-1.5 line-clamp-1 text-[11px] text-stone-500">{plan.notes}</p>}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-stone-500 ring-1 ring-[#efdfbf]">{formatPlanTimeLabel(plan, locale)}</span>
      </div>

      {plan.status === 'pending' && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onComplete}
            disabled={isBusy}
            className="flex-1 rounded-full bg-[#efd3a1] px-3 py-2 text-[11px] font-black text-stone-900 transition-colors hover:bg-[#f6e3bf] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {completeLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-full bg-white px-3 py-2 text-[11px] font-black text-stone-600 ring-1 ring-[#efdfbf] transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </article>
  );
};

const EmptyStateCard: React.FC<{ title: string; description: string; compact?: boolean }> = ({ title, description, compact = false }) => (
  <div className={`rounded-[1.9rem] border border-dashed border-[#edd7ac] bg-[linear-gradient(180deg,#fffaf0_0%,#fff3d6_100%)] text-center ${compact ? 'px-4 py-10' : 'px-5 py-14'}`}>
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-[#efdfbf]">
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
    </div>
    <p className="mt-4 text-base font-black text-stone-800">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-stone-500">{description}</p>
  </div>
);

const getBucketLabel = (bucket: Exclude<PlanFilter, 'all'>, t: ReturnType<typeof useTranslation>['t']) => {
  if (bucket === 'overdue') return t('plans.filters.overdue');
  if (bucket === 'pending') return t('plans.filters.pending');
  if (bucket === 'completed') return t('plans.filters.completed');
  return t('plans.filters.cancelled');
};

export default PlanCenter;