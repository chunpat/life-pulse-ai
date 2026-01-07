
import React, { useState, useRef, useEffect } from 'react';
import { parseLifeLog } from '../services/geminiService';
import { LogEntry } from '../types';

interface LoggerProps {
  onAddLog: (entry: LogEntry) => void;
}

const Logger: React.FC<LoggerProps> = ({ onAddLog }) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
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
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const parsed = await parseLifeLog(inputText);
      const newEntry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        rawText: inputText,
        activity: parsed.activity || '未知活动',
        category: parsed.category || 'Other',
        durationMinutes: parsed.durationMinutes || 0,
        mood: parsed.mood || '中性',
        importance: (parsed.importance as any) || 3,
      };
      onAddLog(newEntry);
      setInputText('');
    } catch (err) {
      alert("AI 解析失败，请尝试更简洁的表达。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="刚才做了什么？（例如：'写代码 2 小时，感觉非常高效！'）"
          className="w-full bg-transparent border-none focus:ring-0 text-lg text-slate-800 placeholder:text-slate-400 min-h-[120px] resize-none"
        />
        
        <div className="flex justify-between items-center mt-4">
          <button 
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
            }`}
            title={isListening ? "停止录音" : "语音录入"}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>

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

      <div className="grid grid-cols-2 gap-4">
        <QuickTip text="在健身房锻炼了 30 分钟" onClick={setInputText} />
        <QuickTip text="沉浸式写代码 3 小时" onClick={setInputText} />
        <QuickTip text="和莉莉喝了杯咖啡，很开心" onClick={setInputText} />
        <QuickTip text="读了 20 分钟书" onClick={setInputText} />
      </div>
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
