
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, LogEntry } from './types';
import Logger from './components/Logger';
import History from './components/History';
import Analytics from './components/Analytics';
import { Layout } from './components/Layout';

const STORAGE_KEY = 'lifepulse_logs_v1';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.LOGGER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLogAdded, setNewLogAdded] = useState(false);

  // Load logs on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setLogs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load logs");
      }
    }
    setIsLoading(false);
  }, []);

  // Save logs on change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  }, [logs, isLoading]);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [entry, ...prev]);
    setNewLogAdded(true);
    setTimeout(() => setNewLogAdded(false), 1000); // 1秒后重置
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
  }, []);

  return (
    <Layout currentView={view} onViewChange={setView} newLogAdded={newLogAdded}>
      {view === ViewMode.LOGGER && (
        <Logger onAddLog={addLog} />
      )}
      {view === ViewMode.TIMELINE && (
        <History logs={logs} onDelete={deleteLog} />
      )}
      {view === ViewMode.ANALYTICS && (
        <Analytics logs={logs} />
      )}
    </Layout>
  );
};

export default App;
