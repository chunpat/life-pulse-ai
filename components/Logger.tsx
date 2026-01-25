
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseLifeLog, getSmartSuggestions } from '../services/qwenService';
import { createFinanceRecord } from '../services/financeService';
import { storageService } from '../services/storageService';
import { LogEntry } from '../types';

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

interface LoggerProps {
  onAddLog: (entry: LogEntry) => void;
  onLogout: () => void;
  userId: string;
  isGuest?: boolean;
  logs: LogEntry[]; // Changed from logsCount to logs array
}

const Logger: React.FC<LoggerProps> = ({ onAddLog, onLogout, userId, isGuest = false, logs }) => {
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
                title: 'LifePulse AI - 智能生活记录助手',
                desc: 'AI 帮你统计与分析生活点滴。',
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
      recognitionRef.current.lang = 'zh-CN';

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
  }, []);

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

      onAddLog(newEntry);
      setInputText('');
      setUploadedImages([]);
      setCurrentLocation(undefined);
    } catch (e) {
      console.error(e);
      alert(t('logger.parse_failed', '解析失败，已按普通记录保存')); 
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {suggestion && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group">
          <div className="p-2 bg-indigo-100 rounded-lg text-xl flex-none">
            {suggestion.type === 'health' ? '🌿' : 
             suggestion.type === 'productivity' ? '🚀' : 
             suggestion.type === 'work_life_balance' ? '⚖️' : '💡'}
          </div>
          <div className="flex-1 z-10">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-0.5">{t('logger.smart_suggestion')}</h4>
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
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/40 rounded-full blur-xl group-hover:bg-indigo-200/20 transition-colors"></div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-shadow relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('logger.placeholder')}
          className="w-full bg-transparent border-none focus:ring-0 text-lg text-slate-800 placeholder:text-slate-400 min-h-[100px] pb-12 resize-none"
        />
        
        {/* 附件预览区域 - 浮动在输入框下方 */}
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
                    : 'bg-white text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border border-slate-100'
              }`}
              title={isListening ? t('logger.stop_recording') : t('logger.voice_input')}
            >
              <svg className="w-5 h-5 flex-none" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </button>

            {/* 图片上传按钮 */}
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
              className={`flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-indigo-600 shadow-sm border border-slate-100 transition-all ${isUploading ? 'animate-pulse' : ''}`}
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

            {/* 地点捕捉按钮 */}
            <button
              type="button"
              onClick={captureLocation}
              disabled={isGettingLocation}
              className={`flex-none p-2.5 rounded-xl transition-all shadow-sm border border-slate-100 ${currentLocation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-500 hover:text-indigo-600 transition-colors'} ${isGettingLocation ? 'animate-bounce' : ''}`}
              title={t('logger.capture_location')}
            >
              <svg className="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* 微信转发按钮 */}
            {isWeChat && (
              <button
                type="button"
                onClick={() => setShowShareOverlay(true)}
                className="flex-none p-2.5 rounded-xl bg-white text-slate-500 hover:text-indigo-600 shadow-sm border border-slate-100 transition-all"
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
                isProcessing ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100'
              }`}
            >
              {isProcessing ? t('logger.processing') : t('logger.submit')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <QuickTip text={t('logger.quick_tips.gym')} onClick={setInputText} />
        <QuickTip text={t('logger.quick_tips.code')} onClick={setInputText} />
        <QuickTip text={t('logger.quick_tips.date')} onClick={setInputText} />
        <QuickTip text={t('logger.quick_tips.read')} onClick={setInputText} />
      </div>

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
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto mb-6 shadow-2xl flex items-center justify-center">
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
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
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
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
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
