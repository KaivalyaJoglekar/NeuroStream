'use client';

import { useState } from 'react';
import { Card } from '../ui/card';
import { Bot, Search, FileText, BookOpen, FlaskConical, Activity } from 'lucide-react';
import { AgenticChat } from './agentic-chat';
import { SemanticSearch } from './semantic-search';
import { VideoTranscripts } from './video-transcripts';
import { VideoSummary } from './video-summary';
import { VideoResearch } from './video-research';
import { ServiceHealthPanel } from './service-health';

interface CognitivePanelProps {
  videoId: string;
  onJumpToTime: (timeSec: number) => void;
  searchableReady: boolean;
  currentStatus: string;
}

type TabType = 'chat' | 'search' | 'transcripts' | 'summary' | 'research' | 'health';

export function CognitivePanel({ videoId, onJumpToTime, searchableReady, currentStatus }: CognitivePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const featureLocked = !searchableReady;

  const setTabIfAllowed = (tab: TabType) => {
    if (featureLocked && tab !== 'health') {
      return;
    }
    setActiveTab(tab);
  };

  return (
    <Card className="flex flex-col overflow-hidden p-0 h-full">
      <div className="flex overflow-x-auto border-b border-stroke/50 bg-elevated/20">
        <TabButton 
           active={activeTab === 'chat'} 
           onClick={() => setTabIfAllowed('chat')}
           icon={<Bot className="w-4 h-4" />} 
           label="Agentic Brain" 
           disabled={featureLocked}
        />
        <TabButton 
           active={activeTab === 'search'} 
           onClick={() => setTabIfAllowed('search')}
           icon={<Search className="w-4 h-4" />} 
           label="Vector Search" 
           disabled={featureLocked}
        />
        <TabButton 
           active={activeTab === 'transcripts'} 
           onClick={() => setTabIfAllowed('transcripts')}
           icon={<FileText className="w-4 h-4" />} 
           label="Transcripts" 
           disabled={featureLocked}
        />
          <TabButton
            active={activeTab === 'summary'}
            onClick={() => setTabIfAllowed('summary')}
            icon={<BookOpen className="w-4 h-4" />}
            label="Summary"
            disabled={featureLocked}
          />
          <TabButton
            active={activeTab === 'research'}
            onClick={() => setTabIfAllowed('research')}
            icon={<FlaskConical className="w-4 h-4" />}
            label="Research"
            disabled={featureLocked}
          />
          <TabButton
            active={activeTab === 'health'}
            onClick={() => setTabIfAllowed('health')}
            icon={<Activity className="w-4 h-4" />}
            label="Services"
          />
      </div>

      <div className="flex-1 bg-[#0a0a0a]">
         {featureLocked && activeTab !== 'health' ? (
           <div className="flex h-[500px] flex-col items-center justify-center gap-3 px-6 text-center text-textMuted">
             <Activity className="h-8 w-8 opacity-60" />
             <p className="text-sm font-medium text-textPrimary">Cognitive tools unlock after MS3 indexing completes.</p>
             <p className="max-w-sm text-sm">
               Current video status: <span className="text-textPrimary">{currentStatus.replaceAll('_', ' ')}</span>.
               Waiting avoids premature chat/search requests against incomplete transcript data.
             </p>
           </div>
         ) : null}
         {!featureLocked && activeTab === 'chat' && <AgenticChat videoId={videoId} />}
         {!featureLocked && activeTab === 'search' && <SemanticSearch videoId={videoId} onJumpToTime={onJumpToTime} />}
         {!featureLocked && activeTab === 'transcripts' && <VideoTranscripts videoId={videoId} onJumpToTime={onJumpToTime} />}
          {!featureLocked && activeTab === 'summary' && <VideoSummary videoId={videoId} onJumpToTime={onJumpToTime} />}
          {!featureLocked && activeTab === 'research' && <VideoResearch videoId={videoId} />}
          {activeTab === 'health' && <ServiceHealthPanel />}
      </div>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled = false,
}: {
  active: boolean,
  onClick: () => void,
  icon: React.ReactNode,
  label: string,
  disabled?: boolean,
}) {
    return (
        <button
           onClick={onClick}
            disabled={disabled}
            className={`min-w-[120px] flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
               active 
               ? 'text-accent border-accent bg-elevated/30' 
               : disabled
                 ? 'text-textMuted/40 border-transparent cursor-not-allowed'
                 : 'text-textMuted border-transparent hover:text-textPrimary hover:bg-elevated/10'
           }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}
