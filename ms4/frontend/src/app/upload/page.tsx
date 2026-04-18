'use client';

import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, ShieldCheck, UploadCloud } from 'lucide-react';
import { ProtectedRoute } from '../../components/protected-route';
import { AppShell } from '../../components/layout/app-shell';
import { UploadDropzone } from '../../components/upload/upload-dropzone';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { bytesToSize, clampPercent } from '../../utils/format';
import { completeUpload, initiateUpload, uploadToObjectStorage } from '../../services/upload.service';
import { SectionReveal } from '../../components/ui/section-reveal';

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Upload Workspace">
        <UploadPanel />
      </AppShell>
    </ProtectedRoute>
  );
}

function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState('Idle');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdVideoId, setCreatedVideoId] = useState<string | null>(null);
  const { pushToast } = useToast();

  const safeProgress = clampPercent(progress);

  useEffect(() => {
    if (!file || title.trim().length > 0) {
      return;
    }

    setTitle(deriveTitleFromFilename(file.name));
  }, [file, title]);

  function deriveTitleFromFilename(filename: string) {
    const withoutExt = filename.replace(/\.[^/.]+$/, '');
    return withoutExt
      .split(/[-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  const estimatedDuration = useMemo(() => {
    if (!file) {
      return 'Awaiting file';
    }

    const megaBytes = file.size / (1024 * 1024);
    const seconds = Math.max(20, Math.round(megaBytes * 1.4));
    return `~${seconds}s`;
  }, [file]);

  const statusTone = useMemo(() => {
    if (step === 'Failed') {
      return 'border-danger/45 text-danger bg-transparent';
    }

    if (step === 'Complete') {
      return 'border-success/60 text-success bg-transparent';
    }

    if (loading) {
      return 'border-brand-border text-brand-light bg-transparent';
    }

    return 'border-white/10 text-textMuted bg-transparent';
  }, [loading, step]);

  const handleUpload = async () => {
    if (!file) {
      pushToast({ title: 'Select a video first', type: 'error' });
      return;
    }

    if (!title.trim()) {
      pushToast({ title: 'Add a title before uploading', type: 'error' });
      return;
    }

    setLoading(true);
    setCreatedVideoId(null);

    try {
      setStep('Requesting signed URL');
      setProgress(20);

      const initiated = await initiateUpload({
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (!initiated.success || !initiated.data) {
        throw new Error(initiated.error ?? 'Failed to initiate upload.');
      }

      setStep('Uploading');
      setProgress(58);
      await uploadToObjectStorage(initiated.data.uploadUrl, file);

      setStep('Queued');
      setProgress(84);

      const completed = await completeUpload({
        objectKey: initiated.data.objectKey,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (!completed.success || !completed.data) {
        throw new Error(completed.error ?? 'Failed to complete upload.');
      }

      setCreatedVideoId(completed.data.videoId);
      setProgress(100);
      setStep('Complete');
      pushToast({ title: 'Upload successful', description: 'Processing has started.', type: 'success' });
    } catch (error) {
      setStep('Failed');
      pushToast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unexpected error.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate space-y-5 overflow-hidden">
      <SectionReveal>
        <Card className="relative overflow-hidden p-0 border border-transparent hover:border-white/10 transition-colors">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_14%,rgba(99,91,255,0.06),transparent_40%)]" />
          <div className="relative z-10 grid gap-5 px-5 py-5 md:grid-cols-[1fr_auto] md:px-6 md:py-6">
            <div>
              <p className="ns-label">Media ingestion</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">Upload and dispatch</h2>
              <p className="mt-2 max-w-2xl text-sm text-textMuted md:text-base">
                Add your video, title, and description, then upload directly to object storage with signed access.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#22232E] bg-white/[0.02] px-3 py-1 text-xs text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                  Signed URL transfer
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#22232E] bg-white/[0.02] px-3 py-1 text-xs text-white/80">
                  <Clock3 className="h-3.5 w-3.5" />
                  Estimated {estimatedDuration}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-transparent bg-white/[0.02] p-4 text-right text-xs text-[#E2E2E6] md:min-w-[220px]">
              <p>
                Status: <span className="font-medium text-white">{step}</span>
              </p>
              <p>
                Payload: <span className="font-medium text-white">{file ? bytesToSize(file.size) : 'Not selected'}</span>
              </p>
              <p>
                Completion: <span className="font-medium text-white">{safeProgress}%</span>
              </p>
            </div>
          </div>
        </Card>
      </SectionReveal>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionReveal delay={0.02}>
          <Card className="space-y-4 border-white/5 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ns-label">Dropzone</p>
                <h3 className="mt-1 text-base font-medium text-white md:text-lg">Video details</h3>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusTone}`}>
                {loading ? 'In progress' : file ? 'Ready' : 'Waiting'}
              </span>
            </div>

            <UploadDropzone onFileSelect={setFile} disabled={loading} />

            <div className="space-y-3 rounded-2xl border border-transparent bg-white/[0.02] p-4">
              <div className="space-y-1.5">
                <label htmlFor="upload-title" className="text-xs text-textMuted">
                  Title
                </label>
                <Input
                  id="upload-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Enter a title"
                  maxLength={180}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="upload-description" className="text-xs text-textMuted">
                  Description
                </label>
                <textarea
                  id="upload-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short description for this video"
                  maxLength={1500}
                  disabled={loading}
                  className="min-h-[96px] w-full resize-y rounded-xl border border-transparent bg-black/20 px-4 py-2.5 text-sm text-white/90 outline-none transition placeholder:text-textMuted/75 focus:border-brand-border focus:ring-2 focus:ring-brand-wash"
                />
              </div>
            </div>

            {file ? (
              <div className="grid gap-3 rounded-2xl border border-transparent bg-white/[0.015] p-4 sm:grid-cols-3">
                <InfoBlock label="Name" value={file.name} />
                <InfoBlock label="Size" value={bytesToSize(file.size)} />
                <InfoBlock label="Format" value={file.type || 'video/*'} />
              </div>
            ) : (
              <div className="rounded-2xl border border-transparent bg-white/[0.015] p-4 text-sm text-textMuted">
                No file selected yet. Supported formats include MP4, MOV, and MKV.
              </div>
            )}

            <Button className="w-full md:w-auto" onClick={handleUpload} disabled={loading || !file}>
              {loading ? 'Uploading...' : 'Start upload'}
            </Button>
          </Card>
        </SectionReveal>

        <SectionReveal delay={0.05}>
          <Card className="space-y-4 border-white/5 p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="ns-label">Upload status</p>
                <h3 className="mt-1 text-base font-medium text-white md:text-lg">Live progress</h3>
              </div>
              <UploadCloud className="h-5 w-5 text-white/80" />
            </div>

            <div className="rounded-2xl border border-transparent bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-[#E2E2E6]">
                <span>Progress</span>
                <span>{safeProgress}%</span>
              </div>
              <div className="ns-progress-track h-2.5 bg-black/40">
                <div className="ns-progress-fill h-full transition-all bg-brand" style={{ width: `${safeProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-textMuted">Current state: <span className="text-[#E2E2E6]">{step}</span></p>
            </div>

            <div className="rounded-2xl border border-transparent bg-white/[0.015] p-3 text-sm text-textMuted">
              System states: idle, requesting signed URL, uploading, queued, complete, failed.
            </div>

            {createdVideoId ? (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm text-white/90">
                <p className="font-medium text-success">Upload complete. Video record created.</p>
                <p className="mt-1 text-xs text-white/60">ID: {createdVideoId}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/videos/${createdVideoId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-wash px-3 py-1.5 text-xs font-medium text-brand-light transition hover:bg-brand hover:text-white"
                  >
                    View video
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-1 rounded-lg border border-transparent bg-transparent px-3 py-1.5 text-xs font-medium text-[#E2E2E6] transition hover:border-white/20 hover:text-white"
                  >
                    Open library
                  </Link>
                </div>
              </div>
            ) : null}
          </Card>
        </SectionReveal>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-textMuted">{label}</p>
      <p className="truncate text-sm font-medium text-[#E2E2E6]" title={value}>
        {value}
      </p>
    </div>
  );
}

