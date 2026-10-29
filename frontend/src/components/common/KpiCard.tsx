import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: 'blue' | 'purple' | 'teal' | 'pink' | 'orange' | 'green';
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accent = 'blue',
  trend,
  onClick,
  className,
}) => {
  const accentStyles = {
    blue: {
      border: 'border-t-4 border-t-blue-500',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25',
      glow: 'hover:shadow-blue-500/10',
    },
    purple: {
      border: 'border-t-4 border-t-purple-500',
      iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25',
      glow: 'hover:shadow-purple-500/10',
    },
    teal: {
      border: 'border-t-4 border-t-teal-500',
      iconBg: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md shadow-teal-500/25',
      glow: 'hover:shadow-teal-500/10',
    },
    pink: {
      border: 'border-t-4 border-t-pink-500',
      iconBg: 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/25',
      glow: 'hover:shadow-pink-500/10',
    },
    orange: {
      border: 'border-t-4 border-t-amber-500',
      iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/25',
      glow: 'hover:shadow-orange-500/10',
    },
    green: {
      border: 'border-t-4 border-t-emerald-500',
      iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/25',
      glow: 'hover:shadow-emerald-500/10',
    },
  };

  const currentAccent = accentStyles[accent];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-slate-100 p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        currentAccent.border,
        currentAccent.glow,
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
          </div>
        </div>
        <div className={cn('p-3 rounded-2xl shrink-0', currentAccent.iconBg)}>
          {icon}
        </div>
      </div>

      {(trend || subtitle) && (
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold',
                  trend.isPositive !== false
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-rose-700 bg-rose-50'
                )}
              >
                {trend.isPositive !== false ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-600" />
                )}
                {trend.value}
              </span>
              {trend.label && <span className="text-slate-400">{trend.label}</span>}
            </div>
          ) : (
            <span className="text-slate-400">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};
