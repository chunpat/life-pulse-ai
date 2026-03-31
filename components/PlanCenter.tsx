import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../types';

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
  const todayKey = getDateKey(Date.now());

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
      window.alert(error instanceof Error ? error.message : t('plans.operation_failed'));
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
    <div className="space-y-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">{t('plans.eyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{t('plans.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('plans.subtitle')}</p>
          </div>
          <button
            onClick={onOpenLoggerComposer}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            {t('plans.quick_add')}
          </button>
        </div>
        {isGuest && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('plans.guest_hint')}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {tabItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`rounded-2xl px-3 py-3 text-sm font-bold transition-colors ${activeTab === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
              <h3 className="text-lg font-black text-slate-900">{t('plans.today_title')}</h3>
              <p className="text-sm text-slate-500">{t('plans.today_desc')}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{todayPlans.length}</span>
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
              className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              aria-label={t('plans.prev_month')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900">
                {new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' }).format(calendarAnchor)}
              </h3>
              <p className="text-sm text-slate-500">{t('plans.calendar_desc')}</p>
            </div>
            <button
              onClick={() => setCalendarAnchor(new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 1))}
              className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              aria-label={t('plans.next_month')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
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
                  className={`min-h-[72px] rounded-2xl border p-2 text-left transition-colors ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : isToday ? 'border-amber-300 bg-amber-50 text-slate-900' : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'} ${!isCurrentMonth ? 'opacity-45' : ''}`}
                >
                  <div className="text-sm font-bold">{day.date.getDate()}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {day.items.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`h-1.5 flex-1 rounded-full ${item.status === 'completed' ? 'bg-emerald-400' : item.planType === 'event' ? 'bg-sky-400' : 'bg-amber-400'}`}
                      />
                    ))}
                  </div>
                  {day.items.length > 0 && (
                    <div className="mt-2 text-[10px] font-bold opacity-80">{day.items.length}</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">{t('plans.day_drawer_title')}</h4>
                <p className="text-xs text-slate-500">{selectedDateKey}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">{selectedDatePlans.length}</span>
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
  );
};

const EmptyCard: React.FC<{ title: string; description: string; compact?: boolean }> = ({ title, description, compact = false }) => (
  <div className={`mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 text-center ${compact ? 'px-4 py-6' : 'px-5 py-10'}`}>
    <p className="text-sm font-bold text-slate-700">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
  </div>
);

const PlanGroup: React.FC<{ title: string; plans: Plan[]; locale: string }> = ({ title, plans, locale }) => (
  <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{plans.length}</span>
    </div>
    {plans.length === 0 ? (
      <EmptyCard title={title} description="暂无计划。" compact />
    ) : (
      <div className="mt-4 space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{plan.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatPlanTime(plan, locale) || 'No time set'}</p>
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

  return (
    <article className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${plan.status === 'completed' ? 'bg-emerald-500' : plan.planType === 'event' ? 'bg-sky-500' : 'bg-amber-500'}`} />
            <h4 className="text-sm font-bold text-slate-800">{plan.title}</h4>
          </div>
          <p className="mt-2 text-xs text-slate-500">{formatPlanTime(plan, locale) || 'No time set'}</p>
          {plan.notes && <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.notes}</p>}
        </div>
        <StatusBadge plan={plan} />
      </div>

      {plan.status === 'pending' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onComplete}
            disabled={isBusy}
            className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {completeLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
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
  const palette = plan.status === 'completed'
    ? 'bg-emerald-100 text-emerald-700'
    : plan.status === 'cancelled'
      ? 'bg-rose-100 text-rose-700'
      : plan.planType === 'event'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${palette}`}>
      {plan.status === 'pending' ? t(`plans.type.${plan.planType}`) : t(`plans.status.${plan.status}`)}
    </span>
  );
};

export default PlanCenter;