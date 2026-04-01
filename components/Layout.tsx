
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewMode } from '../types';
import OnboardingGuide from './OnboardingGuide';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenLoggerComposer: () => void;
  onOpenLoggerSidebar?: (tab?: 'goals' | 'record-add') => void;
  newLogAdded?: boolean;
  userName?: string;
  isGuest?: boolean;
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
  isGuest = false,
  onLogout,
  showGuide = false,
  onCloseGuide = () => {},
  onShowInvite
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [expandedDrawerSection, setExpandedDrawerSection] = useState<'navigation' | 'tools'>('navigation');
  const { t, i18n } = useTranslation();

  const displayUserName = userName === '游客' ? t('common.guest_user') : userName;
  const isLoggerView = currentView === ViewMode.LOGGER;
  const isSoftShellView = currentView === ViewMode.LOGGER || currentView === ViewMode.PLAN || currentView === ViewMode.FINANCE;
  const currentViewLabel = currentView === ViewMode.LOGGER
    ? t('nav.chat_home')
    : currentView === ViewMode.PLAN
      ? t('nav.plan')
      : currentView === ViewMode.FINANCE
        ? t('nav.finance')
        : currentView === ViewMode.TIMELINE
          ? t('nav.timeline')
          : t('nav.analytics');
  const navigationItems = [
    { view: ViewMode.LOGGER, label: t('nav.chat_home'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5m7 5l-3.8-2.1a2 2 0 00-.96-.24H6a3 3 0 01-3-3V7a3 3 0 013-3h12a3 3 0 013 3v6a3 3 0 01-3 3h-.24a2 2 0 00-.96.24L13 19z" /></svg> },
    { view: ViewMode.TIMELINE, label: t('nav.timeline'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { view: ViewMode.PLAN, label: t('nav.plan'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg> },
    { view: ViewMode.FINANCE, label: t('nav.finance'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
    { view: ViewMode.ANALYTICS, label: t('nav.analytics'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
  ];

  const handleDrawerViewChange = (view: ViewMode) => {
    onViewChange(view);
    setIsNavDrawerOpen(false);
  };

  const handleDrawerToolOpen = (tab: 'goals' | 'record-add') => {
    onOpenLoggerSidebar?.(tab);
    setIsNavDrawerOpen(false);
  };

  const toggleDrawerSection = (section: 'navigation' | 'tools') => {
    setExpandedDrawerSection((current) => current === section ? current : section);
  };

  return (
    // Outer Container - Desktop centered, Mobile full
    <div className={`fixed inset-0 sm:flex sm:items-center sm:justify-center ${isSoftShellView ? 'bg-[#f6f1e8]' : 'bg-slate-100'}`}>
      
      {/* App Shell */}
      <div className={`w-full h-full sm:h-[850px] sm:max-w-[400px] overflow-hidden flex flex-col relative transform-gpu ${isSoftShellView ? 'bg-[radial-gradient(circle_at_top,#fff7e8_0%,#fffdf9_38%,#f8fafc_100%)] sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-900' : 'bg-slate-50 sm:rounded-[3rem] sm:shadow-2xl sm:border-[8px] sm:border-slate-900'}`}>
        
        {/* Onboarding Guide Overlay */}
        {showGuide && <OnboardingGuide onGenericClose={onCloseGuide} />}

        {/* Dynamic Header */}
        <header className={`sticky top-0 z-20 ${isSoftShellView ? 'border-b-0 bg-transparent px-4 py-4' : 'border-b border-slate-100 bg-white/80 px-6 py-6 backdrop-blur-md'}`}>
          <div className="flex items-center justify-between">
            {isSoftShellView ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNavDrawerOpen(true)}
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
                      {isLoggerView ? displayUserName : `${displayUserName} · ${currentViewLabel}`}
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

          <div className="mt-4 overflow-x-auto scrollbar-hide">
            <div className={`inline-flex min-w-max gap-2 rounded-[1.4rem] p-1.5 shadow-sm backdrop-blur ${isSoftShellView ? 'bg-white/70 ring-1 ring-white/80' : 'bg-white/92 ring-1 ring-slate-200'}`}>
              {navigationItems.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => onViewChange(item.view)}
                  className={`inline-flex items-center justify-center gap-2 rounded-[1rem] px-3 py-2 text-xs font-black transition-colors ${currentView === item.view ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

        </header>

        {isSoftShellView && isNavDrawerOpen && (
          <div className="absolute inset-0 z-30">
            <div className="absolute inset-0 bg-slate-900/28 backdrop-blur-[2px]" onClick={() => setIsNavDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-[88%] max-w-[360px] overflow-y-auto bg-white shadow-2xl ring-1 ring-slate-200 animate-in slide-in-from-left duration-300">
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{t('nav.drawer_title')}</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{t('app.title')}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('nav.drawer_desc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNavDrawerOpen(false)}
                    className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-100">{currentViewLabel}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{displayUserName}</span>
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                <section className="rounded-[1.6rem] border border-slate-200 bg-[#fffaf0] p-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleDrawerSection('navigation')}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/70"
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">{t('nav.drawer_group_navigation')}</p>
                      <p className="mt-1 text-sm text-slate-500">{t('nav.drawer_group_navigation_desc')}</p>
                    </div>
                    <svg className={`h-5 w-5 text-slate-400 transition-transform ${expandedDrawerSection === 'navigation' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {expandedDrawerSection === 'navigation' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {navigationItems.map((item) => (
                        <button
                          key={item.view}
                          type="button"
                          onClick={() => handleDrawerViewChange(item.view)}
                          className={`flex min-h-[76px] flex-col items-start justify-between rounded-[1.25rem] border px-4 py-3 text-left transition-all ${currentView === item.view ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:shadow-sm'}`}
                        >
                          <span className={currentView === item.view ? 'text-white' : 'text-amber-600'}>{item.icon}</span>
                          <span className="text-sm font-black tracking-tight">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[1.6rem] border border-slate-200 bg-white p-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleDrawerSection('tools')}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{t('nav.drawer_group_tools')}</p>
                      <p className="mt-1 text-sm text-slate-500">{t('nav.drawer_group_tools_desc')}</p>
                    </div>
                    <svg className={`h-5 w-5 text-slate-400 transition-transform ${expandedDrawerSection === 'tools' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {expandedDrawerSection === 'tools' && (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenLoggerComposer();
                          setIsNavDrawerOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[#fffaf0] px-4 py-3 text-left text-slate-800 transition-colors hover:bg-amber-50"
                      >
                        <span>
                          <span className="block text-sm font-bold">{t('nav.drawer_open_composer')}</span>
                          <span className="mt-1 block text-xs text-slate-500">{t('logger.keyboard_mode_hint')}</span>
                        </span>
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDrawerToolOpen('record-add')}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 transition-colors hover:bg-slate-50"
                      >
                        <span>
                          <span className="block text-sm font-bold">{t('logger.record_add_label')}</span>
                          <span className="mt-1 block text-xs text-slate-500">{t('logger.record_add_hint')}</span>
                        </span>
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                      {!isGuest && (
                        <button
                          type="button"
                          onClick={() => handleDrawerToolOpen('goals')}
                          className="flex w-full items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left text-amber-800 transition-colors hover:bg-amber-100"
                        >
                          <span>
                            <span className="block text-sm font-bold">{t('logger.goal_drawer_label')}</span>
                            <span className="mt-1 block text-xs text-amber-700/80">{t('nav.drawer_open_goals_desc')}</span>
                          </span>
                          <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        )}

        {/* Scrollable Content Area */}
          <main className={`flex-1 overflow-y-auto scrollbar-hide ${isSoftShellView ? 'bg-transparent pb-24' : 'bg-slate-50 pb-24'}`}>
            <div className={`${isLoggerView ? 'h-full min-h-full px-0 pt-0 pb-0' : 'px-4 py-2 min-h-full'}`}>
            {children}
           </div>
        </main>

        {/* Floating Composer Button */}
          {!isLoggerView && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="pointer-events-auto relative flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-2 py-2 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
            <button
              id="nav-logger"
              onClick={() => onViewChange(ViewMode.LOGGER)}
              title={t('nav.chat_home')}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 10h8M8 14h5m7 5l-3.8-2.1a2 2 0 00-.96-.24H6a3 3 0 01-3-3V7a3 3 0 013-3h12a3 3 0 013 3v6a3 3 0 01-3 3h-.24a2 2 0 00-.96.24L13 19z" /></svg>
            </button>
            <button
              type="button"
              onClick={() => onViewChange(ViewMode.LOGGER)}
              className="pr-3 text-left"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">{t('nav.chat_home')}</span>
              <span className="block text-sm font-black text-slate-900">{t('common.back_to_chat')}</span>
            </button>

            {newLogAdded && (
              <span className="absolute -top-2 -right-2 flex h-6 w-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-6 w-6 bg-green-500 items-center justify-center text-[10px] text-white font-bold">✓</span>
              </span>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

