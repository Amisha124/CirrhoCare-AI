import React from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: 'blue' | 'purple' | 'teal' | 'pink' | 'orange' | 'green' | 'none';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  accentColor = 'none',
  hoverEffect = false,
  children,
  ...props
}) => {
  const accentClasses = {
    none: '',
    blue: 'border-t-4 border-t-blue-500',
    purple: 'border-t-4 border-t-purple-500',
    teal: 'border-t-4 border-t-teal-500',
    pink: 'border-t-4 border-t-pink-500',
    orange: 'border-t-4 border-t-amber-500',
    green: 'border-t-4 border-t-emerald-500',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-100 shadow-card transition-all duration-200 overflow-hidden',
        accentClasses[accentColor],
        hoverEffect && 'hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ className, title, subtitle, action, children, ...props }) => (
  <div
    className={cn(
      'flex items-center justify-between p-5 pb-3 border-b border-slate-50',
      className
    )}
    {...props}
  >
    {title ? (
      <div>
        <h3 className="text-[18px] sm:text-[19px] font-bold text-slate-900 tracking-tight font-manrope">{title}</h3>
        {subtitle && <p className="text-[14px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
    ) : (
      children
    )}
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-5', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn('p-4 px-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between', className)}
    {...props}
  >
    {children}
  </div>
);
