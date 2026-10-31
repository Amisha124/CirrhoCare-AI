import React from 'react';
import { cn } from '@/utils/cn';
import type { RiskLevel, UserRole } from '@/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'high' | 'medium' | 'low' | 'pending' | 'role' | 'outline' | 'info' | 'success';
  risk?: RiskLevel;
  role?: UserRole;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  risk,
  role,
  size = 'md',
  children,
  ...props
}) => {
  // If risk prop is passed, auto-determine variant
  let activeVariant = variant;
  if (risk) {
    if (risk === 'High Risk') activeVariant = 'high';
    else if (risk === 'Medium Risk') activeVariant = 'medium';
    else if (risk === 'Low Risk') activeVariant = 'low';
    else activeVariant = 'pending';
  } else if (role) {
    activeVariant = 'role';
  }

  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/60',
    high: 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold',
    medium: 'bg-amber-50 text-amber-700 border-amber-200/80 font-bold',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold',
    pending: 'bg-slate-100 text-slate-600 border-slate-200/80',
    info: 'bg-blue-50 text-blue-700 border-blue-200/80 font-semibold',
    role: 'bg-purple-50 text-purple-700 border-purple-200/80 font-semibold capitalize',
    outline: 'bg-transparent border-slate-300 text-slate-700',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-[13px] font-semibold rounded-full',
    md: 'px-3 py-1 text-[14px] font-semibold rounded-full',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border tracking-wide select-none',
        variants[activeVariant],
        sizes[size],
        className
      )}
      {...props}
    >
      {/* Indicator dot for risk variants */}
      {['high', 'medium', 'low'].includes(activeVariant) && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full', {
            'bg-rose-500 animate-pulse': activeVariant === 'high',
            'bg-amber-500': activeVariant === 'medium',
            'bg-emerald-500': activeVariant === 'low',
          })}
        />
      )}
      {children || risk || role}
    </span>
  );
};
