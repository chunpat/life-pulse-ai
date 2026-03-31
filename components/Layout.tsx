
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewMode } from '../types';
import OnboardingGuide from './OnboardingGuide';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenLoggerComposer: () => void;
  onOpenLoggerSidebar?: () => void;
  newLogAdded?: boolean;
  userName?: string;
  onLogout?: () => void;
  showGuide?: boolean;
  onCloseGuide?: () => void;
  onShowInvite?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onViewChange, 
  onOpenLoggerComposer,
  onOpenLoggerSidebar,
  newLogAdded = false,
  userName = '游客',
  onLogout,
  showGuide = false,
  onCloseGuide = () => {},
  onShowInvite
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const displayUserName = userName === '游客' ? t('common.guest_user') : userName;
  const isLoggerView = currentView === ViewMode.LOGGER;

  return (
    // Outer Container - Desktop centered, Mobile full
    <div className={`fixed inset-0 sm:flex sm:items-center sm:justify-center ${isLoggerView ? 'bg-[#f6f1e8]' : 'bg-slate-100'}`}>
      
      {/* App Shell */}
      <div className={`w-full h-full sm:h-[850px] sm:max-w-[400px] overflow-hidden flex flex-col relative transform-gpu ${isLoggerView ? 'bg-[radial-gradient(circle_at_top,#fff7e8_0%,#fffdf9_38%,#f8fafc_100%)] sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-900' : 'bg-slate-50 sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-900'}`}>
        
        {/* Onboarding Guide Overlay */}
        {showGuide && <OnboardingGuide onGenericClose={onCloseGuide} />}

        {/* Dynamic Header */}
        <header className={`sticky top-0 z-20 ${isLoggerView ? 'border-b-0 bg-transparent px-4 py-4' : 'border-b border-slate-100 bg-white/80 px-6 py-6 backdrop-blur-md'}`}>
          <div className="flex items-center justify-between">
            {isLoggerView ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenLoggerSidebar}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  title={t('logger.sidebar_menu_title')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h16M4 17h10" /></svg>
                </button>
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm backdrop-blur-md ring-1 ring-amber-100">
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
                  <div>
                    <h1 className="text-sm font-black tracking-tight text-slate-900">
                      {t('app.title')} <span className="text-amber-600">AI</span>
                    </h1>
                    <p className="text-[10px] font-bold tracking-wide text-slate-500">
                      {displayUserName}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tighter">
                  {t('app.title')} <span className="text-amber-600">AI</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">
                  {t('common.hello')}, {displayUserName}
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <button 
                id="nav-finance"
                onClick={() => {
                  onViewChange(ViewMode.FINANCE);
                  setIsMenuOpen(false);
                }}
                className={`p-2 rounded-full transition-colors ${isLoggerView ? (currentView === ViewMode.FINANCE ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50') : (currentView === ViewMode.FINANCE ? 'bg-amber-100 text-amber-700' : 'hover:bg-slate-100 text-slate-400')}`}
                title={t('nav.finance')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </button>

              {isLoggerView && (
                <button
                  onClick={() => onViewChange(ViewMode.PLAN)}
                  className={`p-2 rounded-full transition-colors ${currentView === ViewMode.PLAN ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50'}`}
                  title={t('nav.plan')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
                </button>
              )}

              <div className="relative">
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-2 rounded-full transition-colors ${isLoggerView ? (isMenuOpen ? 'bg-amber-500 text-white' : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50') : (isMenuOpen ? 'bg-amber-50 text-amber-700' : 'hover:bg-slate-100 text-slate-400')}`}
                  title={t('nav.profile_menu')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-0 top-12 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-2 border-b border-slate-50 text-xs text-slate-400 font-bold">
                        {displayUserName}
                      </div>

                      {/* Language Switcher */}
                      <div className="px-4 py-2 border-b border-slate-50 flex gap-2 justify-center">
                        <button 
                          onClick={() => i18n.changeLanguage('zh')}
                          className={`flex-1 text-xs py-1 rounded ${i18n.language.startsWith('zh') ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                          中文
                        </button>
                        <button 
                          onClick={() => i18n.changeLanguage('en')}
                          className={`flex-1 text-xs py-1 rounded ${i18n.language.startsWith('en') ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                          EN
                        </button>
                      </div>

                      {onShowInvite && (
                        <button 
                          onClick={() => {
                            setIsMenuOpen(false);
                            onShowInvite();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 font-bold transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                          {t('invite.menu_btn', 'Invite Friends')}
                        </button>
                      )}

                      <button 
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 font-bold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
          <main className={`flex-1 overflow-y-auto scrollbar-hide ${isLoggerView ? 'bg-transparent pb-0' : 'bg-slate-50 pb-28'}`}>
            <div className={`${isLoggerView ? 'h-full min-h-full px-0 pt-0 pb-0' : 'px-4 py-4 min-h-full'}`}>
            {children}
           </div>
        </main>

        {/* Floating Bottom Navigation */}
          {!isLoggerView && (
          <nav className="absolute bottom-6 left-4 right-4 h-16 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 flex items-center justify-between px-6 z-30">
          
          {/* Recent/Timeline */}
          <NavButton
            id="nav-history"
            active={currentView === ViewMode.TIMELINE}
            onClick={() => onViewChange(ViewMode.TIMELINE)}
            label={t('nav.timeline')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </NavButton>

          <NavButton
            id="nav-plan"
            active={currentView === ViewMode.PLAN}
            onClick={() => onViewChange(ViewMode.PLAN)}
            label={t('nav.plan')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
          </NavButton>

          {/* ADD BUTTON (Floating outside) */}
          <div className="relative -top-8">
            <button
              id="nav-logger"
              onClick={onOpenLoggerComposer}
              title={t('nav.logger')}
              className={`
                w-14 h-14 rounded-full flex items-center justify-center 
                shadow-xl shadow-amber-300/40 border-4 border-slate-50 
                transition-all duration-300 ease-out transform
                ${currentView === ViewMode.LOGGER 
                  ? 'bg-amber-500 scale-110 rotate-90 text-slate-950' 
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
            id="nav-analytics"
            active={currentView === ViewMode.ANALYTICS}
            onClick={() => onViewChange(ViewMode.ANALYTICS)}
            label={t('nav.analytics')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </NavButton>

        </nav>
        )}
      </div>
    </div>
  );
};

const NavButton: React.FC<{ id?: string; active: boolean; onClick: () => void; children: React.ReactNode; label: string }> = ({ id, active, onClick, children, label }) => (
  <button
    id={id}
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300 ${
      active ? 'text-amber-700 bg-amber-50/80 scale-105' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {children}
    {/* Label is hidden on very small screens if needed, but useful here */}
    <span className={`text-[10px] font-bold tracking-wide transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

