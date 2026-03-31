
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, LogEntry, User, Goal, GoalCreateInput, Plan, PlanCreateInput, RewardBadge, RewardLedgerEntry, RewardProfile, ChatMessage, ChatMessageCreateInput } from './types';
import Logger from './components/Logger';
import History from './components/History';
import Analytics from './components/Analytics';
import Finance from './components/Finance';
import Auth from './components/Auth';
import PlanCenter from './components/PlanCenter';
import { Layout } from './components/Layout';
import InviteTools from './components/InviteTools';
import { storageService } from './services/storageService';
import { createChatMessage, deleteChatMessages, fetchChatMessages, syncLocalChatToCloud } from './services/chatService';
import { createGoal, deleteGoal, fetchGoals, pauseGoal, resumeGoal, setPrimaryGoal } from './services/goalService';
import { cancelPlan, completePlan, createPlan as createPlanItem, deletePlan as deletePlanItem, fetchPlans } from './services/planService';
import { fetchRewardBadges, fetchRewardLedger, fetchRewardProfile } from './services/rewardService';

const GUEST_STORAGE_USER = 'guest_user_v1';
const AUTH_TOKEN = 'lifepulse_token';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.LOGGER);
  const [isLoggerComposerOpen, setIsLoggerComposerOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newLogAdded, setNewLogAdded] = useState(false);
  const [dailyInsight, setDailyInsight] = useState<string>('');
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rewardProfile, setRewardProfile] = useState<RewardProfile | null>(null);
  const [rewardBadges, setRewardBadges] = useState<RewardBadge[]>([]);
  const [rewardLedger, setRewardLedger] = useState<RewardLedgerEntry[]>([]);
  const [isGoalMutating, setIsGoalMutating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [loggerSidebarOpenTick, setLoggerSidebarOpenTick] = useState(0);
  const lastAnalyzedFingerprint = React.useRef<string>('');

  // 初始化用户状态
  useEffect(() => {
    const savedUser = localStorage.getItem(GUEST_STORAGE_USER);
    // 这里未来可以增加一个 verify token 的请求
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const handleUnauthorized = () => {
      handleLogout();
      alert('登录已过期，请重新登录');
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  // Load logs on mount or user change
  useEffect(() => {
    if (!user) return;
    
    // Check for first-time guide
    const hasSeenGuide = localStorage.getItem('hasSeenGuide_v1');
    if (!hasSeenGuide && !user.isOfficial) {
      // Small delay to ensure layout is ready
      setTimeout(() => setShowGuide(true), 500);
    }

    const fetchAppData = async () => {
      try {
        const [logData, chatData, goalData, planData, rewardData, rewardBadgesData, rewardLedgerData] = await Promise.all([
          storageService.getLogs(),
          fetchChatMessages(),
          user.status === 'authenticated' ? fetchGoals() : Promise.resolve([]),
          user.status === 'authenticated' ? fetchPlans() : Promise.resolve([]),
          user.status === 'authenticated' ? fetchRewardProfile() : Promise.resolve(null),
          user.status === 'authenticated' ? fetchRewardBadges() : Promise.resolve([]),
          user.status === 'authenticated' ? fetchRewardLedger(20) : Promise.resolve([])
        ]);
        setLogs(logData);
        setChatMessages(chatData);
        setGoals(goalData);
        setPlans(planData);
        setRewardProfile(rewardData);
        setRewardBadges(rewardBadgesData);
        setRewardLedger(rewardLedgerData);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppData();
  }, [user]);

  const handleLogin = async (newUser: User, token?: string) => {
    setUser(newUser);
    localStorage.setItem(GUEST_STORAGE_USER, JSON.stringify(newUser));
    if (token) {
      localStorage.setItem(AUTH_TOKEN, token);
      // 登录后同步本地数据
      await Promise.all([storageService.syncLocalToCloud(), syncLocalChatToCloud()]);
      // 重新拉取最新的云端数据
      const [updatedLogs, updatedChatMessages, updatedGoals, updatedPlans, updatedRewardProfile, updatedRewardBadges, updatedRewardLedger] = await Promise.all([
        storageService.getLogs(),
        fetchChatMessages(),
        fetchGoals(),
        fetchPlans(),
        fetchRewardProfile(),
        fetchRewardBadges(),
        fetchRewardLedger(20)
      ]);
      setLogs(updatedLogs);
      setChatMessages(updatedChatMessages);
      setGoals(updatedGoals);
      setPlans(updatedPlans);
      setRewardProfile(updatedRewardProfile);
      setRewardBadges(updatedRewardBadges);
      setRewardLedger(updatedRewardLedger);
    }
  };

  const handleGuestMode = () => {
    const guestUser: User = {
      id: 'guest_local',
      name: '游客', // Simplified to '游客' to match translation key logic in Layout.tsx
      isOfficial: false,
      status: 'guest'
    };
    setUser(guestUser);
    localStorage.setItem(GUEST_STORAGE_USER, JSON.stringify(guestUser));
    setGoals([]);
    setPlans([]);
    setChatMessages([]);
    setRewardProfile(null);
    setRewardBadges([]);
    setRewardLedger([]);
  };

  const handleLogout = () => {
    setUser(null);
    setGoals([]);
    setPlans([]);
    setChatMessages([]);
    setRewardProfile(null);
    setRewardBadges([]);
    setRewardLedger([]);
    setIsLoggerComposerOpen(false);
    localStorage.removeItem(GUEST_STORAGE_USER);
    localStorage.removeItem(AUTH_TOKEN);
  };

  const handleViewChange = useCallback((nextView: ViewMode) => {
    setView(nextView);
    setIsLoggerComposerOpen(false);
  }, []);

  const handleOpenLoggerComposer = useCallback(() => {
    setView(ViewMode.LOGGER);
    setIsLoggerComposerOpen(true);
  }, []);

  const handleOpenLoggerSidebar = useCallback(() => {
    setView(ViewMode.LOGGER);
    setLoggerSidebarOpenTick((prev) => prev + 1);
  }, []);

  const handleCloseLoggerComposer = useCallback(() => {
    setIsLoggerComposerOpen(false);
  }, []);

  const refreshGoals = useCallback(async () => {
    if (!user || user.status !== 'authenticated') {
      setGoals([]);
      return;
    }

    try {
      const latestGoals = await fetchGoals();
      setGoals(latestGoals);
    } catch (error) {
      console.error('Goal refresh error:', error);
    }
  }, [user]);

  const refreshPlans = useCallback(async () => {
    if (!user || user.status !== 'authenticated') {
      setPlans([]);
      return;
    }

    try {
      const latestPlans = await fetchPlans();
      setPlans(latestPlans);
    } catch (error) {
      console.error('Plan refresh error:', error);
    }
  }, [user]);

  const handleCreateChatMessage = useCallback(async (messageInput: ChatMessageCreateInput) => {
    const nextMessage: ChatMessage = {
      id: messageInput.id || crypto.randomUUID(),
      userId: user?.id || 'guest_local',
      role: messageInput.role,
      content: messageInput.content,
      messageType: messageInput.messageType || 'text',
      timestamp: messageInput.timestamp || Date.now(),
      metadata: messageInput.metadata
    };

    setChatMessages((prev) => [...prev, nextMessage].sort((a, b) => a.timestamp - b.timestamp));

    try {
      const saved = await createChatMessage(nextMessage);
      setChatMessages((prev) => prev.map((message) => message.id === nextMessage.id ? saved : message));
    } catch (error) {
      console.error('Create chat message error:', error);
    }
  }, [user]);

  const handleDeleteChatMessages = useCallback(async (messageIds: string[]) => {
    setChatMessages((prev) => prev.filter((msg) => !messageIds.includes(msg.id)));
    await deleteChatMessages(messageIds);
  }, []);

  const refreshRewards = useCallback(async () => {
    if (!user || user.status !== 'authenticated') {
      setRewardProfile(null);
      setRewardBadges([]);
      setRewardLedger([]);
      return;
    }

    try {
      const [latestRewardProfile, latestRewardBadges, latestRewardLedger] = await Promise.all([
        fetchRewardProfile(),
        fetchRewardBadges(),
        fetchRewardLedger(20)
      ]);
      setRewardProfile(latestRewardProfile);
      setRewardBadges(latestRewardBadges);
      setRewardLedger(latestRewardLedger);
    } catch (error) {
      console.error('Reward refresh error:', error);
    }
  }, [user]);

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
    const savedEntry = await storageService.saveLog(entryWithUser);
    setLogs(prev => prev.map(log => log.id === entryWithUser.id ? { ...log, ...savedEntry } : log));

    if (user?.status === 'authenticated') {
      await Promise.all([refreshGoals(), refreshRewards()]);
    }

    setNewLogAdded(true);
    setTimeout(() => setNewLogAdded(false), 1000); // 1秒后重置
  }, [user, logs.length, refreshGoals, refreshRewards]);

  const deleteLog = useCallback(async (id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
    await storageService.deleteLog(id);
    if (user?.status === 'authenticated') {
      await Promise.all([refreshGoals(), refreshRewards()]);
    }
  }, [refreshGoals, refreshRewards, user]);

  const updateLog = useCallback(async (updatedLog: LogEntry) => {
    setLogs(prev => prev.map(log => log.id === updatedLog.id ? updatedLog : log));
    await storageService.updateLog(updatedLog);
  }, []);

  const handleCreateGoal = useCallback(async (goalInput: GoalCreateInput) => {
    if (!user || user.status !== 'authenticated') return;

    setIsGoalMutating(true);
    try {
      await createGoal(goalInput);
      await refreshGoals();
    } catch (error) {
      console.error('Create goal error:', error);
      throw error;
    } finally {
      setIsGoalMutating(false);
    }
  }, [refreshGoals, user]);

  const handleDeleteGoal = useCallback(async (goalId: string) => {
    if (!user || user.status !== 'authenticated') return;

    setIsGoalMutating(true);
    try {
      await deleteGoal(goalId);
      await refreshGoals();
    } catch (error) {
      console.error('Delete goal error:', error);
      throw error;
    } finally {
      setIsGoalMutating(false);
    }
  }, [refreshGoals, user]);

  const handlePauseGoal = useCallback(async (goalId: string) => {
    if (!user || user.status !== 'authenticated') return;

    setIsGoalMutating(true);
    try {
      await pauseGoal(goalId);
      await refreshGoals();
    } catch (error) {
      console.error('Pause goal error:', error);
      throw error;
    } finally {
      setIsGoalMutating(false);
    }
  }, [refreshGoals, user]);

  const handleResumeGoal = useCallback(async (goalId: string) => {
    if (!user || user.status !== 'authenticated') return;

    setIsGoalMutating(true);
    try {
      await resumeGoal(goalId);
      await refreshGoals();
    } catch (error) {
      console.error('Resume goal error:', error);
      throw error;
    } finally {
      setIsGoalMutating(false);
    }
  }, [refreshGoals, user]);

  const handleSetPrimaryGoal = useCallback(async (goalId: string) => {
    if (!user || user.status !== 'authenticated') return;

    setIsGoalMutating(true);
    try {
      await setPrimaryGoal(goalId);
      await refreshGoals();
    } catch (error) {
      console.error('Set primary goal error:', error);
      throw error;
    } finally {
      setIsGoalMutating(false);
    }
  }, [refreshGoals, user]);

  const handleCreatePlan = useCallback(async (planInput: PlanCreateInput) => {
    if (!user || user.status !== 'authenticated') return;

    try {
      const createdPlan = await createPlanItem(planInput);
      await refreshPlans();
      return createdPlan;
    } catch (error) {
      console.error('Create plan error:', error);
      throw error;
    }
  }, [refreshPlans, user]);

  const handleDeletePlan = useCallback(async (planId: string) => {
    if (!user || user.status !== 'authenticated') return;

    setPlans((prev) => prev.filter((plan) => plan.id !== planId));

    try {
      await deletePlanItem(planId);
      await refreshPlans();
    } catch (error) {
      console.error('Delete plan error:', error);
      throw error;
    }
  }, [refreshPlans, user]);

  const handleCompletePlan = useCallback(async (planId: string) => {
    if (!user || user.status !== 'authenticated') return;

    try {
      await completePlan(planId);
      await refreshPlans();
    } catch (error) {
      console.error('Complete plan error:', error);
      throw error;
    }
  }, [refreshPlans, user]);

  const handleCancelPlan = useCallback(async (planId: string) => {
    if (!user || user.status !== 'authenticated') return;

    try {
      await cancelPlan(planId);
      await refreshPlans();
    } catch (error) {
      console.error('Cancel plan error:', error);
      throw error;
    }
  }, [refreshPlans, user]);

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
      onViewChange={handleViewChange} 
      onOpenLoggerComposer={handleOpenLoggerComposer}
      onOpenLoggerSidebar={handleOpenLoggerSidebar}
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
          chatMessages={chatMessages}
          goals={goals}
          rewardProfile={rewardProfile}
          sidebarOpenRequestKey={loggerSidebarOpenTick}
          isComposerOpen={isLoggerComposerOpen}
          isGoalActionLoading={isGoalMutating}
          onOpenComposer={handleOpenLoggerComposer}
          onCloseComposer={handleCloseLoggerComposer}
          onCreateGoal={handleCreateGoal}
          onCreateChatMessage={handleCreateChatMessage}
          onDeleteChatMessages={handleDeleteChatMessages}
          onCreatePlan={handleCreatePlan}
          onDeleteLog={deleteLog}
          onDeletePlan={handleDeletePlan}
          onPauseGoal={handlePauseGoal}
          onResumeGoal={handleResumeGoal}
          onSetPrimaryGoal={handleSetPrimaryGoal}
          onDeleteGoal={handleDeleteGoal}
        />
      )}
      {view === ViewMode.TIMELINE && (
        <History logs={logs} goals={goals} onDelete={deleteLog} onUpdate={updateLog} />
      )}
      {view === ViewMode.PLAN && (
        <PlanCenter
          plans={plans}
          isGuest={user.status === 'guest'}
          onOpenLoggerComposer={handleOpenLoggerComposer}
          onCompletePlan={handleCompletePlan}
          onCancelPlan={handleCancelPlan}
        />
      )}
      {view === ViewMode.FINANCE && (
        <Finance userId={user.id} onOpenLoggerComposer={handleOpenLoggerComposer} />
      )}
      {view === ViewMode.ANALYTICS && (
        <Analytics 
          logs={logs} 
          goals={goals}
          rewardProfile={rewardProfile}
          rewardBadges={rewardBadges}
          rewardLedger={rewardLedger}
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
