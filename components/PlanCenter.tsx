import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../types';
import NoticeToast from './NoticeToast';

type PlanTab = 'today' | 'calendar' | 'list';

interface PlanCenterProps {
  plans: Plan[];
  isGuest?: boolean;
  onOpenLoggerComposer: () => void;
  onCompletePlan: (planId: string) => Promise<void>;
  onCancelPlan: (planId: string) => Promise<void>;
}

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

const getNoTimeLabel = (locale: string) => locale.startsWith('zh') ? '未设置时间' : 'No time set';

const getWeekdayLabels = (locale: string) => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const start = new Date(Date.UTC(2026, 2, 29));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return formatter.format(date);
  });
};

const getPlanSurfaceTone = (plan: Plan) => {
  if (plan.status === 'completed') {
    return {
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
      panel: 'border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)]'
    };
  }

  if (plan.status === 'cancelled') {
    return {
      dot: 'bg-rose-500',
      badge: 'bg-rose-100 text-rose-700',
      panel: 'border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)]'
    };
  }

  if (plan.planType === 'event') {
    return {
      dot: 'bg-sky-500',
      badge: 'bg-sky-100 text-sky-700',
      panel: 'border-sky-100 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_100%)]'
    };
  }

  return {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    panel: 'border-amber-100 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_100%)]'
  };
};

const formatPlanTime = (plan: Plan, locale: string) => {
  const baseTimestamp = getPlanPrimaryTimestamp(plan);
  if (!baseTimestamp) return null;
  const formatter = new Intl.DateTimeFormat(locale, plan.isAllDay ? {
    month: 'short',
    day: 'numeric'
  } : {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return formatter.format(new Date(baseTimestamp));
};

const startOfMonthGrid = (anchor: Date) => {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstWeekday = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstWeekday);
  return gridStart;
};

const PlanCenter: React.FC<PlanCenterProps> = ({
  plans,
  isGuest = false,
  onOpenLoggerComposer,
  onCompletePlan,
  onCancelPlan
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<PlanTab>('today');
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => getDateKey(Date.now()));
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const todayKey = getDateKey(Date.now());
  const weekdayLabels = useMemo(() => getWeekdayLabels(i18n.language), [i18n.language]);

  React.useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const dateBucket = useMemo(() => {
    return plans.reduce((acc: Record<string, Plan[]>, plan) => {
      const timestamp = getPlanPrimaryTimestamp(plan);
      if (!timestamp) return acc;
      const key = getDateKey(timestamp);
      if (!acc[key]) acc[key] = [];
      acc[key].push(plan);
      return acc;
    }, {});
  }, [plans]);

  const todayPlans = useMemo(() => (dateBucket[todayKey] || []).slice().sort((left, right) => {
    const leftTime = getPlanPrimaryTimestamp(left);
    const rightTime = getPlanPrimaryTimestamp(right);
    return leftTime - rightTime;
  }), [dateBucket, todayKey]);

  const selectedDatePlans = useMemo(() => (dateBucket[selectedDateKey] || []).slice().sort((left, right) => {
    const leftTime = getPlanPrimaryTimestamp(left);
    const rightTime = getPlanPrimaryTimestamp(right);
    return leftTime - rightTime;
  }), [dateBucket, selectedDateKey]);

  const groupedPlans = useMemo(() => {
    const now = Date.now();
    return {
      today: todayPlans,
      upcoming: plans.filter(plan => plan.status === 'pending' && getPlanPrimaryTimestamp(plan) > now && !todayPlans.some(item => item.id === plan.id)),
      overdue: plans.filter(plan => plan.status === 'pending' && getPlanPrimaryTimestamp(plan) > 0 && getPlanPrimaryTimestamp(plan) < now && !todayPlans.some(item => item.id === plan.id)),
      completed: plans.filter(plan => plan.status === 'completed')
    };
  }, [plans, todayPlans]);

  const summaryItems = useMemo(() => ([
    { key: 'today', label: t('plans.sections.today'), value: groupedPlans.today.length, shell: 'bg-white/90 border-white/80 text-slate-900' },
    { key: 'upcoming', label: t('plans.sections.upcoming'), value: groupedPlans.upcoming.length, shell: 'bg-white/80 border-white/70 text-slate-900' },
    { key: 'completed', label: t('plans.sections.completed'), value: groupedPlans.completed.length, shell: 'bg-slate-900 text-white border-slate-900' }
  ]), [groupedPlans.completed.length, groupedPlans.today.length, groupedPlans.upcoming.length, t]);

  const calendarDays = useMemo(() => {
    const start = startOfMonthGrid(calendarAnchor);
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      const dateKey = getDateKey(current.getTime());
      return {
        date: current,
        dateKey,
        items: dateBucket[dateKey] || []
      };
    });
  }, [calendarAnchor, dateBucket]);

  const runPlanAction = async (runner: () => Promise<void>) => {
    try {
      await runner();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : t('plans.operation_failed'), tone: 'error' });
    } finally {
      setActionPlanId(null);
    }
  };

  const tabItems: Array<{ key: PlanTab; label: string }> = [
    { key: 'today', label: t('plans.tabs.today') },
    { key: 'calendar', label: t('plans.tabs.calendar') },
    { key: 'list', label: t('plans.tabs.list') }
  ];

  return (
    <>
      <NoticeToast
        open={Boolean(notice)}
        message={notice?.message || ''}
        tone={notice?.tone || 'info'}
        onClose={() => setNotice(null)}
      />
    <div className="space-y-5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d6_40%,#ffffff_100%)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">{t('plans.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{t('plans.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('plans.subtitle')}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {summaryItems.map((item) => (
            <div key={item.key} className={`rounded-[1.4rem] border p-4 shadow-sm ${item.shell}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight">{item.value}</p>
            </div>
          ))}
        </div>

        {isGuest && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-white/75 px-4 py-3 text-sm text-amber-800 backdrop-blur-sm">
            {t('plans.guest_hint')}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fff8eb_100%)] p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">{t('nav.chat_home')}</p>
              <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{t('plans.bridge_title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('plans.bridge_desc')}</p>
            </div>
            <button
              type="button"
              onClick={onOpenLoggerComposer}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800"
            >
              {t('plans.bridge_action')}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {tabItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`rounded-2xl px-3 py-3 text-sm font-black transition-colors ${activeTab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'today' && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">{t('plans.sections.today')}</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{t('plans.today_title')}</h3>
              <p className="text-sm text-slate-500">{t('plans.today_desc')}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">{todayPlans.length}</span>
          </div>

          {todayPlans.length === 0 ? (
            <EmptyCard title={t('plans.empty_today_title')} description={t('plans.empty_today_desc')} />
          ) : (
            <div className="mt-4 space-y-3">
              {todayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  locale={i18n.language}
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
          )}
        </section>
      )}

      {activeTab === 'calendar' && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() - 1, 1))}
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
              aria-label={t('plans.prev_month')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">{t('plans.tabs.calendar')}</p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                {new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' }).format(calendarAnchor)}
              </h3>
              <p className="text-sm text-slate-500">{t('plans.calendar_desc')}</p>
            </div>
            <button
              onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1))}
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
              aria-label={t('plans.next_month')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] p-3">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">
            {weekdayLabels.map((label) => (
              <div key={label}>{label}</div>
            ))}
            </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const isCurrentMonth = day.date.getMonth() === calendarAnchor.getMonth();
              const isSelected = day.dateKey === selectedDateKey;
              const isToday = day.dateKey === todayKey;

              return (
                <button
                  key={day.dateKey}
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={`min-h-[78px] rounded-2xl border p-2 text-left transition-all ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200' : isToday ? 'border-amber-300 bg-amber-50 text-slate-900' : 'border-slate-100 bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-slate-50'} ${!isCurrentMonth ? 'opacity-45' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-sm font-black">{day.date.getDate()}</div>
                    {day.items.length > 0 && (
                      <div className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {day.items.length}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {day.items.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`h-1.5 flex-1 rounded-full ${item.status === 'completed' ? 'bg-emerald-400' : item.planType === 'event' ? 'bg-sky-400' : 'bg-amber-400'}`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          </div>

          <div className="mt-5 rounded-[1.75rem] border border-slate-100 bg-slate-50/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('plans.day_drawer_title')}</p>
                <h4 className="mt-2 text-lg font-black tracking-tight text-slate-900">{selectedDateKey}</h4>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">{selectedDatePlans.length}</span>
            </div>

            {selectedDatePlans.length === 0 ? (
              <EmptyCard title={t('plans.empty_day_title')} description={t('plans.empty_day_desc')} compact />
            ) : (
              <div className="mt-3 space-y-3">
                {selectedDatePlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    locale={i18n.language}
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
            )}
          </div>
        </section>
      )}

      {activeTab === 'list' && (
        <section className="space-y-4">
          <PlanGroup title={t('plans.sections.today')} plans={groupedPlans.today} locale={i18n.language} />
          <PlanGroup title={t('plans.sections.upcoming')} plans={groupedPlans.upcoming} locale={i18n.language} />
          <PlanGroup title={t('plans.sections.overdue')} plans={groupedPlans.overdue} locale={i18n.language} />
          <PlanGroup title={t('plans.sections.completed')} plans={groupedPlans.completed} locale={i18n.language} />
        </section>
      )}
    </div>
    </>
  );
};

const EmptyCard: React.FC<{ title: string; description: string; compact?: boolean }> = ({ title, description, compact = false }) => (
  <div className={`mt-4 rounded-[1.75rem] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#fafaf9_0%,#fffaf0_100%)] text-center ${compact ? 'px-4 py-6' : 'px-5 py-10'}`}>
    <div className="text-3xl">🗓️</div>
    <p className="mt-3 text-sm font-black text-slate-700">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
  </div>
);

const PlanGroup: React.FC<{ title: string; plans: Plan[]; locale: string }> = ({ title, plans, locale }) => (
  <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{title}</h3>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{plans.length}</span>
    </div>
    {plans.length === 0 ? (
      <EmptyCard title={title} description={locale.startsWith('zh') ? '这里还没有计划。' : 'No plans here yet.'} compact />
    ) : (
      <div className="mt-4 space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-[1.5rem] border px-4 py-3 ${getPlanSurfaceTone(plan).panel}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-800">{plan.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatPlanTime(plan, locale) || getNoTimeLabel(locale)}</p>
              </div>
              <StatusBadge plan={plan} />
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const PlanCard: React.FC<{
  plan: Plan;
  locale: string;
  actionPlanId: string | null;
  completeLabel: string;
  cancelLabel: string;
  onComplete: () => void;
  onCancel: () => void;
}> = ({ plan, locale, actionPlanId, completeLabel, cancelLabel, onComplete, onCancel }) => {
  const isBusy = actionPlanId === plan.id;
  const tone = getPlanSurfaceTone(plan);

  return (
    <article className={`rounded-[1.75rem] border p-4 shadow-sm ${tone.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
            <h4 className="text-base font-black tracking-tight text-slate-800">{plan.title}</h4>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">{formatPlanTime(plan, locale) || getNoTimeLabel(locale)}</p>
          {plan.notes && <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.notes}</p>}
        </div>
        <StatusBadge plan={plan} />
      </div>

      {plan.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onComplete}
            disabled={isBusy}
            className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {completeLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </article>
  );
};

const StatusBadge: React.FC<{ plan: Plan }> = ({ plan }) => {
  const { t } = useTranslation();
  const palette = getPlanSurfaceTone(plan).badge;

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${palette}`}>
      {plan.status === 'pending' ? t(`plans.type.${plan.planType}`) : t(`plans.status.${plan.status}`)}
    </span>
  );
};

export default PlanCenter;