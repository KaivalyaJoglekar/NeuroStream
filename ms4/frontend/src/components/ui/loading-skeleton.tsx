export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-elevated/80 ${className ?? ''}`} />;
}
