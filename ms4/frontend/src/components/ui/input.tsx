import { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm text-textPrimary outline-none transition placeholder:text-textMuted/75 focus:border-accent/60 focus:ring-2 focus:ring-accent/30',
        className,
      )}
      {...props}
    />
  );
}
