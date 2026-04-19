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
}

type TabType = 'chat' | 'search' | 'transcripts' | 'summary' | 'research' | 'health';

export function CognitivePanel({ videoId, onJumpToTime }: CognitivePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  return (
    <Card className="flex flex-col overflow-hidden p-0 h-full">
      <div className="flex overflow-x-auto border-b border-stroke/50 bg-elevated/20">
        <TabButton 
           active={activeTab === 'chat'} 
           onClick={() => setActiveTab('chat')} 
           icon={<Bot className="w-4 h-4" />} 
           label="Agentic Brain" 
        />
        <TabButton 
           active={activeTab === 'search'} 
           onClick={() => setActiveTab('search')} 
           icon={<Search className="w-4 h-4" />} 
           label="Vector Search" 
        />
        <TabButton 
           active={activeTab === 'transcripts'} 
           onClick={() => setActiveTab('transcripts')} 
           icon={<FileText className="w-4 h-4" />} 
           label="Transcripts" 
        />
          <TabButton
            active={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            icon={<BookOpen className="w-4 h-4" />}
            label="Summary"
          />
          <TabButton
            active={activeTab === 'research'}
            onClick={() => setActiveTab('research')}
            icon={<FlaskConical className="w-4 h-4" />}
            label="Research"
          />
          <TabButton
            active={activeTab === 'health'}
            onClick={() => setActiveTab('health')}
            icon={<Activity className="w-4 h-4" />}
            label="Services"
          />
      </div>

      <div className="flex-1 bg-[#0a0a0a]">
         {activeTab === 'chat' && <AgenticChat videoId={videoId} />}
         {activeTab === 'search' && <SemanticSearch videoId={videoId} onJumpToTime={onJumpToTime} />}
         {activeTab === 'transcripts' && <VideoTranscripts videoId={videoId} onJumpToTime={onJumpToTime} />}
          {activeTab === 'summary' && <VideoSummary videoId={videoId} onJumpToTime={onJumpToTime} />}
          {activeTab === 'research' && <VideoResearch videoId={videoId} />}
          {activeTab === 'health' && <ServiceHealthPanel />}
      </div>
    </Card>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
           onClick={onClick}
            className={`min-w-[120px] flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
               active 
               ? 'text-accent border-accent bg-elevated/30' 
               : 'text-textMuted border-transparent hover:text-textPrimary hover:bg-elevated/10'
           }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}
