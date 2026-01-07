
import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { createPortal } from 'react-dom';

interface HistoryProps {
  logs: LogEntry[];
  onDelete: (id: string) => void;
}

const CATEGORY_MAP: Record<string, string> = {
  'Work': '工作',
  'Leisure': '休闲',
  'Health': '健康',
  'Social': '社交',
  'Chores': '琐事',
  'Other': '其他'
};


const getDateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Reset time part for accurate date comparison
  const d = new Date(date).setHours(0,0,0,0);
  const t = new Date(now).setHours(0,0,0,0);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = y.setHours(0,0,0,0);

  if (d === t) return '今天';
  if (d === yesterday) return '昨天';
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
};

const History: React.FC<HistoryProps> = ({ logs, onDelete }) => {
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [logToDelete, setLogToDelete] = useState<LogEntry | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </div>
        <p className="text-slate-500 font-medium text-lg">暂无记录</p>
        <p className="text-slate-400 text-sm mt-2">点击底部的 + 号开始第一笔记录</p>
      </div>
    );
  }

  const handleDeleteConfirm = () => {
    if (logToDelete) {
      onDelete(logToDelete.id);
      setLogToDelete(null);
      setSwipedId(null);
    }
  };

  return (
    <div className="space-y-4 pb-10 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">最近记录</h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{logs.length} 条</span>
      </div>
      
      <div className="space-y-1">
        {logs.map((log, index) => {
          const dateLabel = getDateLabel(log.timestamp);
          const prevLog = logs[index - 1];
          // 如果是第一条，或者当前日期与上一条不同，则显示日期头
          const showHeader = index === 0 || dateLabel !== getDateLabel(prevLog.timestamp);

          return (
            <React.Fragment key={log.id}>
              {showHeader && (
                <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-3 px-1 mt-4 mb-2 flex items-center gap-2">
                  <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                  <span className="text-sm font-bold text-slate-700">{dateLabel}</span>
                  <div className="h-px flex-1 bg-slate-200 ml-2"></div>
                </div>
              )}
              <div className="mb-3">
                <HistoryItem 
                  log={log} 
                  isSwiped={swipedId === log.id}
                  onSwipe={(id) => setSwipedId(id)}
                  onDelete={() => setLogToDelete(log)}
                  onDoubleClick={() => setSelectedLog(log)}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {logs.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">双击卡片查看详情，向左滑动删除</p>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <Modal onClose={() => setSelectedLog(null)} title="记录详情">
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-sm text-slate-400 mb-1">原始输入</p>
              <p className="text-slate-800 font-medium italic">"{selectedLog.rawText}"</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="活动" value={selectedLog.activity} />
              <DetailItem label="分类" value={CATEGORY_MAP[selectedLog.category] || selectedLog.category} />
              <DetailItem label="时长" value={`${selectedLog.durationMinutes} 分钟`} />
              <DetailItem label="心情" value={selectedLog.mood} />
              <DetailItem label="重要程度" value={'★'.repeat(selectedLog.importance) + '☆'.repeat(5 - selectedLog.importance)} className="text-amber-400" />
              <DetailItem label="记录时间" value={new Date(selectedLog.timestamp).toLocaleString('zh-CN')} />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {logToDelete && (
        <Modal onClose={() => setLogToDelete(null)} title="确认删除">
          <p className="text-slate-600 mb-6">确定要删除这条"{logToDelete.activity}"记录吗？此操作无法撤销。</p>
          <div className="flex gap-3">
            <button 
              onClick={() => setLogToDelete(null)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleDeleteConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all"
            >
              删除
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const HistoryItem: React.FC<{
  log: LogEntry;
  isSwiped: boolean;
  onSwipe: (id: string | null) => void;
  onDelete: () => void;
  onDoubleClick: () => void;
}> = ({ log, isSwiped, onSwipe, onDelete, onDoubleClick }) => {
  const [offsetX, setOffsetX] = useState(0);
  const touchStart = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSwiped) {
      setOffsetX(0);
    }
  }, [isSwiped]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart.current;

    // 只允许左滑，且最大滑动距离为 80px
    if (diff < 0) {
      setOffsetX(Math.max(diff, -100));
      // 阻止默认事件防止页面滚动（简单处理）
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStart.current === null) return;
     // 如果滑动超过 40px，则展开
    if (offsetX < -40) {
      setOffsetX(-80);
      onSwipe(log.id);
    } else {
      setOffsetX(0);
      onSwipe(null);
    }
    touchStart.current = null;
  };

  return (
    <div className="relative h-[100px] select-none">
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 w-[80px] bg-red-500 rounded-2xl flex items-center justify-center p-2 z-0">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-full h-full flex flex-col items-center justify-center text-white"
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="text-[10px] font-bold">删除</span>
        </button>
      </div>

      {/* Foreground Content */}
      <div 
        ref={itemRef}
        className="absolute inset-0 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-transform duration-300 ease-out z-10 flex flex-col justify-between"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={onDoubleClick}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getCategoryColor(log.category)}`}>
              {CATEGORY_MAP[log.category] || log.category}
              </span>
               <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${log.mood === '积极' || log.mood === '开心' ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
                 {log.mood}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 line-clamp-1 text-sm">{log.activity}</h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
           <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" /></svg>
              <span>{log.durationMinutes} min</span>
           </div>
           
           <div className="flex items-center gap-0.5 ml-auto">
             {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`w-3 h-3 ${i < log.importance ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

const Modal: React.FC<{ onClose: () => void; children: React.ReactNode; title: string }> = ({ onClose, children, title }) => {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-6 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

const DetailItem: React.FC<{ label: string; value: string | React.ReactNode; className?: string }> = ({ label, value, className = 'text-slate-700' }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <div className={`font-semibold text-sm ${className}`}>{value}</div>
  </div>
);

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case 'Work': return 'bg-indigo-100 text-indigo-600';
    case 'Leisure': return 'bg-emerald-100 text-emerald-600';
    case 'Health': return 'bg-rose-100 text-rose-600';
    case 'Social': return 'bg-purple-100 text-purple-600';
    case 'Chores': return 'bg-amber-100 text-amber-600';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export default History;

