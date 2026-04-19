'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Film, Search, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProtectedRoute } from '../../components/protected-route';
import { AppShell } from '../../components/layout/app-shell';
import { Video, VideoStatus } from '../../types/domain';
import { fetchLibrary, renameVideo, deleteVideo } from '../../services/video.service';
import { VideoCard } from '../../components/video/video-card';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { SectionReveal } from '../../components/ui/section-reveal';

const statusOptions: Array<VideoStatus | ''> = [
  '',
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'INDEXED',
  'ANALYTICS_READY',
  'COMPLETED',
  'FAILED',
];

const activeStatuses = new Set<VideoStatus>(['UPLOADED', 'QUEUED', 'PROCESSING']);

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Video Library">
        <LibraryView />
      </AppShell>
    </ProtectedRoute>
  );
}

function LibraryView() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VideoStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [renameVideoItem, setRenameVideoItem] = useState<Video | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteVideoItem, setDeleteVideoItem] = useState<Video | null>(null);
  const { pushToast } = useToast();

  const hasActive = useMemo(() => videos.some((video) => activeStatuses.has(video.status)), [videos]);

  const summary = useMemo(() => {
    const total = totalVideos;
    const processing = videos.filter((video) => activeStatuses.has(video.status)).length;
    const completed = videos.filter((video) => video.status === 'COMPLETED').length;

    return {
      total,
      processing,
      completed,
    };
  }, [videos]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const response = await fetchLibrary({ page, limit: 9, search, status });
    if (response.success) {
      setVideos(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalVideos(response.pagination.total);
    }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!hasActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadData();
    }, 7000);

    return () => window.clearInterval(timer);
  }, [hasActive, loadData]);

  const submitRename = async () => {
    if (!renameVideoItem) {
      return;
    }

    const response = await renameVideo(renameVideoItem.id, renameTitle);
    if (response.success) {
      pushToast({ title: 'Video renamed', type: 'success' });
      setRenameVideoItem(null);
      await loadData();
      return;
    }

    pushToast({ title: 'Rename failed', description: response.error, type: 'error' });
  };

  const submitDelete = async () => {
    if (!deleteVideoItem) {
      return;
    }

    const response = await deleteVideo(deleteVideoItem.id);
    if (response.success) {
      pushToast({ title: 'Video deleted', type: 'success' });
      setDeleteVideoItem(null);
      setVideos((current) => current.filter((item) => item.id !== deleteVideoItem.id));
      setTotalVideos((current) => Math.max(current - 1, 0));
      await loadData();
      return;
    }

    pushToast({ title: 'Delete failed', description: response.error, type: 'error' });
  };

  return (
    <div className="space-y-6">
      <SectionReveal>
        <Card className="relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(99,91,255,0.06),transparent_40%)]" />
          <div className="relative z-10 grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
            <div>
              <p className="ns-label">Collection</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Manage your video inventory
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-textMuted">
                Search, filter, preview, and operate on media assets with a clean, high-signal media surface.
              </p>
              <Link
                href="/upload"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-transparent px-3.5 py-2 text-sm font-medium text-brand-light transition hover:bg-brand-wash hover:text-[#FFFFFF]"
              >
                <Film className="h-4 w-4" />
                Upload another video
              </Link>
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-xs text-textMuted md:min-w-[220px]">
              <p>
                Visible: <span className="font-medium text-white">{summary.total}</span>
              </p>
              <p>
                In progress: <span className="font-medium text-white">{summary.processing}</span>
              </p>
              <p>
                Completed: <span className="font-medium text-white">{summary.completed}</span>
              </p>
            </div>
          </div>
        </Card>
      </SectionReveal>

      <SectionReveal delay={0.03}>
        <Card className="p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
              <Input
                className="pl-9"
                placeholder="Search by title or filename"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-textMuted">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Status
              </span>
              <select
                className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as VideoStatus | '');
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option || 'all'} value={option}>
                    {option ? option.replaceAll('_', ' ') : 'All statuses'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      </SectionReveal>

      {loading ? (
        <Card className="p-10 text-center text-textMuted">Loading library...</Card>
      ) : videos.length === 0 ? (
        <Card className="p-10 text-center text-textMuted">No videos found for the current filters.</Card>
      ) : (
        <SectionReveal delay={0.05}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1], delay: index * 0.03 }}
              >
                <VideoCard
                  video={video}
                  onRename={(item) => {
                    setRenameVideoItem(item);
                    setRenameTitle(item.title);
                  }}
                  onDelete={setDeleteVideoItem}
                />
              </motion.div>
            ))}
          </div>
        </SectionReveal>
      )}

      <SectionReveal delay={0.07}>
        <div className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-textMuted">
          <button
            className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 transition hover:border-accent/35 hover:text-textPrimary disabled:opacity-40"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>

          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-brand" />
            {`Page ${page} / ${Math.max(1, totalPages)}`}
          </span>

          <button
            className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 transition hover:border-accent/35 hover:text-textPrimary disabled:opacity-40"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </SectionReveal>

      <Modal open={Boolean(renameVideoItem)} onClose={() => setRenameVideoItem(null)} title="Rename video">
        <div className="space-y-4">
          <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameVideoItem(null)}>
              Cancel
            </Button>
            <Button onClick={submitRename}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteVideoItem)} onClose={() => setDeleteVideoItem(null)} title="Delete video">
        <div className="space-y-4">
          <p className="text-sm text-textMuted">
            This removes the video from your library and triggers cleanup in downstream systems.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteVideoItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
