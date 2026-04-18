import clsx from 'clsx';
import { VideoStatus } from '../../types/domain';

const toneMap: Record<VideoStatus, string> = {
  PENDING: 'bg-transparent text-textMuted border-[#22232E]',
  UPLOADING: 'bg-transparent text-brand-light border-brand-border',
  UPLOADED: 'bg-transparent text-brand-light border-brand-border',
  QUEUED: 'bg-transparent text-brand-light border-brand-border',
  PROCESSING: 'bg-brand-wash text-brand-light border-brand-border',
  MEDIA_PROCESSED: 'bg-brand-wash text-brand-light border-brand-border',
  AI_PROCESSED: 'bg-brand-wash text-brand-light border-brand-border',
  INDEXED: 'bg-transparent text-[#E2E2E6] border-[#3D369E]',
  ANALYTICS_READY: 'bg-transparent text-[#E2E2E6] border-[#3D369E]',
  COMPLETED: 'bg-transparent text-success border-success/40',
  FAILED: 'bg-transparent text-danger border-danger/45',
  DELETED: 'bg-transparent text-danger/70 border-danger/30',
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]',
        toneMap[status],
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
