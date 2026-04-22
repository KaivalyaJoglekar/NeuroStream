'use client';

import { useEffect, useState } from 'react';
import { getTranscripts, TranscriptSegment } from '../../services/cognitive.service';
import { useToast } from '../../hooks/use-toast';
import { Loader2, FileText, Play } from 'lucide-react';

interface VideoTranscriptsProps {
  videoId: string;
  onJumpToTime: (timeSec: number) => void;
}

export function VideoTranscripts({ videoId, onJumpToTime }: VideoTranscriptsProps) {
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pushToast } = useToast();

  useEffect(() => {
    let mounted = true;
    const maxAttempts = 8;
    const retryDelayMs = 3500;

    const shouldRetry = (message?: string) =>
      !!message &&
      /still being indexed|not been indexed|retrying should succeed shortly|appear shortly/i.test(message);

    const fetchTS = async () => {
      try {
        for (let attempt = 1; attempt <= maxAttempts && mounted; attempt += 1) {
          const res = await getTranscripts(videoId);

          if (res.success && res.data) {
            setTranscripts(res.data);
            return;
          }

          if (attempt < maxAttempts && shouldRetry(res.error)) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
            continue;
          }

          pushToast({
            title: 'Transcripts unavailable',
            description: res.error ?? 'MS3 transcript chunks are not available yet.',
            type: 'error',
          });
          return;
        }
      } catch {
        if (mounted) {
          pushToast({
            title: 'Error',
            description: 'Failed to load transcript chunks from MS3.',
            type: 'error',
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void fetchTS();
    return () => { mounted = false; };
  }, [videoId, pushToast]);

  const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-[500px] text-textMuted gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Loading audio transcript from MS3...</p>
          </div>
      );
  }

  if (transcripts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[500px] text-textMuted gap-3">
            <FileText className="w-8 h-8 opacity-50" />
          <p className="text-sm text-center px-6">Audio transcript is not available yet.<br/>Ensure indexing through MS2 and MS3 is completed.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] overflow-y-auto p-4 space-y-2">
      {transcripts.map((ts) => (
         <div 
            key={ts.id} 
            className="group flex gap-3 p-2 rounded hover:bg-elevated/50 transition-colors cursor-pointer"
            onClick={() => onJumpToTime(ts.startSec)}
         >
             <div className="w-12 shrink-0 text-xs text-accent mt-0.5 group-hover:underline flex items-center gap-1">
                 <Play className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                 {formatTime(ts.startSec)}
             </div>
             <p className="text-sm text-textPrimary leading-relaxed">
                 {ts.text}
             </p>
         </div>
      ))}
    </div>
  );
}
