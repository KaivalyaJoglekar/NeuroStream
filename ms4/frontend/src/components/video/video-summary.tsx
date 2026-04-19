'use client';

import { useState } from 'react';
import { FileText, Loader2, Play, FileDown } from 'lucide-react';
import {
  exportSummaryPdf,
  SummaryResult,
  summarizeVideo,
} from '../../services/cognitive.service';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';

interface VideoSummaryProps {
  videoId: string;
  onJumpToTime: (timeSec: number) => void;
}

export function VideoSummary({ videoId, onJumpToTime }: VideoSummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const { toast } = useToast();

  const formatTime = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const runSummarization = async () => {
    setIsLoading(true);
    try {
      const response = await summarizeVideo(videoId, 'concise');
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Unable to summarize this video right now.');
      }
      setSummary(response.data);
      toast({ title: 'Summary ready', message: 'MS6 generated a fresh summary for this video.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Summary failed', message });
    } finally {
      setIsLoading(false);
    }
  };

  const exportSummary = async () => {
    if (!summary) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await exportSummaryPdf(summary);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Unable to export summary PDF.');
      }
      window.open(response.data.downloadUrl, '_blank', 'noopener,noreferrer');
      toast({ title: 'Summary export ready', message: 'MS7 generated your summary PDF.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Export failed', message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-[500px] flex-col">
      <div className="border-b border-stroke/50 p-4">
        <div className="mb-2 text-sm text-textMuted">
          Generate map-reduce summary chapters from MS6 and export through MS7.
        </div>
        <div className="flex gap-2">
          <Button onClick={runSummarization} disabled={isLoading} className="flex-1">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Run Video Summary
          </Button>
          <Button variant="outline" onClick={exportSummary} disabled={!summary || isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!summary && !isLoading && (
          <div className="mt-10 text-center text-sm text-textMuted">
            No summary generated yet. Click &quot;Run Video Summary&quot; to call MS6.
          </div>
        )}

        {summary && (
          <>
            <div className="rounded-lg border border-stroke/50 bg-elevated/40 p-3">
              <h4 className="mb-2 text-sm font-semibold">Executive Summary</h4>
              <p className="text-sm leading-relaxed text-textPrimary">{summary.summary}</p>
            </div>

            <div className="space-y-2">
              {summary.chapters.map((chapter, index) => (
                <div key={`${chapter.title}-${index}`} className="rounded-lg border border-stroke/50 bg-elevated/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-accent">
                      {formatTime(chapter.startSec)} - {formatTime(chapter.endSec)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onJumpToTime(chapter.startSec)}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Jump
                    </Button>
                  </div>
                  <h5 className="mb-1 text-sm font-medium">{chapter.title}</h5>
                  <p className="text-sm text-textMuted">{chapter.summary}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
