'use client';

import { AuthProvider } from '../hooks/use-auth';
import { ToastProvider } from '../hooks/use-toast';
import { ToastViewport } from './ui/toast-viewport';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <ToastViewport />
      </ToastProvider>
    </AuthProvider>
  );
}
