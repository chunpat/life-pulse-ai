
import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { LogEntry } from '../types';
import { getDailyInsight } from '../services/geminiService';

interface AnalyticsProps {
  logs: LogEntry[];
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'];

const Analytics: React.FC<AnalyticsProps> = ({ logs }) => {
  const [insight, setInsight] = useState<string>('Loading AI insight...');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      if (logs.length > 0) {
        setIsGenerating(true);
        try {
          const res = await getDailyInsight(logs);
          setInsight(res);
        } catch (e) {
          setInsight("Couldn't generate insight right now.");
        } finally {
          setIsGenerating(false);
        }
      } else {
        setInsight("Logs will appear here once you start recording your day.");
      }
    };
    fetchInsight();
  }, [logs]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(log => {
      map[log.category] = (map[log.category] || 0) + log.durationMinutes;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const totalTime = useMemo(() => {
    return logs.reduce((acc, log) => acc + log.durationMinutes, 0);
  }, [logs]);

  const hours = Math.floor(totalTime / 60);
  const mins = totalTime % 60;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 pb-10">
      {/* AI Card */}
      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-indigo-200" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Daily Insight</span>
          </div>
          <p className="text-lg leading-relaxed font-medium">
            {isGenerating ? "Synthesizing your data..." : insight}
          </p>
        </div>
        <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Logged Time" value={`${hours}h ${mins}m`} sub="Today" />
        <StatCard label="Activities" value={logs.length.toString()} sub="Items captured" />
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">Time Distribution</h3>
        {categoryData.length > 0 ? (
          <div className="h-64">
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
                  formatter={(value: number) => [`${value} mins`, 'Duration']}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">{entry.name}: {entry.value}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs italic">
            Not enough data for visualization
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Mood Tracking</h3>
        <p className="text-xs text-slate-500 mb-4">How your energy fluctuated throughout recorded activities.</p>
        <div className="h-40">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logs.slice().reverse()}>
                <XAxis dataKey="id" hide />
                <Tooltip 
                   labelFormatter={() => 'Activity'}
                   formatter={(value: any, name: any, props: any) => [props.payload.mood, 'Mood']}
                />
                <Bar dataKey="importance" fill="#4F46E5" radius={[4, 4, 0, 0]} />
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

export default Analytics;
