import React, { useEffect, useState, useMemo } from 'react';
import { FinanceRecord } from '../types';
import { fetchFinanceRecords, fetchFinanceStats, deleteFinanceRecord } from '../services/financeService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface FinanceProps {
  userId: string;
}

type FilterType = 'WEEK' | 'MONTH' | 'ALL';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e'];

const Finance: React.FC<FinanceProps> = ({ userId }) => {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('WEEK');

  // Load data based on filter
  useEffect(() => {
    loadData();
  }, [userId, filter]);

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
      value
    })).sort((a, b) => (b.value as number) - (a.value as number));
  }, [stats]);

  const handleDelete = async (id: string) => {
      if(!confirm('确定删除?')) return;
      try {
          await deleteFinanceRecord(id);
          loadData();
      } catch(e) {
          alert('删除失败');
      }
  };

  if (loading && records.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400">正在分析订单...</p>
          </div>
      );
  }
  
  return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <header className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">财务账本</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['WEEK', 'MONTH', 'ALL'] as FilterType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            filter === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                        }`}
                    >
                        {t === 'WEEK' ? '本周' : t === 'MONTH' ? '本月' : '全部'}
                    </button>
                ))}
            </div>
        </header>
        
        {/* Stats Summary Card */}
        {stats && (
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">总收入</div>
                    <div className="text-xl font-black text-emerald-500">¥{stats.totalIncome.toFixed(2)}</div>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">总支出</div>
                    <div className="text-xl font-black text-rose-500">¥{stats.totalExpense.toFixed(2)}</div>
                </div>
            </div>
        )}

        {/* Charts Section */}
        {chartData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">支出分类占比</h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => `¥${value.toFixed(2)}`}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                    {chartData.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-[10px] font-bold text-slate-500 truncate flex-1">{item.name}</span>
                            <span className="text-[10px] font-black text-slate-700">¥{item.value.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* List */}
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-slate-800">记账清单</h3>
                <span className="text-[10px] font-bold text-slate-400">{records.length} 笔记录</span>
            </div>
            <div className="space-y-3">
                {records.map(record => (
                    <div key={record.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg ${
                                record.type === 'EXPENSE' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                            }`}>
                                {record.type === 'EXPENSE' ? '−' : '+'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-slate-800">{record.category}</span>
                                    {record.description && (
                                        <span className="text-xs text-slate-400 font-medium">{record.description}</span>
                                    )}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400">
                                    {new Date(record.transactionDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`text-base font-black ${
                                record.type === 'EXPENSE' ? 'text-slate-800' : 'text-emerald-500'
                            }`}>
                                ¥{parseFloat(record.amount as any).toFixed(2)}
                            </span>
                            <button 
                                onClick={() => record.id && handleDelete(record.id)} 
                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
                
                {records.length === 0 && (
                    <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
                        <div className="text-3xl mb-2">📒</div>
                        <p className="text-xs font-bold text-slate-400">
                            {filter === 'WEEK' ? '本周' : filter === 'MONTH' ? '本月' : '当前'}暂无记录
                        </p>
                    </div>
                )}
            </div>
        </div>
      </div>
  );
};


export default Finance;
