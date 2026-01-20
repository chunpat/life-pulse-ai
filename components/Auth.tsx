
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, AuthStatus } from '../types';
import { authService } from '../services/authService';

interface AuthProps {
  onLogin: (user: User, token?: string) => void;
  onContinueAsGuest: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onContinueAsGuest }) => {
  const { t, i18n } = useTranslation();
  const [isLoginView, setIsLoginView] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginView) {
        // 登录使用昵称
        const data = await authService.login(name, password);
        onLogin(data.user, data.token);
      } else {
        // 注册
        const data = await authService.register(name, email, password);
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-6 right-6 flex gap-2">
        <button 
          onClick={() => i18n.changeLanguage('zh')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${i18n.language.startsWith('zh') ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          中文
        </button>
        <button 
          onClick={() => i18n.changeLanguage('en')}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${i18n.language.startsWith('en') ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          EN
        </button>
      </div>

      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo/Header */}
        <div className="text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 flex items-center justify-center mx-auto mb-6 transform rotate-12 transition-transform hover:rotate-6">
            <svg className="w-10 h-10 text-white -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {t('app.title')} <span className="text-indigo-500">AI</span>
          </h1>
          <p className="mt-2 text-slate-500 font-medium">{t('auth.subtitle')}</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100 animate-shake">
              {error}
            </div>
          )}
          <form className="space-y-5" onSubmit={handleAuth}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                {isLoginView ? t('auth.login_identifier') : t('auth.nickname')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                  placeholder={isLoginView ? t('auth.login_identifier_placeholder') : t('auth.nickname_placeholder')}
                />
              </div>
            </div>

            {!isLoginView && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                  {t('auth.email')} 
                  <span className="text-slate-400 font-normal text-xs ml-2">({t('auth.optional')})</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                    placeholder="hello@example.com"
                  />
                  <p className="mt-1 text-xs text-slate-400 px-1">{t('auth.email_hint')}</p>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">{t('auth.password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                placeholder={t('auth.password_placeholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t('auth.processing')}
                </div>
              ) : (isLoginView ? t('auth.login_submit') : t('auth.register_submit'))}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button 
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-indigo-600 font-bold hover:underline"
            >
              {isLoginView ? t('auth.switch_to_register') : t('auth.switch_to_login')}
            </button>
            <span className="text-slate-300">|</span>
            <button className="text-slate-400">{t('auth.forgot_password')}</button>
          </div>
        </div>

        {/* Guest Mode Section */}
        <div className="text-center pt-4">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-4 text-slate-400 tracking-widest">{t('auth.or')}</span></div>
          </div>

          <button 
            onClick={onContinueAsGuest}
            className="group w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <span>{t('auth.guest_mode')}</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          <div className="mt-4 flex flex-col gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {t('auth.guest_warning_title')}
            </div>
            <ul className="text-left text-[10px] text-amber-600/80 space-y-1 list-disc list-inside">
              <li>{t('auth.guest_warning_1')}</li>
              <li>{t('auth.guest_warning_2')}</li>
              <li>{t('auth.guest_warning_3')}</li>
              <li>{t('auth.guest_warning_4')}</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400">
          {t('auth.terms_hint')} <span className="underline cursor-pointer">{t('auth.terms_link')}</span> & <span className="underline cursor-pointer">{t('auth.privacy_link')}</span>
        </p>
      </div>
    </div>
  );
};

export default Auth;
