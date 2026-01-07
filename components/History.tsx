
import React from 'react';
import { LogEntry } from '../types';

interface HistoryProps {
  logs: LogEntry[];
  onDelete: (id: string) => void;
}

const History: React.FC<HistoryProps> = ({ logs, onDelete }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-slate-500 font-medium">No logs yet. Start capturing your day!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-lg font-bold text-slate-700 mb-2">Recent Timeline</h2>
      {logs.map((log) => (
        <div 
          key={log.id} 
          className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
        >
          {/* Category Pill */}
          <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getCategoryColor(log.category)}`}>
              {log.category}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <h3 className="font-semibold text-slate-800">{log.activity}</h3>
          
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" /></svg>
              {log.durationMinutes}m
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {log.mood}
            </span>
          </div>

          {/* Delete Button (Visible on hover) */}
          <button 
            onClick={() => onDelete(log.id)}
            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
};

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case 'Work': return 'bg-blue-100 text-blue-600';
    case 'Leisure': return 'bg-green-100 text-green-600';
    case 'Health': return 'bg-red-100 text-red-600';
    case 'Social': return 'bg-purple-100 text-purple-600';
    case 'Chores': return 'bg-orange-100 text-orange-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export default History;
