import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FinanceRecord } from '../types';
import { fetchFinanceRecords, fetchFinanceStats, deleteFinanceRecord } from '../services/financeService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import NoticeToast from './NoticeToast';
import ConfirmDialog from './ConfirmDialog';

interface FinanceProps {
  userId: string;
}

type FilterType = 'WEEK' | 'MONTH' | 'ALL';

const COLORS = ['#f59e0b', '#ea580c', '#14b8a6', '#10b981', '#ef4444', '#84cc16', '#64748b'];

const formatCurrency = (value: number) => `¥${value.toFixed(2)}`;

const formatRecordTime = (value: string | number | Date, locale: string) => {
    return new Intl.DateTimeFormat(locale, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
};

const getRecordTone = (record: FinanceRecord) => {
    if (record.type === 'EXPENSE') {
        return {
            badge: '−',
            iconClass: 'bg-rose-50 text-rose-500 ring-1 ring-rose-100',
            amountClass: 'text-slate-900',
            sideGlow: 'from-rose-200/60 via-rose-100/10 to-transparent'
        };
    }

    return {
        badge: '+',
        iconClass: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
        amountClass: 'text-emerald-600',
        sideGlow: 'from-emerald-200/60 via-emerald-100/10 to-transparent'
    };
};

const Finance: React.FC<FinanceProps> = ({ userId }) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('WEEK');
    const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
    const [pendingDeleteRecord, setPendingDeleteRecord] = useState<FinanceRecord | null>(null);

  // Load data based on filter
  useEffect(() => {
    loadData();
  }, [userId, filter]);

    useEffect(() => {
        if (!notice) return;

        const timer = window.setTimeout(() => {
            setNotice(null);
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [notice]);

  const getDateRange = (type: FilterType) => {
    const now = new Date();
    let start = new Date();
    
    if (type === 'WEEK') {
      const day = now.getDay() || 7; // 1-7 (Mon-Sun)
      start.setDate(now.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
    } else if (type === 'MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      return { startDate: undefined, endDate: undefined };
    }

    return {
      startDate: start.toISOString(),
      endDate: now.toISOString()
    };
  };

  const loadData = async () => {
    try {
        setLoading(true);
        const { startDate, endDate } = getDateRange(filter);
        const [recs, st] = await Promise.all([
            fetchFinanceRecords(), // Fetching all records for the list (could be filtered too)
            fetchFinanceStats(startDate, endDate)
        ]);
        
        // Filter records locally for the list as well to match stats
        const filteredRecs = startDate ? recs.filter(r => {
            const date = new Date(r.transactionDate).getTime();
            return date >= new Date(startDate).getTime() && date <= new Date(endDate!).getTime();
        }) : recs;

        setRecords(filteredRecs);
        setStats(st);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!stats?.byCategory) return [];
    return Object.entries(stats.byCategory).map(([name, value]) => ({
      name,
            value: Number(value)
    })).sort((a, b) => (b.value as number) - (a.value as number));
  }, [stats]);

    const summaryCards = useMemo(() => {
        if (!stats) return [];

        return [
            {
                key: 'income',
                label: t('finance.total_income'),
                value: formatCurrency(stats.totalIncome),
                tone: 'text-emerald-600',
                shell: 'border-emerald-100 bg-white'
            },
            {
                key: 'expense',
                label: t('finance.total_expense'),
                value: formatCurrency(stats.totalExpense),
                tone: 'text-rose-500',
                shell: 'border-rose-100 bg-white'
            },
            {
                key: 'count',
                label: t('finance.list_title'),
                value: `${records.length}`,
                tone: 'text-slate-900',
                shell: 'border-amber-100 bg-amber-50/70'
            }
        ];
    }, [records.length, stats, t]);

    const topCategory = chartData[0] || null;

  const handleDelete = async (id: string) => {
      try {
          await deleteFinanceRecord(id);
          await loadData();
          setNotice({ message: t('finance.delete_success'), tone: 'success' });
      } catch(e) {
          setNotice({ message: t('finance.delete_failed'), tone: 'error' });
      } finally {
          setPendingDeleteRecord(null);
      }
  };

  if (loading && records.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400">{t('finance.loading')}</p>
          </div>
      );
  }
  
  return (
            <>
            <NoticeToast
                open={Boolean(notice)}
                message={notice?.message || ''}
                tone={notice?.tone || 'info'}
                onClose={() => setNotice(null)}
            />
            <ConfirmDialog
                open={Boolean(pendingDeleteRecord)}
                title={t('finance.title')}
                message={t('finance.delete_confirm')}
                confirmLabel={t('common.confirm')}
                cancelLabel={t('common.cancel')}
                tone="danger"
                onCancel={() => setPendingDeleteRecord(null)}
                onConfirm={() => {
                    if (pendingDeleteRecord?.id) {
                        void handleDelete(pendingDeleteRecord.id);
                    }
                }}
            />
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                <header className="overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d6_42%,#ffffff_100%)] p-5 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">{t('finance.title')}</p>
                            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{t('finance.chart_expense_category')}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('finance.list_title')}</p>
                        </div>
                        <div className="inline-flex rounded-2xl border border-white/80 bg-white/80 p-1.5 shadow-sm backdrop-blur">
                            {(['WEEK', 'MONTH', 'ALL'] as FilterType[]).map(tType => (
                                <button
                                    key={tType}
                                    onClick={() => setFilter(tType)}
                                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                        filter === tType
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tType === 'WEEK' ? t('finance.filter.week') : tType === 'MONTH' ? t('finance.filter.month') : t('finance.filter.all')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {summaryCards.length > 0 && (
                        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                            {summaryCards.map((card) => (
                                <div key={card.key} className={`rounded-[1.5rem] border p-4 shadow-sm ${card.shell}`}>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                                    <p className={`mt-2 text-2xl font-black tracking-tight ${card.tone}`}>{card.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </header>

                {chartData.length > 0 && (
                    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">{t('finance.chart_expense_category')}</p>
                                    <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{topCategory?.name || t('finance.title')}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{topCategory ? formatCurrency(topCategory.value) : '—'}</p>
                                </div>
                                <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100">
                                    {chartData.length}
                                </div>
                            </div>

                            <div className="mt-4 h-[240px] w-full rounded-[1.5rem] bg-[radial-gradient(circle_at_top,#fff7e8_0%,#ffffff_72%)]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={62}
                                            outerRadius={88}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '18px', border: '1px solid rgba(226, 232, 240, 0.9)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)' }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('finance.list_title')}</p>
                                    <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{t('finance.chart_expense_category')}</h3>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                {chartData.map((item, index) => (
                                    <div key={item.name} className="rounded-[1.25rem] border border-slate-100 bg-slate-50/80 px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{item.name}</span>
                                            <span className="text-sm font-black text-slate-900">{formatCurrency(item.value)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('finance.list_title')}</p>
                            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{t('finance.title')}</h3>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                            {records.length} {t('finance.list_count_suffix') || ''}
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {records.map((record) => {
                            const tone = getRecordTone(record);

                            return (
                                <div key={record.id} className="group relative overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                                    <div className={`pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r ${tone.sideGlow}`} />
                                    <div className="relative flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-start gap-4">
                                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${tone.iconClass}`}>
                                                {tone.badge}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900">{record.category}</span>
                                                    {record.description && (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                                            {record.description}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-[11px] font-bold text-slate-400">
                                                    {formatRecordTime(record.transactionDate, i18n.language)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <div className="text-right">
                                                <div className={`text-lg font-black ${tone.amountClass}`}>
                                                    {record.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(parseFloat(record.amount as any))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setPendingDeleteRecord(record)}
                                                className="p-2 text-slate-300 transition-all hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {records.length === 0 && (
                            <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-[linear-gradient(180deg,#fafaf9_0%,#fffaf0_100%)] p-12 text-center">
                                <div className="text-4xl">📒</div>
                                <p className="mt-3 text-sm font-black text-slate-600">
                                    {filter === 'WEEK' ? t('finance.no_records.week') : filter === 'MONTH' ? t('finance.no_records.month') : t('finance.no_records.all')}
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
                        </>
  );
};


export default Finance;
