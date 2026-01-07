
import React from 'react';
import { ViewMode } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto bg-white shadow-xl relative overflow-hidden">
      {/* Header */}
      <header className="p-6 pt-10">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">LifePulse <span className="text-indigo-600">AI</span></h1>
        <p className="text-slate-500 text-sm mt-1">Capture your life, discover your patterns.</p>
      </header>

      {/* Main Content */}
      <main className="px-6">
        {children}
      </main>

      {/* Sticky Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg glass border-t border-slate-200 px-6 py-4 flex justify-between items-center z-50">
        <NavButton 
          active={currentView === ViewMode.TIMELINE} 
          onClick={() => onViewChange(ViewMode.TIMELINE)}
          // Removed invalid 'icon' prop that was causing a TypeScript error. The icon is passed as children.
          label="History"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </NavButton>

        <button 
          onClick={() => onViewChange(ViewMode.LOGGER)}
          className={`-mt-12 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
            currentView === ViewMode.LOGGER ? 'bg-indigo-600 scale-110' : 'bg-slate-800'
          } text-white`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </button>

        <NavButton 
          active={currentView === ViewMode.ANALYTICS} 
          onClick={() => onViewChange(ViewMode.ANALYTICS)}
          label="Analytics"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </NavButton>
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; label: string }> = ({ active, onClick, children, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}
  >
    {children}
    <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
  </button>
);
