
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, LogEntry, User, AuthStatus } from './types';
import Logger from './components/Logger';
import History from './components/History';
import Analytics from './components/Analytics';
import Finance from './components/Finance';
import Auth from './components/Auth';
import { Layout } from './components/Layout';
import InviteTools from './components/InviteTools';
import { storageService } from './services/storageService';

const GUEST_STORAGE_USER = 'guest_user_v1';
const AUTH_TOKEN = 'lifepulse_token';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.LOGGER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newLogAdded, setNewLogAdded] = useState(false);
  const [dailyInsight, setDailyInsight] = useState<string>('');
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const lastAnalyzedFingerprint = React.useRef<string>('');

  // 初始化用户状态
  useEffect(() => {
    const savedUser = localStorage.getItem(GUEST_STORAGE_USER);
    const token = localStorage.getItem(AUTH_TOKEN);
    // 这里未来可以增加一个 verify token 的请求
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load logs on mount or user change
  useEffect(() => {
    if (!user) return;
    
    // Check for first-time guide
    const hasSeenGuide = localStorage.getItem('hasSeenGuide_v1');
    if (!hasSeenGuide) {
      // Small delay to ensure layout is ready
      setTimeout(() => setShowGuide(true), 500);
    }

    const fetchLogs = async () => {
      const data = await storageService.getLogs();
      setLogs(data);
      setIsLoading(false);
    };
    fetchLogs();
  }, [user]);

  const handleLogin = async (newUser: User, token?: string) => {
    setUser(newUser);
    localStorage.setItem(GUEST_STORAGE_USER, JSON.stringify(newUser));
    if (token) {
      localStorage.setItem(AUTH_TOKEN, token);
      // 登录后同步本地数据
      await storageService.syncLocalToCloud();
      // 重新拉取最新的云端数据
      const updatedLogs = await storageService.getLogs();
      setLogs(updatedLogs);
    }
  };

  const handleGuestMode = () => {
    const guestUser: User = {
      id: 'guest_local',
      name: '游客', // Simplified to '游客' to match translation key logic in Layout.tsx
      status: 'guest'
    };
    setUser(guestUser);
    localStorage.setItem(GUEST_STORAGE_USER, JSON.stringify(guestUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(GUEST_STORAGE_USER);
    localStorage.removeItem(AUTH_TOKEN);
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem('hasSeenGuide_v1', 'true');
  };

  const addLog = useCallback(async (entry: LogEntry) => {
    // 游客模式限制：3条
    if (user?.status === 'guest' && logs.length >= 3) {
      // 这里的逻辑主要在 Logger.tsx 中拦截并弹窗了
      // 但为了防御性编程，这里也保留限制
      return;
    }

    const entryWithUser = { ...entry, userId: user?.id || 'guest_local' };
    setLogs(prev => [entryWithUser, ...prev]);
    await storageService.saveLog(entryWithUser);
    setNewLogAdded(true);
    setTimeout(() => setNewLogAdded(false), 1000); // 1秒后重置
  }, [user, logs.length]);

  const deleteLog = useCallback(async (id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
    await storageService.deleteLog(id);
  }, []);

  const updateLog = useCallback(async (updatedLog: LogEntry) => {
    setLogs(prev => prev.map(log => log.id === updatedLog.id ? updatedLog : log));
    await storageService.updateLog(updatedLog);
  }, []);

  // 统一生成 AI 洞察的逻辑，防止重复请求
  const generateInsight = useCallback(async (currentLogs: LogEntry[]) => {
    if (!user || user.status === 'guest' || currentLogs.length === 0) return;

    const fingerprint = `${currentLogs.length}-${currentLogs[0]?.id}-${currentLogs[0]?.timestamp}`;
    if (fingerprint === lastAnalyzedFingerprint.current) return;

    lastAnalyzedFingerprint.current = fingerprint;
    setIsGeneratingInsight(true);
    try {
      const { getDailyInsight } = await import('./services/qwenService');
      const res = await getDailyInsight(currentLogs);
      setDailyInsight(res);
    } catch (e) {
      console.error("AI Insight Error:", e);
      setDailyInsight("暂时无法生成洞察，请稍后再试。");
      // 出错时清除指纹，允许刷新重试
      lastAnalyzedFingerprint.current = '';
    } finally {
      setIsGeneratingInsight(false);
    }
  }, [user]);

  // 当切换到分析视图且日志有变化时才触发
  useEffect(() => {
    if (view === ViewMode.ANALYTICS) {
      // 筛选出今天的日志进行分析
      const today = new Date().setHours(0, 0, 0, 0);
      const todayLogs = logs.filter(log => new Date(log.timestamp).setHours(0, 0, 0, 0) === today);
      generateInsight(todayLogs);
    }
  }, [view, logs, generateInsight]);

  if (!user) {
    return <Auth onLogin={handleLogin} onContinueAsGuest={handleGuestMode} />;
  }

  return (
    <Layout 
      currentView={view} 
      onViewChange={setView} 
      newLogAdded={newLogAdded}
      userName={user.name}
      onLogout={handleLogout}
      showGuide={showGuide}
      onCloseGuide={handleCloseGuide}
      onShowInvite={() => setShowInvite(true)}
    >
      {view === ViewMode.LOGGER && (
        <Logger 
          onAddLog={addLog} 
          onLogout={handleLogout}
          userId={user.id} 
          isGuest={user.status === 'guest'}
          logs={logs}
        />
      )}
      {view === ViewMode.TIMELINE && (
        <History logs={logs} onDelete={deleteLog} onUpdate={updateLog} />
      )}
      {view === ViewMode.FINANCE && (
        <Finance userId={user.id} />
      )}
      {view === ViewMode.ANALYTICS && (
        <Analytics 
          logs={logs} 
          isGuest={user.status === 'guest'} 
          insight={dailyInsight}
          isGenerating={isGeneratingInsight}
          onLoginClick={handleLogout}
        />
      )}
      {showInvite && user && (
        <InviteTools user={user} onClose={() => setShowInvite(false)} />
      )}
    </Layout>
  );
};

export default App;
