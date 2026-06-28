import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, MessageSquare, Send, MoreVertical, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * Presentational chat fullscreen surface used by Storybook / Chromatic.
 *
 * Mirrors the layout primitives used by the production chat overlay:
 *   - `fixed inset-0 z-[170]` fullscreen on mobile/tablet
 *   - safe-area padding via `var(--safe-top)` / `var(--safe-bottom)`
 *   - sticky header, scrollable thread, composer pinned to bottom
 *   - "Load older messages" pill at the top of the thread
 *
 * No data hooks, no realtime, no auth — pure visual snapshot target.
 */
export interface ChatFullscreenPreviewProps {
  showLoadMore?: boolean;
  loadingOlder?: boolean;
  messageCount?: number;
  withTypingIndicator?: boolean;
  composerValue?: string;
}

const SAMPLE_AUTHORS = [
  { id: 'me', name: 'You' },
  { id: 'other', name: 'Aanya Sharma' },
] as const;

function buildMessages(count: number) {
  const seeds = [
    'Hey! Just sent the latest mood board.',
    'Loving the direction — the warm palette feels right.',
    'Should we add another reference for the hero shot?',
    'I think so. Let me pull a few from the archive.',
    'Quick note: the deliverables doc is updated.',
    'Got it. Reviewing now.',
    'Also — milestone 2 will land tomorrow morning.',
    'Perfect, thanks for the heads up!',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    senderId: i % 3 === 0 ? 'other' : 'me',
    text: seeds[i % seeds.length],
    time: `${10 + (i % 8)}:${String((i * 7) % 60).padStart(2, '0')}`,
  }));
}

export const ChatFullscreenPreview: React.FC<ChatFullscreenPreviewProps> = ({
  showLoadMore = false,
  loadingOlder = false,
  messageCount = 8,
  withTypingIndicator = false,
  composerValue = '',
}) => {
  const messages = buildMessages(messageCount);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[170] flex flex-col bg-white dark:bg-card overflow-hidden',
        'pt-[var(--safe-top)] pb-[var(--safe-bottom)]'
      )}
      data-testid="chat-fullscreen-preview"
    >
      {/* Sticky header */}
      <header className="flex items-center gap-3 px-3 sm:px-6 py-3 border-b border-muted/20 bg-white/95 dark:bg-card/95 backdrop-blur-xl shrink-0">
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10 rounded-2xl shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-bold">AS</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">Aanya Sharma</p>
          <p className="text-[11px] text-emerald-600 font-semibold">Online</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0" aria-label="Conversation options">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </header>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-background/20">
        <div className="p-4 sm:p-8 space-y-0.5">
          {showLoadMore && (
            <div className="flex justify-center py-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingOlder}
                className="rounded-full px-4 h-8 text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                {loadingOlder ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load older messages'
                )}
              </Button>
            </div>
          )}

          {messages.map((m, idx) => {
            const isOwn = m.senderId === 'me';
            const prev = messages[idx - 1];
            const sameAsPrev = prev && prev.senderId === m.senderId;
            return (
              <div
                key={m.id}
                className={cn(
                  'flex',
                  isOwn ? 'justify-end' : 'justify-start',
                  sameAsPrev ? 'mt-0.5' : 'mt-2'
                )}
              >
                <div
                  className={cn(
                    'px-3.5 py-2 text-[15px] leading-snug max-w-[78%] sm:max-w-[68%]',
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white dark:bg-card text-foreground border border-muted/30'
                  )}
                  style={{ borderRadius: 20 }}
                >
                  {m.text}
                </div>
              </div>
            );
          })}

          {withTypingIndicator && (
            <div className="flex justify-start mt-2">
              <div className="px-4 py-3 rounded-[20px] bg-white dark:bg-card border border-muted/30 flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 pb-[calc(0.75rem+var(--safe-bottom))] bg-white/95 dark:bg-card/95 border-t border-muted/20 backdrop-blur-xl shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-3xl border border-muted/30 bg-background px-4 py-2 text-sm min-h-[40px] flex items-center text-muted-foreground/80">
            {composerValue || 'Message'}
          </div>
          <Button size="icon" className="rounded-full h-10 w-10 shrink-0" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ChatEmptyStatePreview: React.FC = () => (
  <div className="fixed inset-0 z-[170] flex items-center justify-center bg-white dark:bg-card pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
    <div className="text-center space-y-4 px-8">
      <div className="mx-auto p-6 rounded-3xl bg-primary/5 w-fit">
        <MessageSquare className="h-10 w-10 text-primary/40" />
      </div>
      <p className="font-black text-xl">No messages yet</p>
      <p className="text-sm text-muted-foreground/70 max-w-xs">
        Start a conversation by sending a message below.
      </p>
    </div>
  </div>
);
