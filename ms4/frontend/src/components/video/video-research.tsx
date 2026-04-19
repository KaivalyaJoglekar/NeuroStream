'use client';

import { useState } from 'react';
import { Brain, Loader2, FileDown } from 'lucide-react';
import {
  exportResearchPdf,
  ResearchResult,
  runResearch,
} from '../../services/cognitive.service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/use-toast';

interface VideoResearchProps {
  videoId: string;
}

export function VideoResearch({ videoId }: VideoResearchProps) {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [lockedTopic, setLockedTopic] = useState('');
  const { pushToast } = useToast();

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topic.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await runResearch(topic.trim(), [videoId]);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Unable to run research right now.');
      }
      setResult(response.data);
      setLockedTopic(topic.trim());
      pushToast({
        title: 'Research complete',
        description: 'MS6 finished the deep research run.',
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      pushToast({ title: 'Research failed', description: message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!result || !lockedTopic) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await exportResearchPdf(lockedTopic, result);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Unable to export research PDF.');
      }
      window.open(response.data.downloadUrl, '_blank', 'noopener,noreferrer');
      pushToast({
        title: 'Research export ready',
        description: 'MS7 generated your research PDF.',
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      pushToast({ title: 'Export failed', description: message, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-[500px] flex-col">
      <div className="border-b border-stroke/50 p-4">
        <form onSubmit={run} className="space-y-2">
          <Input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Research topic (e.g. risk tradeoffs in this architecture)"
            disabled={isLoading}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !topic.trim()} className="flex-1">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Run Research
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!result || isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Export PDF
            </Button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!result && !isLoading && (
          <div className="mt-10 text-center text-sm text-textMuted">
            Enter a topic to run MS6 research on this video.
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="rounded-lg border border-stroke/50 bg-elevated/40 p-3 text-xs text-textMuted">
              Sources used: {result.sourcesUsed} | Videos analyzed: {result.videosAnalyzed} | Iterations: {result.iterationsTaken}
            </div>
            <div className="rounded-lg border border-stroke/50 bg-elevated/40 p-3">
              <h4 className="mb-2 text-sm font-semibold">Research Report</h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-textPrimary">{result.report}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
