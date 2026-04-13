import React from 'react';
import { buildSafeAreaInsetStyle, buildSafeAreaPaddingStyle } from '../utils/safeArea';

type NoticeTone = 'success' | 'error' | 'info';

interface NoticeToastProps {
  open: boolean;
  message: string;
  tone?: NoticeTone;
  onClose: () => void;
}

const TONE_CLASS_MAP: Record<NoticeTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-100/80',
  error: 'border-red-200 bg-red-50 text-red-700 shadow-red-100/80',
  info: 'border-amber-200 bg-[#fffaf0] text-slate-700 shadow-amber-100/70'
};

const TONE_BADGE_MAP: Record<NoticeTone, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-amber-500 text-slate-950'
};

const TONE_LABEL_MAP: Record<NoticeTone, string> = {
  success: '成功',
  error: '提醒',
  info: '提示'
};

const NoticeToast: React.FC<NoticeToastProps> = ({ open, message, tone = 'info', onClose }) => {
  if (!open || !message) return null;

  const noticeSafeStyle = {
    ...buildSafeAreaInsetStyle({ top: '0.75rem' }),
    ...buildSafeAreaPaddingStyle({ left: '1rem', right: '1rem' })
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center" style={noticeSafeStyle}>
      <div className={`pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-[1.4rem] border px-4 py-3 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 ${TONE_CLASS_MAP[tone]}`}>
        <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.18em] ${TONE_BADGE_MAP[tone]}`}>
          {TONE_LABEL_MAP[tone]}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-current/55 transition-colors hover:text-current"
          aria-label="close notice"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default NoticeToast;