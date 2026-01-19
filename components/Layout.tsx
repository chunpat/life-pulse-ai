
import React from 'react';
import { ViewMode } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  newLogAdded?: boolean;
  userName?: string;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onViewChange, 
  newLogAdded = false,
  userName = '游客',
  onLogout
}) => {
  return (
    // Outer Container - Desktop centered, Mobile full
    <div className="fixed inset-0 sm:flex sm:items-center sm:justify-center bg-slate-100">
      
      {/* App Shell */}
      <div className="w-full h-full sm:h-[850px] sm:max-w-[400px] bg-slate-50 sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-900 overflow-hidden flex flex-col relative">
        
        {/* Dynamic Header */}
        <header className="px-6 py-6 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tighter">
                LifePulse <span className="text-indigo-500">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">
                你好, {userName}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onViewChange(ViewMode.FINANCE)}
                className={`p-2 rounded-full transition-colors ${currentView === ViewMode.FINANCE ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                title="财务账本"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </button>

              <button 
                onClick={onLogout}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                title="退出登录"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50 pb-28">
           <div className="px-4 py-4 min-h-full">
            {children}
           </div>
        </main>

        {/* Floating Bottom Navigation */}
        <nav className="absolute bottom-6 left-4 right-4 h-16 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 flex items-center justify-between px-6 z-30">
          
          {/* Recent/Timeline */}
          <NavButton
            active={currentView === ViewMode.TIMELINE}
            onClick={() => onViewChange(ViewMode.TIMELINE)}
            label="回顾"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </NavButton>

          {/* ADD BUTTON (Floating outside) */}
          <div className="relative -top-8">
            <button
              onClick={() => onViewChange(ViewMode.LOGGER)}
              className={`
                w-14 h-14 rounded-full flex items-center justify-center 
                shadow-xl shadow-indigo-500/30 border-4 border-slate-50 
                transition-all duration-300 ease-out transform
                ${currentView === ViewMode.LOGGER 
                  ? 'bg-indigo-600 scale-110 rotate-90 text-white' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white hover:-translate-y-1'}
              `}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            </button>
            
            {/* Success Indicator Pulse */}
            {newLogAdded && (
               <>
                <span className="absolute -top-2 -right-2 flex h-6 w-6">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-6 w-6 bg-green-500 items-center justify-center text-[10px] text-white font-bold">✓</span>
                </span>
               </>
            )}
          </div>

          {/* Analytics */}
          <NavButton
            active={currentView === ViewMode.ANALYTICS}
            onClick={() => onViewChange(ViewMode.ANALYTICS)}
            label="分析"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </NavButton>

        </nav>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; label: string }> = ({ active, onClick, children, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300 ${
      active ? 'text-indigo-600 bg-indigo-50/50 scale-105' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {children}
    {/* Label is hidden on very small screens if needed, but useful here */}
    <span className={`text-[10px] font-bold tracking-wide transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

