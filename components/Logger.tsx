
import React, { useState, useRef, useEffect } from 'react';
import { parseLifeLog } from '../services/qwenService';
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
  logsCount?: number;
}

const Logger: React.FC<LoggerProps> = ({ onAddLog, onLogout, userId, isGuest = false, logsCount = 0 }) => {
  const [inputText, setInputText] = useState('');
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
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!navigator.geolocation) {
      alert("您的浏览器不支持地理位置功能");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let locationName = "未知位置";
        
        try {
          // 使用 OpenStreetMap Nominatim API 进行逆地理编码 (免费)
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=zh-CN`);
          const data = await res.json();
          if (data && data.address) {
            // 优先显示：道路/建筑物 > 街区 > 城市
            const addr = data.address;
            const parts = [
              addr.road || addr.building || addr.amenity,
              addr.suburb || addr.district || addr.city
            ].filter(Boolean);
            locationName = parts.length > 0 ? parts.join(', ') : data.display_name.split(',')[0];
          } else {
             locationName = `经度:${longitude.toFixed(2)}, 纬度:${latitude.toFixed(2)}`;
          }
        } catch (e) {
          console.error("逆地理编码失败", e);
          locationName = `位置 (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
        }

        setCurrentLocation({
          name: locationName,
          latitude,
          longitude
        });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("获取位置失败:", error);
        alert("获取位置失败，请确保已开启定位权限");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
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
              jsApiList: ['startRecord', 'stopRecord', 'translateVoice', 'onVoiceRecordEnd']
            });
            (window as any).wx.ready(() => setWxReady(true));
            (window as any).wx.error((err: any) => {
              console.error('WeChat JS-SDK Error:', err);
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
    if (isGuest && logsCount >= 3) {
      setShowLimitModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = await parseLifeLog(inputText);

      // 自动保存财务记录
      if (parsed.finance && parsed.finance.length > 0) {
        try {
          await Promise.all(parsed.finance.map(f => createFinanceRecord(f)));
          // 可以考虑使用更优雅的 Toast 提示
          // alert(`已自动记录 ${parsed.finance.length} 笔财务账单`); 
        } catch (e) {
          console.error("Failed to save finance", e);
        }
      }

      const newEntry: LogEntry = {
        id: generateUUID(),
        userId: userId,
        timestamp: Date.now(),
        rawText: inputText,
        activity: parsed.activity || '未知活动',
        category: parsed.category || 'Other',
        durationMinutes: parsed.durationMinutes || 0,
        mood: parsed.mood || '中性',
        importance: (parsed.importance as any) || 3,
        images: uploadedImages,
        location: currentLocation,
      };
      onAddLog(newEntry);
      setInputText('');
      setUploadedImages([]);
      setCurrentLocation(undefined);
    } catch (err) {
      console.error("提交失败:", err);
      alert(`AI 解析失败: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-shadow relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="刚才做了什么？（例如：'写代码 2 小时，感觉非常高效！'）"
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
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-100 animate-fade-in">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="max-w-[100px] truncate">{currentLocation.name}</span>
                <button type="button" onClick={() => setCurrentLocation(undefined)} className="hover:text-emerald-900 ml-1">×</button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center bg-slate-50 -mx-5 -mb-5 px-5 py-3 rounded-b-[2rem] border-t border-slate-100">
          <div className="flex items-center gap-2 relative">
            <button 
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-100' 
                  : permissionDenied 
                    ? 'bg-red-50 text-red-400' 
                    : 'bg-white text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm border border-slate-100'
              }`}
              title={isListening ? "停止录音" : "语音录入"}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
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
              className={`p-2.5 rounded-xl bg-white text-slate-500 hover:text-indigo-600 shadow-sm border border-slate-100 transition-all ${isUploading ? 'animate-pulse' : ''}`}
              title="上传图片"
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* 地点捕捉按钮 */}
            <button
              type="button"
              onClick={captureLocation}
              disabled={isGettingLocation}
              className={`p-2.5 rounded-xl transition-all shadow-sm border border-slate-100 ${currentLocation ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-500 hover:text-indigo-600'} ${isGettingLocation ? 'animate-bounce' : ''}`}
              title="获取地点"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {permissionDenied && (
              <div className="absolute top-full left-0 mt-2 w-max max-w-[200px] bg-red-50 text-red-500 text-xs p-2 rounded-lg border border-red-100 shadow-sm z-10 animate-in fade-in zoom-in-95 duration-200">
                <p className="font-bold mb-1">无法通过语音录入</p>
                {isWeChat ? (
                  wxReady ? (
                    <span>微信录音启动失败。请确保您已授权微信访问麦克风。</span>
                  ) : (
                    <span>检测到微信环境。通常 iOS 微信会拦截网页原生语音接口。您可以点击右上角<b>“在 Safari 中打开”</b>，或确保系统已正确配置并授权微信 JS-SDK。</span>
                  )
                ) : (
                  <span>请点击地址栏的 🔒 或设置图标开启麦克风权限，然后点击此按钮重试。</span>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim() || isProcessing}
              className={`px-8 py-3 rounded-full font-bold text-white transition-all ${
                isProcessing ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100'
              }`}
            >
              {isProcessing ? 'AI 分析中...' : '记录一下'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <QuickTip text="在健身房锻炼了 30 分钟" onClick={setInputText} />
        <QuickTip text="沉浸式写代码 3 小时" onClick={setInputText} />
        <QuickTip text="和莉莉喝了杯咖啡，很开心" onClick={setInputText} />
        <QuickTip text="读了 20 分钟书" onClick={setInputText} />
      </div>

      {/* 游客限制弹窗 */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">已达到游客限制</h3>
            <p className="text-slate-600 mb-6">
              游客模式仅支持记录 3 条日常。为了持久保存您的记录并解锁 AI 汇总分析功能，请前往登录。
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onLogout}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                前往登录 / 注册
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                再看看已记录的
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
