
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseLifeLog, getSmartSuggestions } from '../services/qwenService';
import { createFinanceRecord } from '../services/financeService';
import { storageService } from '../services/storageService';
import { Goal, GoalCreateInput, LogEntry, RewardProfile } from '../types';
import GoalPlanner from './GoalPlanner';

// 兼容性 UUID 生成函数
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 备用 UUID 生成方法
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const OFFICIAL_ACCENT_COLOR_MAP: Record<string, string> = {
  '#1d4ed8': '#f59e0b',
  '#7c3aed': '#d97706',
  '#059669': '#c2410c'
};

const formatDateKey = (value: number | string | Date) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeOfficialAccentColor = (accentColor?: string | null) => {
  const normalized = typeof accentColor === 'string' ? accentColor.trim().toLowerCase() : '';
  return OFFICIAL_ACCENT_COLOR_MAP[normalized] || accentColor || '#f59e0b';
};

const getLoggerGoalAccentColor = (goal: Goal) => {
  const metadataAccent = typeof goal.metadata?.accentColor === 'string' ? goal.metadata.accentColor : null;

  if (goal.planScope === 'official') {
    return normalizeOfficialAccentColor(metadataAccent);
  }

  return '#f59e0b';
};

interface LoggerProps {
  onAddLog: (entry: LogEntry) => Promise<void>;
  onLogout: () => void;
  userId: string;
  isGuest?: boolean;
  logs: LogEntry[]; // Changed from logsCount to logs array
  goals: Goal[];
  rewardProfile?: RewardProfile | null;
  isComposerOpen: boolean;
  isGoalActionLoading?: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCreateGoal: (goalInput: GoalCreateInput) => Promise<void>;
  onPauseGoal: (goalId: string) => Promise<void>;
  onResumeGoal: (goalId: string) => Promise<void>;
  onSetPrimaryGoal: (goalId: string) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

const Logger: React.FC<LoggerProps> = ({
  onAddLog,
  onLogout,
  userId,
  isGuest = false,
  logs,
  goals,
  rewardProfile,
  isComposerOpen,
  isGoalActionLoading = false,
  onOpenComposer,
  onCloseComposer,
  onCreateGoal,
  onPauseGoal,
  onResumeGoal,
  onSetPrimaryGoal,
  onDeleteGoal
}) => {
  const { t, i18n } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [suggestion, setSuggestion] = useState<{content: string, type: string, trigger: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LogEntry['location']>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isWeChat, setIsWeChat] = useState(false);
  const [wxReady, setWxReady] = useState(false);
  const [showShareOverlay, setShowShareOverlay] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const goalPlannerRef = useRef<HTMLDivElement>(null);

  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const primaryGoal = activeGoals.find((goal) => goal.rewardRole === 'primary') || activeGoals[0] || null;
  const focusGoal = primaryGoal || goals.find((goal) => goal.status === 'paused') || goals[0] || null;
  const todayKey = formatDateKey(Date.now());

  // Fetch Smart Suggestions
  useEffect(() => {
    if (isGuest || logs.length === 0) return;

    // Check localStorage to avoid spamming the API (limit to once per 4 hours)
    const lastFetch = localStorage.getItem('last_suggestion_fetch');
    const lastLang = localStorage.getItem('last_suggestion_lang');
    const now = Date.now();

    // Cache hit only if time is valid AND language matches
    if (lastFetch && (now - parseInt(lastFetch) < 4 * 60 * 60 * 1000) && lastLang === i18n.language) {
      const savedSuggestion = localStorage.getItem('current_suggestion');
      if (savedSuggestion) {
        setSuggestion(JSON.parse(savedSuggestion));
      }
      return;
    }
    
    // If we missed cache due to language mismatch, clear the current displayed suggestion immediately
    // so user doesn't see the wrong language while loading
    if (lastLang !== i18n.language) {
       setSuggestion(null);
    }

    const fetchSuggestion = async () => {
      try {
        const res = await getSmartSuggestions(logs, i18n.language);
        if (res.suggestions && res.suggestions.length > 0) {
          const mainSuggestion = res.suggestions[0];
          setSuggestion(mainSuggestion);
          // Cache it
          localStorage.setItem('last_suggestion_fetch', now.toString());
          localStorage.setItem('last_suggestion_lang', i18n.language);
          localStorage.setItem('current_suggestion', JSON.stringify(mainSuggestion));
        }
      } catch (e) {

        console.error("Failed to fetch suggestions", e);
      }
    };
    
    // Delay slightly to not block initial render
    const timer = setTimeout(fetchSuggestion, 2000);
    return () => clearTimeout(timer);
  }, [logs.length, isGuest, i18n.language]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const url = await storageService.uploadImage(file);
      setUploadedImages(prev => [...prev, url]);
    } catch (err) {
      console.error("图片上传失败:", err);
      alert("图片上传失败，请检查网络或配置");
    } finally {
      setIsUploading(false);
    }
  };

  const captureLocation = () => {
    setIsGettingLocation(true);

    const handleSuccess = async (latInput: string | number, lngInput: string | number) => {
      const latitude = typeof latInput === 'string' ? parseFloat(latInput) : latInput;
      const longitude = typeof lngInput === 'string' ? parseFloat(lngInput) : lngInput;
      
      let locationName = "未知位置";
      try {
        // 使用后端代理进行逆地理编码，避免前端请求被微信拦截或跨域问题
        const res = await fetch(`/api/wechat/reverse-geocode?lat=${latitude}&lng=${longitude}`);
        const data = await res.json();
        locationName = data.address || `位置 (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
      } catch (e) {
        console.error("逆地理编码失败", e);
        locationName = `位置 (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
      }

      setCurrentLocation({ name: locationName, latitude, longitude });
      setIsGettingLocation(false);
    };

    const handleError = (error: any) => {
      console.error("获取位置失败:", error);
      setIsGettingLocation(false);
    };

    // 优先使用微信 JS-SDK 定位
    if (isWeChat && wxReady) {
      const wx = (window as any).wx;
      wx.getLocation({
        type: 'gcj02', 
        success: (res: any) => {
          handleSuccess(res.latitude, res.longitude);
        },
        fail: (err: any) => {
          // 微信失败后尝试 H5 定位作为后备
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => handleSuccess(pos.coords.latitude, pos.coords.longitude),
              handleError,
              { enableHighAccuracy: true, timeout: 5000 }
            );
          } else {
            handleError(err);
          }
        }
      });
      return;
    }

    // 标准 H5 定位
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos.coords.latitude, pos.coords.longitude),
        handleError,
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsGettingLocation(false);
    }
  };

  useEffect(() => {
    // 检测是否在微信环境中
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.indexOf('micromessenger') !== -1) {
      setIsWeChat(true);
    }

    // 微信 JS-SDK 初始化
    if (ua.indexOf('micromessenger') !== -1 && (window as any).wx) {
      const initWx = async () => {
        try {
          const res = await fetch(`/api/wechat/config?url=${encodeURIComponent(window.location.href.split('#')[0])}`);
          const config = await res.json();
          if (config.enabled) {
            (window as any).wx.config({
              debug: false, 
              appId: config.appId,
              timestamp: config.timestamp,
              nonceStr: config.nonceStr,
              signature: config.signature,
              jsApiList: [
                'startRecord', 
                'stopRecord', 
                'translateVoice', 
                'onVoiceRecordEnd',
                'getLocation',             // 添加定位接口
                'updateAppMessageShareData',
                'updateTimelineShareData',
                'onMenuShareAppMessage',   // 兼容旧接口
                'onMenuShareTimeline'      // 兼容旧接口
              ]
            });
            (window as any).wx.ready(() => {
              setWxReady(true);
              
              // 获取当前不带参数的完整 URL，确保与 JS 接口安全域名匹配
              const currentUrl = window.location.href.split('#')[0];
              
              const shareData = {
                title: t('logger.share_meta.title'),
                desc: t('logger.share_meta.desc'),
                link: currentUrl,
                // 图片建议使用 300x300 及以上，绝对路径，且不能是透明背景的 PNG（白色背景更稳）
                imgUrl: window.location.origin + '/pwa-512x512.png', 
                success: function() {
                  console.log('分享接口调用成功');
                }
              };
              
              const wx = (window as any).wx;
              
              // 必须严格按照微信官方要求，先调用新接口，再兼容旧接口
              if (wx.updateAppMessageShareData) {
                wx.updateAppMessageShareData(shareData);
              }
              if (wx.updateTimelineShareData) {
                wx.updateTimelineShareData(shareData);
              }
              
              // 即使是认证过的号，旧接口在某些老版本微信或特定环境下依然是生效的关键
              if (wx.onMenuShareAppMessage) wx.onMenuShareAppMessage(shareData);
              if (wx.onMenuShareTimeline) wx.onMenuShareTimeline(shareData);
            });
            (window as any).wx.error((err: any) => {
              console.error('WeChat JS-SDK Error:', err);
              // alert(`微信 SDK 错误: ${JSON.stringify(err)}`);
              setWxReady(false);
            });
          }
        } catch (e) {
          console.error("WeChat JS-SDK init failed", e);
        }
      };
      initWx();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = i18n.language.startsWith('en') ? 'en-US' : 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev + ' ' + transcript).trim());
        setIsListening(false);
        setPermissionDenied(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setPermissionDenied(true);
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [i18n.language, t]);

  useEffect(() => {
    if (!isComposerOpen) return;

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isComposerOpen]);

  const toggleListening = () => {
    // 重置权限错误状态，允许用户重试
    if (permissionDenied) {
      setPermissionDenied(false);
    }

    // 优先使用微信 JS-SDK (针对 iOS 微信兼容性)
    if (isWeChat && wxReady) {
      const wx = (window as any).wx;
      if (isListening) {
        wx.stopRecord({
          success: (res: any) => {
            const localId = res.localId;
            setIsListening(false);
            wx.translateVoice({
              localId,
              isShowProgressTips: 1,
              success: (res2: any) => {
                const text = res2.translateResult;
                if (text) {
                  const cleanedText = text.replace(/[。，？！]$/, ''); // 移除微信识别自动加的句号
                  setInputText(prev => (prev + ' ' + cleanedText).trim());
                }
              }
            });
          },
          fail: (err: any) => {
            console.error("Stop record failed", err);
            setIsListening(false);
          }
        });
      } else {
        setIsListening(true);
        wx.startRecord({
          success: () => {
            wx.onVoiceRecordEnd({
              complete: (res: any) => {
                const localId = res.localId;
                setIsListening(false);
                wx.translateVoice({
                  localId,
                  isShowProgressTips: 1,
                  success: (res2: any) => {
                    const text = res2.translateResult;
                    if (text) {
                      const cleanedText = text.replace(/[。，？！]$/, '');
                      setInputText(prev => (prev + ' ' + cleanedText).trim());
                    }
                  }
                });
              }
            });
          },
          cancel: () => {
            setIsListening(false);
            alert('您拒绝了授权录音');
          },
          fail: (err: any) => {
            console.error("Start record failed", err);
            setIsListening(false);
            setPermissionDenied(true);
          }
        });
      }
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
        setIsListening(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    // 游客模式限制：限记 3 条
    if (isGuest && logs.length >= 3) {
      setShowLimitModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = await parseLifeLog(inputText, i18n.language);

      // 生成统一的 ID，确保 Log 和 Finance 使用同一个 ID 关联
      const newLogId = generateUUID();

      // 自动保存财务记录
      if (parsed.finance && parsed.finance.length > 0) {
        try {
          // 关联 logId 并创建财务记录
          await Promise.all(parsed.finance.map(f => createFinanceRecord({ ...f, logId: newLogId })));
        } catch (e) {
          console.error("Finance create failed", e);
        }
      }

      const newEntry: LogEntry = {
        id: newLogId,
        userId, 
        timestamp: Date.now(),
        rawText: inputText,
        activity: parsed.activity || inputText,
        category: (parsed.category as any) || 'Other',
        durationMinutes: parsed.durationMinutes || 0,
        mood: parsed.mood || '平静',
        importance: parsed.importance || 3,
        location: currentLocation,
        images: uploadedImages
      };

      await onAddLog(newEntry);
      setInputText('');
      setUploadedImages([]);
      setCurrentLocation(undefined);
      onCloseComposer();
    } catch (e) {
      console.error(e);
      alert(t('logger.parse_failed', '解析失败，已按普通记录保存')); 
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCompose = (text?: string) => {
    if (text) {
      setInputText(text);
    }
    onOpenComposer();
  };

  const handleCloseComposer = () => {
    if (isProcessing) return;
    onCloseComposer();
  };

  const scrollToPlanner = () => {
    goalPlannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isGuest && (
        <>
          <PlanFocusCard
            goal={focusGoal}
            activeGoalsCount={activeGoals.length}
            rewardProfile={rewardProfile}
            todayKey={todayKey}
            onOpenComposer={() => handleQuickCompose()}
            onOpenPlanner={scrollToPlanner}
          />
          <div ref={goalPlannerRef}>
            <GoalPlanner
              goals={goals}
              logsCount={logs.length}
              isGoalActionLoading={isGoalActionLoading}
              onCreateGoal={onCreateGoal}
              onPauseGoal={onPauseGoal}
              onResumeGoal={onResumeGoal}
              onSetPrimaryGoal={onSetPrimaryGoal}
              onDeleteGoal={onDeleteGoal}
            />
          </div>
          {rewardProfile && <RewardSnapshotCard rewardProfile={rewardProfile} />}
        </>
      )}
      
      {suggestion && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group">
          <div className="p-2 bg-amber-100 rounded-lg text-xl flex-none">
            {suggestion.type === 'health' ? '🌿' : 
             suggestion.type === 'productivity' ? '🚀' : 
             suggestion.type === 'work_life_balance' ? '⚖️' : '💡'}
          </div>
          <div className="flex-1 z-10">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">{t('logger.smart_suggestion')}</h4>
            <p className="text-sm font-medium text-slate-700 leading-snug">{suggestion.content}</p>
          </div>
          <button 
            onClick={() => {
              setSuggestion(null);
              // Clear cache so it doesn't reappear immediately
              localStorage.removeItem('current_suggestion');
            }} 
            className="text-slate-300 hover:text-slate-500 z-10 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          {/* Decor background */}
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/40 rounded-full blur-xl group-hover:bg-amber-200/30 transition-colors"></div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              {t('logger.launcher_label')}
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {t('logger.launcher_title')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {t('logger.launcher_desc')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleQuickCompose()}
            className="shrink-0 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            {t('logger.open_composer')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5">
          <QuickTip text={t('logger.quick_tips.gym')} onClick={handleQuickCompose} />
          <QuickTip text={t('logger.quick_tips.code')} onClick={handleQuickCompose} />
          <QuickTip text={t('logger.quick_tips.date')} onClick={handleQuickCompose} />
          <QuickTip text={t('logger.quick_tips.read')} onClick={handleQuickCompose} />
        </div>
      </div>

      {isComposerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleCloseComposer} />
          <div className="relative z-10 w-full sm:max-w-xl bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-slate-100 max-h-[88vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 pt-5 pb-4 border-b border-slate-100 rounded-t-[2rem]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
                    {t('logger.launcher_label')}
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                    {t('logger.modal_title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    {t('logger.modal_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseComposer}
                  className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-shadow relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t('logger.placeholder')}
                  className="w-full bg-transparent border-none focus:ring-0 text-lg text-slate-800 placeholder:text-slate-400 min-h-[140px] pb-12 resize-none"
                />

                {(uploadedImages.length > 0 || currentLocation) && (
                  <div className="flex flex-wrap gap-2 mb-4 px-1">
                    {uploadedImages.map((url, idx) => (
                      <div key={idx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                        <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    {currentLocation && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-100 animate-fade-in max-w-full">
                        <svg className="w-3.5 h-3.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span className="truncate">{currentLocation.name}</span>
                        <button type="button" onClick={() => setCurrentLocation(undefined)} className="hover:text-emerald-900 ml-1 flex-none text-sm leading-none">×</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center bg-slate-50 -mx-5 -mb-5 px-5 py-3 rounded-b-[2rem] border-t border-slate-100">
                  <div className="flex items-center gap-2 relative overflow-x-auto no-scrollbar flex-1 mr-2 py-1">
                    <button 
                      type="button"
                      onClick={toggleListening}
                      className={`flex-none p-2.5 rounded-xl transition-all ${
                        isListening 
                          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-100' 
                          : permissionDenied 
                            ? 'bg-red-50 text-red-400' 
                            : 'bg-white text-slate-500 hover:text-amber-700 hover:bg-white shadow-sm border border-slate-100'
                      }`}
                      title={isListening ? t('logger.stop_recording') : t('logger.voice_input')}
                    >
                      <svg className="w-5 h-5 flex-none" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </button>

                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={`flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-amber-700 shadow-sm border border-slate-100 transition-all ${isUploading ? 'animate-pulse' : ''}`}
                      title={t('logger.upload_image')}
                    >
                      {isUploading ? (
                        <svg className="w-5 h-5 animate-spin flex-none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={captureLocation}
                      disabled={isGettingLocation}
                      className={`flex-none p-2.5 rounded-xl transition-all shadow-sm border border-slate-100 ${currentLocation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-500 hover:text-amber-700 transition-colors'} ${isGettingLocation ? 'animate-bounce' : ''}`}
                      title={t('logger.capture_location')}
                    >
                      <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    {isWeChat && (
                      <button
                        type="button"
                        onClick={() => setShowShareOverlay(true)}
                        className="flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-amber-700 shadow-sm border border-slate-100 transition-all"
                        title={t('logger.share')}
                      >
                        <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    )}

                    {permissionDenied && (
                      <div className="absolute top-full left-0 mt-2 w-max max-w-[200px] bg-red-50 text-red-500 text-xs p-2 rounded-lg border border-red-100 shadow-sm z-10 animate-in fade-in zoom-in-95 duration-200">
                        <p className="font-bold mb-1">{t('logger.voice_error_title')}</p>
                        {isWeChat ? (
                          wxReady ? (
                            <span>{t('logger.wechat_error')}</span>
                          ) : (
                            <span>{t('logger.wechat_hint')}</span>
                          )
                        ) : (
                          <span>{t('logger.browser_voice_hint')}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative flex-none">
                    <button
                      onClick={handleSubmit}
                      disabled={!inputText.trim() || isProcessing}
                      className={`px-6 py-3 rounded-full font-bold text-white transition-all whitespace-nowrap ${
                        isProcessing ? 'bg-slate-400 cursor-wait' : 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 shadow-lg shadow-amber-200'
                      }`}
                    >
                      {isProcessing ? t('logger.processing') : t('logger.submit')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 微信分享引导蒙层 */}
      {showShareOverlay && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-start pt-20 animate-in fade-in duration-200"
          onClick={() => setShowShareOverlay(false)}
        >
          {/* 指示箭头 */}
          <div className="absolute top-4 right-6 text-white flex flex-col items-end">
             {/* 修正箭头的 SVG 路径，使其更形象地指向右上角菜单 */}
             <svg className="w-16 h-16 animate-bounce text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 5h7m0 0v7m0-7L8 14" />
             </svg>
             <div className="mt-2 text-right bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
               <p className="text-lg font-bold">{t('logger.share_overlay.click_menu')}</p>
               <p className="text-xs opacity-80 mt-1">{t('logger.share_overlay.select_friend')}</p>
               <div className="flex gap-2 mt-2 justify-end">
                   <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                   </div>
               </div>
             </div>
          </div>
          
          <div className="text-white text-center px-10 mt-32">
            <div className="w-20 h-20 bg-amber-500 text-slate-950 rounded-2xl mx-auto mb-6 shadow-2xl shadow-amber-300/30 flex items-center justify-center">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight">{t('logger.share_overlay.title')}</h3>
            <p className="mb-12 text-white/60 leading-relaxed text-sm whitespace-pre-line">
              {t('logger.share_overlay.desc')}
            </p>
            <button className="px-8 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium hover:bg-white/20 transition-colors active:scale-95">
              {t('logger.share_overlay.button')}
            </button>
          </div>
        </div>
      )}

      {/* 游客限制弹窗 */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{t('common.guest_limit_title')}</h3>
            <p className="text-slate-600 mb-6">
              {t('common.guest_limit_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onLogout}
                className="w-full py-3 bg-amber-500 text-slate-950 rounded-xl font-bold hover:bg-amber-400 transition-colors"
              >
                {t('common.login_register')}
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                {t('common.cancel_view')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const QuickTip: React.FC<{ text: string, onClick: (t: string) => void }> = ({ text, onClick }) => (
  <button 
    onClick={() => onClick(text)}
    className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 py-2 px-3 rounded-xl border border-slate-200 text-left truncate transition-colors"
  >
    "{text}"
  </button>
);

export default Logger;

const PlanFocusCard: React.FC<{
  goal: Goal | null;
  activeGoalsCount: number;
  rewardProfile?: RewardProfile | null;
  todayKey: string;
  onOpenComposer: () => void;
  onOpenPlanner: () => void;
}> = ({ goal, activeGoalsCount, rewardProfile, todayKey, onOpenComposer, onOpenPlanner }) => {
  const { t } = useTranslation();

  if (!goal) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8eb_0%,#fff1d3_55%,#fffbeb_100%)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
              {t('logger.plan_focus_label')}
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {t('logger.plan_focus_empty_title')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {t('logger.plan_focus_empty_desc')}
            </p>
            {rewardProfile && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-white shadow-sm">
                  {t('rewards.points_value', { count: rewardProfile.availablePoints })}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-white shadow-sm">
                  {t('rewards.level_value', { level: rewardProfile.level })}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenPlanner}
            className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
          >
            {t('logger.plan_secondary_cta')}
          </button>
        </div>
      </div>
    );
  }

  const isTodayDone = goal.lastCheckInDate === todayKey;
  const progress = Math.min((goal.completedDays / goal.totalDays) * 100, 100);
  const remainingDays = Math.max(goal.totalDays - goal.completedDays, 0);
  const accentColor = getLoggerGoalAccentColor(goal);
  const streakSegmentCount = Math.min(goal.totalDays, 7);
  const streakActiveCount = Math.min(goal.currentStreak, streakSegmentCount);
  const streakOverflowCount = Math.max(goal.currentStreak - streakSegmentCount, 0);
  const streakRingProgress = Math.min((goal.currentStreak / Math.max(goal.totalDays, 1)) * 100, 100);
  const statusSummary = goal.status === 'active'
    ? (isTodayDone ? t('goals.today_done') : t('goals.today_pending'))
    : goal.status === 'paused'
      ? t('goals.paused_hint')
      : goal.status === 'completed'
        ? t('goals.completed_hint', { days: goal.totalDays })
        : t('goals.failed_hint');
  const streakDashboardSummary = goal.status === 'active'
    ? t('logger.streak_dashboard_desc_active', { count: goal.currentStreak })
    : goal.status === 'paused'
      ? t('logger.streak_dashboard_desc_paused', { count: goal.currentStreak })
      : goal.status === 'completed'
        ? t('logger.streak_dashboard_desc_completed', { count: goal.currentStreak })
        : t('logger.streak_dashboard_desc_failed', { count: goal.currentStreak });

  return (
    <div
      className="plan-focus-card rounded-[2rem] border p-5 shadow-sm"
      style={{
        borderColor: `${accentColor}33`,
        background: `linear-gradient(135deg, ${accentColor}26 0%, rgba(255,248,235,0.96) 48%, rgba(255,255,255,0.98) 100%)`
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="plan-focus-card-shell">
          <div className="plan-focus-card-summary min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-bold text-amber-700 border border-white shadow-sm">
                {t('logger.plan_focus_label')}
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white">
                {goal.planScope === 'official' ? t('goals.official_plan_badge') : t('goals.primary_badge')}
              </span>
              {activeGoalsCount > 1 && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-white shadow-sm">
                  {t('logger.plan_parallel_hint', { count: activeGoalsCount })}
                </span>
              )}
            </div>

            <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950 leading-tight">
              {goal.title}
            </h3>

            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {statusSummary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                {goal.goalType === '21_DAY' ? t('goals.type_21_day') : t('goals.type_7_day')}
              </span>
              {goal.rewardTitle && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                  {t('goals.reward_inline', { reward: goal.rewardTitle })}
                </span>
              )}
              {rewardProfile && (
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-white shadow-sm">
                  {t('rewards.points_value', { count: rewardProfile.availablePoints })}
                </span>
              )}
            </div>
          </div>

          <div className="plan-focus-card-aside rounded-[1.6rem] bg-slate-950 px-4 py-4 text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              {t('logger.streak_dashboard_label')}
            </p>

            <div className="mt-4 flex items-center gap-4">
              <div
                className="relative h-24 w-24 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(${accentColor} 0% ${streakRingProgress}%, rgba(255,255,255,0.12) ${streakRingProgress}% 100%)`
                }}
              >
                <div className="absolute inset-[7px] rounded-full bg-slate-950"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg leading-none">🔥</span>
                  <span className="mt-1 text-3xl font-black text-white">{goal.currentStreak}</span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">
                  {t('goals.streak_label')}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {streakDashboardSummary}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isTodayDone ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-100'}`}>
                    {isTodayDone ? t('goals.today_short_done') : t('goals.today_short_pending')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {t('logger.streak_today_status_label')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/6 px-3 py-3 border border-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-300">
                  {t('logger.streak_momentum_label')}
                </span>
                {streakOverflowCount > 0 && (
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold text-amber-100">
                    {t('logger.streak_overflow_days', { count: streakOverflowCount })}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {Array.from({ length: streakSegmentCount }).map((_, index) => {
                  const isActive = index < streakActiveCount;
                  const isCurrentEdge = isActive && index === streakActiveCount - 1;

                  return (
                    <div
                      key={index}
                      className={`h-2.5 rounded-full transition-all ${isCurrentEdge ? 'scale-y-125' : ''}`}
                      style={{
                        background: isActive
                          ? `linear-gradient(90deg, ${accentColor} 0%, #fbbf24 100%)`
                          : 'rgba(255,255,255,0.12)',
                        boxShadow: isCurrentEdge ? `0 0 0 1px ${accentColor}66` : 'none'
                      }}
                    ></div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={goal.status === 'active' ? onOpenComposer : onOpenPlanner}
                className="flex-1 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors"
              >
                {goal.status === 'active' ? t('logger.plan_primary_cta') : t('logger.plan_secondary_cta')}
              </button>
              {goal.status === 'active' && (
                <button
                  type="button"
                  onClick={onOpenPlanner}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white border border-white/10 hover:bg-white/15 transition-colors"
                >
                  {t('logger.plan_secondary_cta')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-white/85 border border-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
            <span>{t('goals.progress_inline', { current: goal.completedDays, total: goal.totalDays })}</span>
            <span>{t('goals.remaining_label')} {remainingDays}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            ></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <PlanStat label={t('goals.progress_label')} value={`${goal.completedDays}/${goal.totalDays}`} />
            <PlanStat label={t('goals.streak_label')} value={`${goal.currentStreak}`} />
            <PlanStat label={t('goals.today_label')} value={isTodayDone ? t('goals.today_short_done') : t('goals.today_short_pending')} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center border border-slate-100">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

const RewardSnapshotCard: React.FC<{ rewardProfile: RewardProfile }> = ({ rewardProfile }) => {
  const { t, i18n } = useTranslation();
  const latestBadge = rewardProfile.latestBadges[0] || null;
  const latestBadgeAccent = latestBadge?.accentColor || '#f59e0b';
  const levelProgress = Math.min((rewardProfile.pointsIntoCurrentLevel / rewardProfile.levelStepPoints) * 100, 100);
  const badgeDate = latestBadge
    ? new Date(latestBadge.issuedAt).toLocaleDateString(i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric'
    })
    : null;

  return (
    <div className="rounded-[1.6rem] border border-amber-200 bg-[linear-gradient(135deg,#fffaf0_0%,#fff6e5_58%,#ffffff_100%)] p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">
            {t('logger.reward_summary_label')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.points_value', { count: rewardProfile.availablePoints })}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.level_value', { level: rewardProfile.level })}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-amber-100 shadow-sm">
              {t('rewards.badge_count_label')} {rewardProfile.totalBadgeCount}
            </span>
          </div>
        </div>

        <div className="min-w-0 lg:w-[280px] rounded-2xl bg-white/85 border border-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
            <span>{t('rewards.level_progress_value', { current: rewardProfile.pointsIntoCurrentLevel, total: rewardProfile.levelStepPoints })}</span>
            <span>{t('rewards.next_level_remaining', { level: rewardProfile.level + 1, count: rewardProfile.pointsToNextLevel })}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24_0%,#f59e0b_100%)] transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {latestBadge && (
        <div className="mt-4 rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${latestBadgeAccent} 0%, rgba(15,23,42,0.9) 100%)` }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">{t('rewards.latest_badge_label')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-white truncate">{latestBadge.title}</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">
                  {latestBadge.planScope === 'official' ? t('rewards.official_badge') : t('rewards.personal_badge')}
                </span>
              </div>
              {badgeDate && (
                <p className="mt-1 text-xs text-white/75">
                  {t('rewards.badge_earned_at', { date: badgeDate })}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
              {latestBadge.shortTitle}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
