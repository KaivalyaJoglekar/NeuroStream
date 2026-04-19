'use client';

import { useState } from 'react';
import { Search, Play, Loader2 } from 'lucide-react';
import { searchVideo, SearchResult } from '../../services/cognitive.service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../hooks/use-auth';
import { trackVideoEvent } from '../../services/video.service';

interface SemanticSearchProps {
  videoId: string;
  onJumpToTime: (timeSec: number) => void;
}

export function SemanticSearch({ videoId, onJumpToTime }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
        const response = await searchVideo(videoId, query);
        if (response.success && response.data) {
           setResults(response.data);
           setHasSearched(true);

            const topHitTimestamp = response.data[0]?.timestampSec ?? 0;
            void trackVideoEvent(videoId, {
             eventType: 'SEARCH',
             timestampSec: topHitTimestamp,
             queryText: query,
             sessionId: user ? `ms4-web-${user.id}` : undefined,
            });
        } else {
           setResults([]);
           setHasSearched(true);
            toast({ title: 'Search unavailable', message: response.error ?? 'MS3 search endpoint did not return results.' });
        }
    } catch {
        toast({ title: 'Search Failed', message: 'Could not connect to MS3 Vector db.'});
    } finally {
        setIsLoading(false);
    }
  };

  const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="p-4 border-b border-stroke/50">
        <form onSubmit={handleSearch} className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-textMuted" />
             <Input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by concept (e.g., 'database transaction')"
                className="pl-9"
             />
           </div>
           <Button type="submit" disabled={isLoading || !query.trim()}>
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
           </Button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {!hasSearched && results.length === 0 && (
             <div className="text-center text-textMuted mt-10 text-sm">
                 Enter a concept above. The AI will find the exact timestamps matching the semantic meaning.
             </div>
         )}
         {hasSearched && results.length === 0 && (
             <div className="text-center text-textMuted mt-10 text-sm">
                 No closely related concepts found in this video.
             </div>
         )}
         {results.map((res) => (
             <div key={res.id} className="p-3 rounded-lg border border-stroke/50 bg-elevated/40 hover:bg-elevated/80 transition-colors">
                 <div className="flex items-start justify-between mb-2">
                     <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                        {formatTime(res.timestampSec)}
                     </span>
                     <span className="text-[10px] text-textMuted">Match: {(res.score * 100).toFixed(0)}%</span>
                 </div>
                 <p className="text-sm text-textPrimary leading-relaxed">&quot;{res.text}&quot;</p>
                 <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3 flex items-center justify-center h-7 text-xs"
                    onClick={() => onJumpToTime(res.timestampSec)}
                 >
                     <Play className="w-3 h-3 mr-1" /> Jump to video
                 </Button>
             </div>
         ))}
      </div>
    </div>
  );
}
