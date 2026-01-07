
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
        activity: parsed.activity || 'Activity',
        category: parsed.category || 'Other',
        durationMinutes: parsed.durationMinutes || 0,
        mood: parsed.mood || 'Neutral',
        importance: (parsed.importance as any) || 3,
      };
      onAddLog(newEntry);
      setInputText('');
    } catch (err) {
      alert("AI interpretation failed. Please try a simpler phrase.");
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
          placeholder="What did you do just now? (e.g., 'Worked on coding for 2 hours, felt really productive!')"
          className="w-full bg-transparent border-none focus:ring-0 text-lg text-slate-800 placeholder:text-slate-400 min-h-[120px] resize-none"
        />
        
        <div className="flex justify-between items-center mt-4">
          <button 
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
            }`}
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
            {isProcessing ? 'Thinking...' : 'Log Entry'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <QuickTip text="Spent 30 mins at gym" onClick={setInputText} />
        <QuickTip text="Coding for 3 hours" onClick={setInputText} />
        <QuickTip text="Had a nice coffee with Lily" onClick={setInputText} />
        <QuickTip text="Reading book for 20m" onClick={setInputText} />
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
