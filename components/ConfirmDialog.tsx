import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-red-500 text-white hover:bg-red-400'
    : 'bg-slate-900 text-white hover:bg-slate-800';

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d6_45%,#ffffff_100%)] px-5 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">Confirm</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>
        </div>

        <div className="flex gap-3 px-5 py-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;