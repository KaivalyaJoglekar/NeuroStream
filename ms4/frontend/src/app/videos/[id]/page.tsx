'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock3, FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '../../../components/protected-route';
import { AppShell } from '../../../components/layout/app-shell';
import { fetchVideoDetails } from '../../../services/video.service';
import { VideoDetails, VideoStatus } from '../../../types/domain';
import { Card } from '../../../components/ui/card';
import { StatusBadge } from '../../../components/ui/status-badge';
import { bytesToSize, formatDate } from '../../../utils/format';

const finalStatuses = new Set(['COMPLETED', 'FAILED', 'DELETED']);

const STAGES: VideoStatus[] = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'MEDIA_PROCESSED',
  'AI_PROCESSED',
  'INDEXED',
  'ANALYTICS_READY',
  'COMPLETED',
];

export default function VideoDetailsPage() {
  const params = useParams<{ id: string }>();

  return (
    <ProtectedRoute>
      <AppShell title="Video Details">
        <VideoDetailsView videoId={params.id} />
      </AppShell>
    </ProtectedRoute>
  );
}

function VideoDetailsView({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldPoll = useMemo(() => {
    return video ? !finalStatuses.has(video.status) : false;
  }, [video]);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetchVideoDetails(videoId);
    if (response.success && response.data) {
      setVideo(response.data);
    }
    setLoading(false);
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      void load();
    }, 6000);

    return () => window.clearInterval(timer);
  }, [shouldPoll, load]);

  if (loading && !video) {
    return <Card className="p-10 text-center text-textMuted">Loading video details...</Card>;
  }

  if (!video) {
    return <Card className="p-10 text-center text-textMuted">Video not found.</Card>;
  }

  return (
    <div className="space-y-5">
      <Link href="/library" className="inline-flex items-center text-sm text-accent hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to library
      </Link>

      <Card>
        {video.fileUrl && (
          <div className="mb-6 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10 shadow-2xl">
            <video
              src={video.fileUrl}
              controls
              className="w-full max-h-[60vh] object-contain"
              controlsList="nodownload"
            />
          </div>
        )}

        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl">{video.title}</h2>
            <p className="mt-1 text-sm text-textMuted">{video.description || 'No description provided'}</p>
          </div>
          <StatusBadge status={video.status} />
        </div>

        <WorkflowProgress status={video.status} />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MetaItem label="Size" value={bytesToSize(video.fileSize)} icon={FileText} />
          <MetaItem label="Created" value={formatDate(video.createdAt)} icon={Clock3} />
          <MetaItem label="Updated" value={formatDate(video.updatedAt)} icon={Clock3} />
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg">Workflow event timeline</h3>
        <div className="mt-4 space-y-3">
          {video.workflowLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-stroke/80 bg-elevated/70 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">{log.serviceName}</p>
                <StatusBadge status={log.status} />
              </div>
              <p className="text-sm text-textMuted">{log.message || 'No message'}</p>
              <p className="mt-1 text-xs text-textMuted/80">{formatDate(log.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function WorkflowProgress({ status }: { status: VideoStatus }) {
  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-500"
          style={{ width: `${currentIndex < 0 ? 8 : ((currentIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] tracking-wide text-textMuted">
        {STAGES.map((stage, idx) => (
          <span
            key={stage}
            className={`rounded-full border px-2 py-0.5 ${idx <= currentIndex ? 'border-accent/40 text-accent' : 'border-stroke'}`}
          >
            {stage.replaceAll('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stroke/70 bg-elevated/70 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-textMuted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-sm font-medium text-textPrimary">{value}</p>
    </div>
  );
}
