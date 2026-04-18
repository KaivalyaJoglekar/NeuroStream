import Link from 'next/link';
import { Eye, PencilLine, Trash2 } from 'lucide-react';
import { Video } from '../../types/domain';
import { bytesToSize, formatDate } from '../../utils/format';
import { Card } from '../ui/card';
import { StatusBadge } from '../ui/status-badge';
import { Button } from '../ui/button';

export function VideoCard({
  video,
  onDelete,
  onRename,
}: {
  video: Video;
  onDelete: (video: Video) => void;
  onRename: (video: Video) => void;
}) {
  return (
    <Card className="group p-5 transition duration-300 hover:-translate-y-0.5 hover:border-brand-border hover:bg-white/[0.03]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-base font-semibold text-white">{video.title}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-textMuted">{video.fileName}</p>
        </div>
        <StatusBadge status={video.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div className="ns-surface-soft p-2.5">
          <p className="text-textMuted">File size</p>
          <p className="mt-1 font-medium text-white">{bytesToSize(video.fileSize)}</p>
        </div>
        <div className="ns-surface-soft p-2.5">
          <p className="text-textMuted">Updated</p>
          <p className="mt-1 font-medium text-white">{formatDate(video.updatedAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/videos/${video.id}`} className="flex-1 min-w-[140px]">
          <Button variant="ghost" className="w-full justify-center border border-brand-border bg-transparent text-brand-light hover:border-brand hover:text-[#FFFFFF] hover:bg-brand-wash">
            <Eye className="mr-1.5 h-4 w-4" />
            View Video
          </Button>
        </Link>

        <Button variant="ghost" onClick={() => onRename(video)} className="px-3 hover:bg-[#22232E] hover:border-[#22232E]">
          <PencilLine className="h-4 w-4" />
        </Button>

        <Button variant="danger" onClick={() => onDelete(video)} className="px-3">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
