'use client';

import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useToast } from '../../hooks/use-toast';

export function ToastViewport() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            className={clsx(
              'pointer-events-auto w-full rounded-xl border px-4 py-3 text-left shadow-panel',
              toast.type === 'success' && 'border-success/45 bg-success/15',
              toast.type === 'error' && 'border-red-500/40 bg-red-950/35',
              (!toast.type || toast.type === 'info') && 'border-stroke/80 bg-elevated/85',
            )}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            onClick={() => removeToast(toast.id)}
          >
            <p className="text-sm font-semibold text-textPrimary">{toast.title}</p>
            {toast.description ? <p className="mt-0.5 text-xs text-textMuted">{toast.description}</p> : null}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
