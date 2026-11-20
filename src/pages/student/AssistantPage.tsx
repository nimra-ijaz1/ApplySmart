import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ExternalLink, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card } from '../../components/ui/card.tsx';
import { Input } from '../../components/ui/input.tsx';

interface Conversation {
  id: number;
  title: string;
  includeProfileContext: boolean;
  updatedAt: string;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: Array<{ title: string; url: string }>;
  createdAt: string;
}

const PROMPT_SUGGESTIONS = [
  'Which Master’s programmes in Germany or Switzerland fit my profile?',
  'Explain what documents I am missing for my applications.',
  'Compare Chevening vs DAAD EPOS scholarships for Pakistani applicants.',
  'Help me outline a Statement of Purpose for M.Sc. Computer Science.',
];

export function AssistantPage() {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [includeProfile, setIncludeProfile] = useState(true);
  const [input, setInput] = useState('');

  const { data: statusData } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiFetch<{ aiConfigured: boolean }>('/api/ai/status'),
  });

  const { data: convList } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => apiFetch<{ items: Conversation[] }>('/api/ai/conversations'),
  });

  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['ai-messages', activeConvId],
    enabled: activeConvId !== null,
    queryFn: () =>
      apiFetch<{ conversation: Conversation; messages: Message[] }>(
        `/api/ai/conversations/${activeConvId}/messages`
      ),
  });

  useEffect(() => {
    if (!activeConvId && convList?.items && convList.items.length > 0) {
      setActiveConvId(convList.items[0].id);
    }
  }, [convList, activeConvId]);

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      apiFetch<{ conversationId: number; message: Message }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId ?? undefined,
          message: text,
          includeProfileContext: includeProfile,
        }),
      }),
    onSuccess: (res) => {
      setInput('');
      setActiveConvId(res.conversationId);
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['ai-messages', res.conversationId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input.trim());
  };

  const startNewChat = () => {
    setActiveConvId(null);
  };

  const messages = activeConvId ? msgData?.messages ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
            AI Study Abroad Assistant
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Grounded in ApplySmart’s verified university &amp; scholarship database. Citations included.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeProfile}
            onChange={(e) => setIncludeProfile(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>Share my student profile as context</span>
        </label>
      </div>

      {statusData && !statusData.aiConfigured && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            GEMINI_API_KEY is not configured in environment secrets. Non-AI modules remain fully operational; configure the server key to activate AI chat responses.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[640px]">
        {/* Conversations List */}
        <Card className="lg:col-span-4 flex flex-col overflow-hidden p-4 max-h-60 lg:max-h-none">
          <Button type="button" size="sm" className="w-full mb-3" onClick={startNewChat}>
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </Button>
          <div className="flex-1 overflow-y-auto space-y-1">
            {(convList?.items ?? []).map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium truncate cursor-pointer transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {conv.title}
              </button>
            ))}
          </div>
        </Card>

        {/* Chat Thread */}
        <Card className="lg:col-span-8 flex flex-col overflow-hidden min-h-[460px] max-h-[75vh] lg:min-h-0 lg:max-h-none">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && !loadingMsgs ? (
              <div className="h-full flex flex-col justify-center items-center text-center max-w-md mx-auto space-y-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ask about programme requirements, scholarship deadlines, SOP structures, or missing documents.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {PROMPT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMutation.mutate(s)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#0F2942] text-white dark:bg-blue-600'
                        : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-blue-700 dark:text-blue-400">
                      {m.sources.map((src) => (
                        <a
                          key={src.url}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <span>{src.title}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {sendMutation.isPending && (
              <div className="text-xs text-slate-400">Consulting verified database and drafting answer...</div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-slate-200 p-4 flex items-center gap-2 dark:border-slate-800"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about admission requirements, scholarships, or SOP tips..."
              disabled={sendMutation.isPending}
            />
            <Button type="submit" disabled={!input.trim() || sendMutation.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
