import clsx from 'clsx';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'ns-surface p-6 transition duration-300 hover:border-accent/55',
        className,
      )}
    >
      {children}
    </div>
  );
}
