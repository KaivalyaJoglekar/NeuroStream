import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseClass = 'inline-flex items-center justify-center font-medium transition-all outline-none rounded-xl disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Updated primary variant to use new Deep Iris values
    const variants = {
      primary:
        'bg-brand hover:bg-brand-light text-white shadow-[0_8px_24px_rgba(99,91,255,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(99,91,255,0.3)] active:translate-y-0',
      secondary:
        'bg-white/10 text-white hover:bg-white-[0.15] border border-white/10 hover:border-white/20',
      danger:
        'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20',
      ghost:
        'bg-transparent text-textMuted hover:text-white hover:bg-white/5',
    };

    const sizes = {
      sm: 'h-9 px-3.5 text-xs',
      md: 'h-11 px-5 text-sm',
      lg: 'h-14 px-8 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={clsx(baseClass, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2.5 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
