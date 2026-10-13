import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-md shadow-cyan-500/20 border border-cyan-400/40',
  secondary: 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700/80 shadow-sm',
  ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent',
  danger: 'bg-red-500/90 hover:bg-red-500 text-white shadow-md shadow-red-500/20 border border-red-400/40',
  outline: 'bg-transparent hover:bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 shadow-sm',
  pill: 'bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 hover:border-cyan-500 font-medium',
  activeTab: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold',
  inactiveTab: 'bg-transparent text-slate-400 hover:text-slate-200 border border-transparent font-medium',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
  icon: 'h-8 w-8 p-0 flex items-center justify-center shrink-0', // standard 32x32 touch target
  iconSm: 'h-7 w-7 p-0 flex items-center justify-center shrink-0',
  chip: 'h-6 px-2.5 text-[10px] gap-1 rounded-full shrink-0',
  tab: 'py-1.5 px-3 text-xs gap-1.5 rounded-lg flex-1',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  const isIconButton = size === 'icon' || size === 'iconSm';
  const iconSize = size === 'sm' || size === 'chip' || size === 'iconSm' ? 14 : (size === 'lg' ? 18 : 16);

  return (
    <motion.button
      type={type}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-150 select-none cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:ring-offset-1 focus:ring-offset-slate-950',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin text-current" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={iconSize} className="shrink-0" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={iconSize} className="shrink-0" />}
        </>
      )}
    </motion.button>
  );
}
