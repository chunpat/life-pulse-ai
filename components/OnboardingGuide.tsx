import React from 'react';

interface OnboardingGuideProps {
  onGenericClose: () => void;
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onGenericClose }) => {
  const [step, setStep] = React.useState(0);

  const steps = [
    {
      target: 'logger',
      title: '开始记录',
      content: '点击这里开始记录你的生活。支持语音和文字，自动识别分类和情感。',
      position: 'bottom-28 left-1/2 -translate-x-1/2', // Moved up slightly to make room for larger arrow
      arrow: 'bottom-[-16px] left-1/2 -translate-x-1/2 drop-shadow-sm', 
    },
    {
      target: 'history',
      title: '回顾历史',
      content: '在这里查看你的时间轴，回顾每一天的精彩时刻。',
      position: 'bottom-28 left-8',
      arrow: 'bottom-[-16px] left-8 drop-shadow-sm',
    },
    {
      target: 'finance',
      title: '财务管家',
      content: '点击这里进入财务模式，查看你的收支统计和账本。',
      position: 'top-24 right-4',
      arrow: 'top-[-16px] right-4 rotate-180 drop-shadow-sm',
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onGenericClose();
    }
  };

  const currentStep = steps[step];

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-[1px] flex flex-col">
       {/* Highlighting Area (Fake spotlight can be complex, using simple overlay logic) */}
      
      {/* Tooltip Card */}
      <div 
        className={`absolute w-64 bg-white p-5 rounded-2xl shadow-2xl transition-all duration-300 ease-out border-2 border-indigo-100 ${currentStep.position}`}
      >
        {/* Arrow */}
        <div className={`absolute w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-indigo-600 ${currentStep.arrow}`}></div>

        <div className="flex items-center justify-between mb-2">
           <h3 className="text-lg font-bold text-slate-800">{currentStep.title}</h3>
           <span className="text-xs font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded-full">{step + 1}/{steps.length}</span>
        </div>
        
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          {currentStep.content}
        </p>

        <div className="flex justify-end gap-3">
           <button 
             onClick={onGenericClose}
             className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-2"
           >
             跳过
           </button>
           <button 
             onClick={handleNext}
             className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
           >
             {step === steps.length - 1 ? '知道了' : '下一步'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;
