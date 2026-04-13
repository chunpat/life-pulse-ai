
import React, { useState, useEffect } from 'react';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { useTranslation } from 'react-i18next';
import { User, AuthStatus } from '../types';
import { authService } from '../services/authService';
import { runtimeConfig } from '../services/runtimeConfig';
import { buildSafeAreaInsetStyle, buildSafeAreaPaddingStyle } from '../utils/safeArea';

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
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isNativeIos = runtimeConfig.isNativeIos;
  const authShellSafeStyle = buildSafeAreaPaddingStyle({ top: '1.5rem', right: '1.5rem', bottom: '1.5rem', left: '1.5rem' });
  const languageSwitcherSafeStyle = buildSafeAreaInsetStyle({ top: '1rem', right: '1.5rem' });

  useEffect(() => {
    // Check URL params for referral info
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const src = params.get('source');
    
    if (ref) {
      setReferrerId(ref);
      sessionStorage.setItem('referrerId', ref);
    } else {
      const storedRef = sessionStorage.getItem('referrerId');
      if (storedRef) setReferrerId(storedRef);
    }
    
    if (src) {
      setSource(src);
      sessionStorage.setItem('source', src);
    } else {
      const storedSrc = sessionStorage.getItem('source');
      if (storedSrc) setSource(storedSrc);
    }
  }, []);

  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const state = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}`;

      const result = await SignInWithApple.authorize({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID?.trim() || 'ai.lifepulse.app',
        redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI?.trim() || window.location.origin,
        scopes: 'email name',
        state,
      });

      const data = await authService.loginWithApple({
        identityToken: result.response.identityToken,
        authorizationCode: result.response.authorizationCode,
        email: result.response.email,
        givenName: result.response.givenName,
        familyName: result.response.familyName,
      });

      onLogin(data.user, data.token);
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : typeof err === 'string' ? err : '';
      if (/cancel/i.test(message)) {
        setError(t('auth.apple_cancelled'));
      } else {
        setError(message || t('auth.apple_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

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
        const data = await authService.register(name, email, password, referrerId || undefined, source || undefined);
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#fff8ea_0%,#fffdf8_36%,#f8fafc_100%)] ${isNativeIos ? '' : 'flex flex-col items-center justify-center'}`}
      style={authShellSafeStyle}
    >
      {/* Language Switcher - Top Right */}
      <div className="absolute z-10 flex gap-2 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-white/80 backdrop-blur-md" style={languageSwitcherSafeStyle}>
        <button 
          onClick={() => i18n.changeLanguage('zh')}
          className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${i18n.language.startsWith('zh') ? 'bg-white text-amber-700 shadow-sm border border-amber-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          中文
        </button>
        <button 
          onClick={() => i18n.changeLanguage('en')}
          className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${i18n.language.startsWith('en') ? 'bg-white text-amber-700 shadow-sm border border-amber-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          EN
        </button>
      </div>

      <div className={`mx-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ${isNativeIos ? 'pt-16 pb-6' : 'space-y-8'}`}>
        {/* Logo/Header */}
        <div className={`text-center ${isNativeIos ? 'rounded-[2.25rem] border border-white/80 bg-white/72 px-5 py-6 shadow-lg shadow-amber-100/40 backdrop-blur-xl' : ''}`}>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500 shadow-xl shadow-amber-200 transition-transform hover:rotate-6">
            <svg className="w-10 h-10 text-slate-950 -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-100">Life OS</span>
            {isNativeIos && <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">iPhone</span>}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {t('app.title')} <span className="text-amber-600">AI</span>
          </h1>
          <p className="mt-2 text-slate-500 font-medium">{t('auth.subtitle')}</p>
        </div>

        {/* Auth Card */}
        <div className={`mt-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50 ${isNativeIos ? 'backdrop-blur-xl' : ''}`}>
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
                  autoComplete={isLoginView ? 'username' : 'nickname'}
                  autoCapitalize="none"
                  enterKeyHint="next"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-400/30 transition-all outline-none text-slate-800"
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
                    autoComplete="email"
                    autoCapitalize="none"
                    inputMode="email"
                    enterKeyHint="next"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-400/30 transition-all outline-none text-slate-800"
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
                autoComplete={isLoginView ? 'current-password' : 'new-password'}
                autoCapitalize="none"
                enterKeyHint="go"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-400/30 transition-all outline-none text-slate-800"
                placeholder={t('auth.password_placeholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-2xl bg-amber-500 py-4 text-slate-950 font-bold shadow-lg shadow-amber-200 transition-all hover:bg-amber-400 active:scale-[0.98] ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t('auth.processing')}
                </div>
              ) : (isLoginView ? t('auth.login_submit') : t('auth.register_submit'))}
            </button>
          </form>

          {isNativeIos && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-300">
                <div className="h-px flex-1 bg-slate-200"></div>
                <span>{t('auth.or')}</span>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 font-bold text-white shadow-lg shadow-slate-300 transition-all active:scale-[0.98] ${loading ? 'cursor-not-allowed opacity-70' : 'hover:bg-slate-800'}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.465 2.23-1.167 3.003-.873.96-2.296 1.7-3.594 1.597-.164-1.12.417-2.305 1.107-3.06.763-.846 2.095-1.486 3.26-1.54.273 1.149-.073 2.31-.606 3.001Zm4.26 16.96c-.392.902-.856 1.734-1.39 2.508-.728 1.05-1.323 1.776-1.785 2.18-.716.663-1.485 1.005-2.31 1.028-.59 0-1.3-.17-2.13-.513-.832-.34-1.596-.513-2.29-.513-.727 0-1.505.173-2.334.513-.83.343-1.5.524-2.016.545-.79.034-1.576-.318-2.355-1.06-.496-.427-1.117-1.177-1.863-2.25-.8-1.145-1.457-2.47-1.97-3.975C-.145 15.17-.39 13.63-.39 12.244c0-1.587.343-2.955 1.03-4.1a6.04 6.04 0 0 1 2.165-2.175 5.85 5.85 0 0 1 2.92-.826c.575 0 1.33.178 2.267.53.935.355 1.535.533 1.8.533.2 0 .87-.21 2.008-.627 1.075-.39 1.98-.55 2.718-.48 2.002.162 3.506.95 4.51 2.37-1.79 1.085-2.677 2.605-2.66 4.56.014 1.523.568 2.79 1.662 3.79.496.465 1.052.824 1.67 1.076-.134.39-.275.764-.425 1.12Z" />
                </svg>
                {loading ? t('auth.processing') : t('auth.apple_login')}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">{t('auth.apple_hint')}</p>
            </>
          )}

          <div className="mt-6 flex items-center justify-between text-sm">
            <button 
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-amber-700 font-bold hover:underline"
            >
              {isLoginView ? t('auth.switch_to_register') : t('auth.switch_to_login')}
            </button>
            <span className="text-slate-300">|</span>
            <button className="text-slate-400">{t('auth.forgot_password')}</button>
          </div>
        </div>

        {/* Guest Mode Section */}
        <div className="pt-4 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-4 text-slate-400 tracking-widest">{t('auth.or')}</span></div>
          </div>

          <button 
            onClick={onContinueAsGuest}
            className="group w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-amber-400 hover:text-amber-700 transition-all flex items-center justify-center gap-2"
          >
            <span>{t('auth.guest_mode')}</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-amber-100/50 bg-amber-50 p-4">
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

        <p className="pb-2 text-center text-[10px] text-slate-400">
          {t('auth.terms_hint')} <span className="underline cursor-pointer">{t('auth.terms_link')}</span> & <span className="underline cursor-pointer">{t('auth.privacy_link')}</span>
        </p>
      </div>
    </div>
  );
};

export default Auth;
