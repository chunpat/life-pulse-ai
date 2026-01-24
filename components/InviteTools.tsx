
import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { User } from '../types';

interface InviteToolsProps {
  user: User;
  onClose: () => void;
}

const InviteTools: React.FC<InviteToolsProps> = ({ user, onClose }) => {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState('WeChat Official Account');
  const [copied, setCopied] = useState(false);

  const platforms = [
    { id: 'WeChat Official Account', label: t('invite.platforms.wechat_oa', 'WeChat Official Account') },
    { id: 'Xiaohongshu', label: t('invite.platforms.xiaohongshu', 'Xiaohongshu') },
    { id: 'WeChat Moments', label: t('invite.platforms.wechat_moments', 'WeChat Moments') },
    { id: 'WeChat Friend', label: t('invite.platforms.wechat_friend', 'WeChat Friend') },
    { id: 'Other', label: t('invite.platforms.other', 'Other') }
  ];

  const baseUrl = window.location.origin;
  const inviteLink = `${baseUrl}?ref=${user.id}${platform ? `&source=${encodeURIComponent(platform)}` : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{t('invite.title', 'Invite Friends')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('invite.desc', 'Share your link to track referrals')}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
              {t('invite.platform', 'Promotion Platform (Optional)')}
            </label>
            <div className="relative">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
              >
                {platforms.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-4 bg-white rounded-xl border border-dashed border-slate-200">
             <QRCodeCanvas value={inviteLink} size={180} level={"H"} includeMargin={true} />
          </div>
          
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
             <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5 font-bold">{t('invite.link_label', 'INVITE LINK')}</p>
                <p className="text-xs text-slate-600 truncate font-mono">{inviteLink}</p>
             </div>
             <button 
               onClick={handleCopy}
               className={`flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
             >
               {copied ? t('invite.copied_btn', 'Copied!') : t('invite.copy_btn', 'Copy')}
             </button>
          </div>
        </div>

        <div className="mt-6 text-center">
           <p className="text-xs text-slate-300">
             {t('invite.user_id_label', 'User ID')}: {user.id} 
           </p>
        </div>

      </div>
    </div>
  );
};

export default InviteTools;
