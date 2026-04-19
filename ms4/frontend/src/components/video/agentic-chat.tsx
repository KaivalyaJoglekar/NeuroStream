'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, FileDown, Bot, User, Loader2 } from 'lucide-react';
import { chatInference, triggerPdfExport, ChatMessage } from '../../services/cognitive.service';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/use-toast';

interface AgenticChatProps {
  videoId: string;
}

export function AgenticChat({ videoId }: AgenticChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your AI assistant for this video. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatInference(videoId, userMessage.content, messages);
      if (response.success && response.data) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.data!.reply }]);
      } else {
        throw new Error(response.error || response.message || 'Failed to get response');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect to AI Brain.';
      toast({ title: 'Error', message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const resp = await triggerPdfExport(videoId, messages);
      if (resp.success && resp.data) {
        window.open(resp.data.downloadUrl, '_blank', 'noopener,noreferrer');
        toast({ title: 'PDF Export Ready', message: 'MS7 generated your report and opened the download link.' });
      } else {
        toast({ title: 'Export failed', message: resp.error || 'MS7 export endpoint could not be reached.' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      toast({ title: 'Export failed', message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`p-2 rounded-full shrink-0 ${msg.role === 'user' ? 'bg-accent/20 text-accent' : 'bg-elevated text-textMuted'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`text-sm py-2 px-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-elevated text-textPrimary rounded-bl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="p-2 rounded-full shrink-0 bg-elevated text-textMuted"><Bot className="w-4 h-4" /></div>
             <div className="text-sm py-2 px-3 rounded-2xl bg-elevated text-textMuted flex items-center gap-2">
               Thinking <Loader2 className="w-3 h-3 animate-spin"/>
             </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
      
      <div className="p-3 border-t border-stroke/50 bg-elevated/30">
        <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask something about this video..." 
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} title="Send prompt">
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <Button 
          variant="outline" 
          onClick={handleExport} 
          disabled={isExporting || messages.length < 2} 
          className="w-full text-xs py-1 h-auto text-textMuted hover:text-white"
        >
          {isExporting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileDown className="w-3 h-3 mr-2" />}
          Generate Session PDF Report
        </Button>
      </div>
    </div>
  );
}
