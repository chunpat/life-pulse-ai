
import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { createPortal } from 'react-dom';

interface HistoryProps {
  logs: LogEntry[];
  onDelete: (id: string) => void;
  onUpdate: (updatedLog: LogEntry) => void;
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

const History: React.FC<HistoryProps> = ({ logs, onDelete, onUpdate }) => {
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [logToDelete, setLogToDelete] = useState<LogEntry | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<LogEntry | null>(null);

  // 筛选状态
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD

  // 导出数据格式化
  const getExportData = () => {
    return logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      datetime: new Date(log.timestamp).toLocaleString(),
      category: CATEGORY_MAP[log.category] || log.category,
      categoryKey: log.category,
      activity: log.activity,
      durationMinutes: log.durationMinutes,
      originalText: log.rawText,
      mood: log.mood || '无',
      importance: log.importance || 3
    }));
  };

  // 导出 JSON
  const exportToJSON = () => {
    const formattedData = getExportData();
    const dataStr = JSON.stringify(formattedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `life-pulse-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // 导出 CSV
  const exportToCSV = () => {
    const data = getExportData();
    const headers = ['ID', '日期时间', '分类', '活动', '时长(分)', '原始输入', '心情', '重要度'];
    const csvRows = data.map(item => [
      item.id,
      item.datetime,
      item.category,
      `"${item.activity.replace(/"/g, '""')}"`,
      item.durationMinutes,
      `"${item.originalText.replace(/"/g, '""')}"`,
      item.mood,
      item.importance
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `life-pulse-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 执行筛选逻辑
  const filteredLogs = logs.filter(log => {
    // 文本搜索 (匹配活动名称或原始文本)
    const matchesSearch = searchTerm === '' || 
      log.activity.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.rawText.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 分类筛选
    const matchesCategory = filterCategory === 'All' || log.category === filterCategory;
    
    // 日期筛选
    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
    const matchesDate = filterDate === '' || logDate === filterDate;

    return matchesSearch && matchesCategory && matchesDate;
  });

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

  const startEditing = () => {
    setEditForm(selectedLog);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onUpdate(editForm);
      setSelectedLog(editForm);
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-4 pb-10 overflow-hidden">
      {/* 筛选与操作区域 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-700">筛选与导出</span>
            {(searchTerm || filterCategory !== 'All' || filterDate) && (
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </div>
          <svg 
            className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFilters && (
          <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
            {/* 搜索框 */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜索活动或关键词..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>

            {/* 分类和日期筛选 */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="All">全部类别</option>
                  {Object.entries(CATEGORY_MAP).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <svg className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>

              <div className="flex-1 relative">
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* 导出按钮 */}
            <div className="flex gap-2 pt-2 border-t border-slate-50">
              <button 
                onClick={exportToCSV}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 text-slate-600 text-[11px] font-bold hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV 导出
              </button>
              <button 
                onClick={exportToJSON}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 text-slate-600 text-[11px] font-bold hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                JSON 备份
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {filteredLogs.length < logs.length ? '筛选结果' : '最近记录'}
        </h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{filteredLogs.length} 条</span>
      </div>
      
      <div className="space-y-1">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, index) => {
            const dateLabel = getDateLabel(log.timestamp);
            const prevLog = filteredLogs[index - 1];
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
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">没有找到匹配的记录</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterCategory('All');
                setFilterDate('');
              }}
              className="mt-3 text-indigo-600 text-xs font-bold hover:underline"
            >
              清除所有筛选
            </button>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">双击卡片查看详情，向左滑动删除</p>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <Modal 
          onClose={() => {
            setSelectedLog(null);
            setIsEditing(false);
          }} 
          title={isEditing ? "编辑记录" : "记录详情"}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
            {isEditing ? (
              // EDIT MODE
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">原始输入 (仅查看)</label>
                  <p className="text-slate-500 text-xs italic">"{editForm?.rawText}"</p>
                </div>

                <div className="space-y-3">
                   <EditInput 
                    label="活动内容" 
                    value={editForm?.activity || ''} 
                    onChange={v => setEditForm(prev => prev ? {...prev, activity: v} : null)} 
                   />
                   
                   <div className="grid grid-cols-2 gap-3">
                      <EditSelect 
                        label="分类" 
                        value={editForm?.category || 'Other'} 
                        options={Object.keys(CATEGORY_MAP)}
                        labels={CATEGORY_MAP}
                        onChange={v => setEditForm(prev => prev ? {...prev, category: v as any} : null)}
                      />
                      <EditInput 
                        label="时长 (分钟)" 
                        type="number"
                        value={editForm?.durationMinutes?.toString() || '0'} 
                        onChange={v => setEditForm(prev => prev ? {...prev, durationMinutes: parseInt(v) || 0} : null)} 
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <EditInput 
                        label="心情状态" 
                        value={editForm?.mood || ''} 
                        onChange={v => setEditForm(prev => prev ? {...prev, mood: v} : null)} 
                      />
                      <EditSelect 
                        label="重要度" 
                        value={editForm?.importance?.toString() || '3'} 
                        options={['1', '2', '3', '4', '5']}
                        onChange={v => setEditForm(prev => prev ? {...prev, importance: parseInt(v) as any} : null)}
                      />
                   </div>
                </div>

                <div className="flex gap-3 pt-2">
                   <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium"
                   >取消</button>
                   <button 
                    onClick={handleSaveEdit}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100"
                   >保存修改</button>
                </div>
              </div>
            ) : (
              // VIEW MODE
              <>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-400 mb-1">原始输入</p>
                  <p className="text-slate-800 font-medium italic">"{selectedLog.rawText}"</p>
                </div>

                {selectedLog.images && selectedLog.images.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-400 mb-2">附件照片</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                      {selectedLog.images.map((url, idx) => (
                        <div key={idx} className="flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-slate-100 snap-start">
                          <img src={url} alt="Log attachment" className="w-full h-full object-cover" onClick={() => window.open(url, '_blank')} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <DetailItem label="活动" value={selectedLog.activity} />
                  <DetailItem label="分类" value={CATEGORY_MAP[selectedLog.category] || selectedLog.category} />
                  <DetailItem label="时长" value={`${selectedLog.durationMinutes} 分钟`} />
                  <DetailItem label="心情" value={selectedLog.mood} />
                  <DetailItem 
                    label="地理位置" 
                    value={selectedLog.location?.name || '未知'} 
                    className={selectedLog.location ? 'text-emerald-600 font-medium' : ''}
                  />
                  <DetailItem label="重要程度" value={'★'.repeat(selectedLog.importance) + '☆'.repeat(5 - selectedLog.importance)} className="text-amber-400" />
                  <DetailItem label="记录时间" value={new Date(selectedLog.timestamp).toLocaleString('zh-CN')} />
                </div>

                <button 
                  onClick={startEditing}
                  className="w-full mt-4 bg-slate-900 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  修改此条记录
                </button>
              </>
            )}
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
    <div className="relative min-h-[100px] select-none">
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
        className="relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-transform duration-300 ease-out z-10 flex flex-col justify-between"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={onDoubleClick}
        onClick={() => offsetX !== 0 && setOffsetX(0)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
               <span className={`flex-none text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getCategoryColor(log.category)}`}>
              {CATEGORY_MAP[log.category] || log.category}
              </span>
               <span className={`flex-none text-[10px] font-medium px-1.5 py-0.5 rounded-md ${log.mood === '积极' || log.mood === '开心' ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
                 {log.mood}
              </span>
              {log.location && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium truncate min-w-0">
                  <svg className="w-3 h-3 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  <span className="truncate">{log.location.name}</span>
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 line-clamp-2 text-sm leading-snug">{log.activity}</h3>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] font-semibold text-slate-400">
              {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {log.images && log.images.length > 0 && (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shadow-sm relative">
                <img src={log.images[0]} alt="Log" className="w-full h-full object-cover" />
                {log.images.length > 1 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white font-bold">
                    +{log.images.length - 1}
                  </div>
                )}
              </div>
            )}
          </div>
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

const EditInput: React.FC<{ label: string; value: string; onChange: (v: string) => void, type?: string }> = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block pl-1">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
    />
  </div>
);

const EditSelect: React.FC<{ label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }> = ({ label, value, options, labels, onChange }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block pl-1">{label}</label>
    <select 
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{labels ? labels[opt] : opt}</option>
      ))}
    </select>
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

