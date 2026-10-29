import React from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface LoadingSpinnerProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading clinical data...',
  className,
  fullScreen = false,
}) => {
  const content = (
    <div className={cn('flex flex-col items-center justify-center p-8 gap-3', className)}>
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
        <Activity className="w-5 h-5 text-blue-600 absolute animate-pulse" />
      </div>
      {label && <p className="text-sm font-medium text-slate-500 animate-pulse">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
