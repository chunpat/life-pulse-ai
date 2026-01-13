
import React, { useState } from 'react';
import { User, AuthStatus } from '../types';
import { authService } from '../services/authService';

interface AuthProps {
  onLogin: (user: User, token?: string) => void;
  onContinueAsGuest: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onContinueAsGuest }) => {
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
        const data = await authService.login(email, password);
        onLogin(data.user, data.token);
      } else {
        const data = await authService.register(name || email.split('@')[0], email, password);
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo/Header */}
        <div className="text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 flex items-center justify-center mx-auto mb-6 transform rotate-12">
            <svg className="w-10 h-10 text-white -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">LifePulse AI</h1>
          <p className="mt-2 text-slate-500">用 AI 捕捉生活的每一次脉动</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100 animate-shake">
              {error}
            </div>
          )}
          <form className="space-y-5" onSubmit={handleAuth}>
            {!isLoginView && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">昵称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                  placeholder="你想被如何称呼？"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">邮箱地址</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                placeholder="hello@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none text-slate-800"
                placeholder="••••••••"
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
                  处理中...
                </div>
              ) : (isLoginView ? '立即登录' : '注册账号')}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button 
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-indigo-600 font-bold hover:underline"
            >
              {isLoginView ? '没有账号？去注册' : '已有账号？去登录'}
            </button>
            <span className="text-slate-300">|</span>
            <button className="text-slate-400">忘记密码</button>
          </div>
        </div>

        {/* Guest Mode Section */}
        <div className="text-center pt-4">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-4 text-slate-400 tracking-widest">或者</span></div>
          </div>

          <button 
            onClick={onContinueAsGuest}
            className="group w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <span>以游客身份体验</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          <div className="mt-4 flex flex-col gap-2 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              游客模式限制说明
            </div>
            <ul className="text-left text-[10px] text-amber-600/80 space-y-1 list-disc list-inside">
              <li>数据仅保存在当前浏览器，清除缓存将导致数据丢失。</li>
              <li>不支持跨设备同步。</li>
              <li>记录上限为 50 条。</li>
              <li>AI 深度周报/月报功能暂不可用。</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400">
          登录即代表您同意我们的 <span className="underline">服务协议</span> 和 <span className="underline">隐私政策</span>
        </p>
      </div>
    </div>
  );
};

export default Auth;
