'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Home, LogOut, ShieldCheck, UploadCloud, UserCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../hooks/use-auth';
import { motion } from 'framer-motion';
import { AmbientBackground } from '../ui/ambient-background';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/upload', label: 'Upload', icon: UploadCloud },
  { href: '/library', label: 'Library', icon: Film },
];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const { user, logoutAction } = useAuth();

  const subtitleByRoute: Record<string, string> = {
    '/dashboard': 'Operational overview and workflow health',
    '/upload': 'Media ingestion workspace',
    '/library': 'Managed video index',
  };

  const currentSection = navItems.find((item) => pathname.startsWith(item.href));
  const subtitle = subtitleByRoute[currentSection?.href ?? '/dashboard'];
  const isBalancedWorkspace = pathname.startsWith('/dashboard') || pathname.startsWith('/upload');

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-textPrimary selection:bg-brand/30">
      <AmbientBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] p-4 pt-6 sm:p-6 lg:p-8">
        <div className="mb-6 ns-surface p-4 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-brand/25 bg-brand/15 text-sm font-semibold text-brand-light">
                NS
              </div>
              <div>
                <p className="text-xl font-fantomen text-white">Neuro<span className="text-brand">Stream</span></p>
                <p className="text-xs text-textMuted">Control panel</p>
              </div>
            </div>
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              onClick={logoutAction}
            >
              Sign out
            </button>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'inline-flex min-w-max items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-300',
                    active
                      ? 'border-brand/35 bg-brand/15 text-white'
                      : 'border-white/5 text-white/70 hover:border-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex w-full gap-6 xl:gap-10">
          <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] w-[248px] shrink-0 flex-col lg:flex">
            <div className="ns-surface flex h-full flex-col p-4">
              <div className="mb-8 flex items-center gap-3 px-2 pt-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-brand/30 bg-brand/15 text-sm font-semibold text-brand-light">
                  NS
                </div>
                <div>
                  <h2 className="text-xl font-fantomen text-white">Neuro<span className="text-brand">Stream</span></h2>
                  <p className="text-xs text-textMuted">AI workflow console</p>
                </div>
              </div>

              <nav className="flex-1 space-y-1.5 px-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200',
                        active
                          ? 'border-brand/35 bg-brand/15 text-white'
                          : 'border-transparent text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {active ? <span className="absolute left-0 top-2.5 h-5 w-0.5 rounded-full bg-brand" /> : null}
                      <Icon className={clsx('h-4 w-4 transition-colors', active ? 'text-brand-light' : 'text-white/65 group-hover:text-white')} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 ns-surface-soft p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full border border-brand/25 bg-brand/10">
                    <UserCircle2 className="h-5 w-5 text-brand-light" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Operator'}</p>
                    <p className="truncate text-xs text-textMuted">{user?.email ?? 'secure@neurostream.ai'}</p>
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] text-brand-light">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Authenticated session
                </div>

                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-rose-400/35 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={logoutAction}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </aside>

          <main className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col pt-2 lg:pt-8">
            <header
              className={clsx(
                'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
                isBalancedWorkspace ? 'mb-6 border-b border-transparent pb-4' : 'mb-8 border-b border-white/10 pb-6',
              )}
            >
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="ns-label"
                >
                  Workspace
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={clsx(
                    'mt-1 font-semibold tracking-tight text-white',
                    isBalancedWorkspace ? 'text-2xl lg:text-3xl' : 'text-3xl lg:text-4xl',
                  )}
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mt-1.5 text-sm text-textMuted"
                >
                  {subtitle}
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-2xl sm:flex"
              >
                <div className="text-right">
                  <p className="text-xs text-textMuted">Signed in as</p>
                  <p className="text-sm font-medium text-white">{user?.name ?? 'Operator'}</p>
                </div>
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/12">
                  <UserCircle2 className="h-5 w-5 text-brand-light" />
                </div>
              </motion.div>
            </header>

            <div className="flex-1 pb-20">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
