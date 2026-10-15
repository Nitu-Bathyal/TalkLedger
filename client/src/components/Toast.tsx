import React from 'react';

export interface ToastState {
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastState;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast.show) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className={`px-5 py-3.5 rounded-2xl border-2 shadow-bahi-lg flex items-center gap-3 ${
        isError ? 'bg-tomato-red text-white border-ink-brown' : 'bg-ink-brown text-cream border-haldi-yellow'
      }`}>
        <i className={`fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-check text-haldi-yellow'} text-lg`}></i>
        <span className="text-xs font-bold">{toast.message}</span>
      </div>
    </div>
  );
};
