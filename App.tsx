
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, LogEntry } from './types';
import Logger from './components/Logger';
import History from './components/History';
import Analytics from './components/Analytics';
import { Layout } from './components/Layout';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.LOGGER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLogAdded, setNewLogAdded] = useState(false);

  // Load logs on mount
  useEffect(() => {
    const fetchLogs = async () => {
      const data = await storageService.getLogs();
      setLogs(data);
      setIsLoading(false);
    };
    fetchLogs();
  }, []);

  const addLog = useCallback(async (entry: LogEntry) => {
    setLogs(prev => [entry, ...prev]);
    await storageService.saveLog(entry);
    setNewLogAdded(true);
    setTimeout(() => setNewLogAdded(false), 1000); // 1秒后重置
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id));
    await storageService.deleteLog(id);
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
