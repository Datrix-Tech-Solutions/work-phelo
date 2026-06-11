'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Inbox, Mail, MailOpen } from 'lucide-react';
import { usePlacementEmailThread, usePlacementEmailThreads } from '@/hooks';
import { EmailMessage, PlacementEmailThreadSummary, Facultative } from '@/types/reinsurance';
import { cn } from '@/lib/utils';

interface PlacementEmailThreadsTabProps {
  placement: Facultative;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recipientToLabel(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const name =
    typeof record.name === 'string'
      ? record.name
      : typeof record.displayName === 'string'
        ? record.displayName
        : null;
  const email =
    typeof record.email === 'string'
      ? record.email
      : typeof record.address === 'string'
        ? record.address
        : null;

  if (name && email) return `${name} <${email}>`;
  return name ?? email;
}

function recipientsToText(value: unknown): string {
  if (!value) return '—';
  if (Array.isArray(value)) {
    const labels = value.map(recipientToLabel).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : '—';
  }

  const label = recipientToLabel(value);
  return label ?? '—';
}

function participantsSummary(value: unknown): string {
  const text = recipientsToText(value);
  return text === '—' ? 'No participant summary' : text;
}

function messageTimestamp(message: EmailMessage): string {
  return formatDateTime(message.sentAt ?? message.receivedAt);
}

function messageSender(message: EmailMessage): string {
  if (message.fromName && message.fromEmail) {
    return `${message.fromName} <${message.fromEmail}>`;
  }
  return message.fromName ?? message.fromEmail ?? 'Unknown sender';
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <Inbox className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <h3 className="text-sm font-semibold text-gray-900">No linked email threads yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
        Synced mailbox conversations can be linked to this placement from the email workflow. Linked
        threads will appear here as read-only conversations.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" />
        Email threads could not be loaded
      </div>
      <p className="mt-1 text-red-600">{message}</p>
    </div>
  );
}

function ThreadButton({
  thread,
  selected,
  onSelect,
}: {
  thread: PlacementEmailThreadSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border p-4 text-left transition-colors',
        selected
          ? 'border-brand bg-brand/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-950">
            {thread.subject || 'Untitled conversation'}
          </p>
          <p className="mt-1 truncate text-xs text-gray-500">
            {participantsSummary(thread.participants)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
          {thread.messageCount}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
        {thread.latestMessagePreview || 'No preview available.'}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400">
        <span className="truncate">
          {thread.mailbox.displayName ?? thread.mailbox.emailAddress}
        </span>
        <span className="shrink-0">{formatDateTime(thread.latestMessageAt)}</span>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: EmailMessage }) {
  const isOutbound = message.direction === 'OUTBOUND';

  return (
    <article
      className={cn(
        'rounded-2xl border p-4',
        isOutbound ? 'border-blue-100 bg-blue-50/70' : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isOutbound ? (
              <MailOpen className="h-4 w-4 text-blue-500" />
            ) : (
              <Mail className="h-4 w-4 text-gray-500" />
            )}
            <p className="truncate text-sm font-semibold text-gray-950">{messageSender(message)}</p>
          </div>
          <p className="mt-1 text-xs text-gray-500">To: {recipientsToText(message.toRecipients)}</p>
          {recipientsToText(message.ccRecipients) !== '—' && (
            <p className="mt-0.5 text-xs text-gray-500">
              Cc: {recipientsToText(message.ccRecipients)}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-400">{messageTimestamp(message)}</span>
      </div>
      {message.subject && (
        <p className="mt-3 text-sm font-medium text-gray-800">{message.subject}</p>
      )}
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">
        {message.bodyPreview || 'No message preview available.'}
      </p>
    </article>
  );
}

export function PlacementEmailThreadsTab({ placement }: PlacementEmailThreadsTabProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const {
    data: threads = [],
    isLoading: threadsLoading,
    isError: threadsFailed,
    error: threadsError,
  } = usePlacementEmailThreads(placement.id);

  const activeThreadId =
    selectedThreadId && threads.some((thread) => thread.threadId === selectedThreadId)
      ? selectedThreadId
      : (threads[0]?.threadId ?? null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.threadId === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  const {
    data: conversation,
    isLoading: conversationLoading,
    isError: conversationFailed,
    error: conversationError,
  } = usePlacementEmailThread(placement.id, activeThreadId);

  if (threadsLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (threadsFailed) {
    return (
      <ErrorState message={threadsError instanceof Error ? threadsError.message : 'Try again.'} />
    );
  }

  if (threads.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Placement email threads</h3>
            <p className="text-xs text-gray-500">{threads.length} linked conversation(s)</p>
          </div>
        </div>
        <div className="space-y-3">
          {threads.map((thread) => (
            <ThreadButton
              key={thread.linkId}
              thread={thread}
              selected={thread.threadId === activeThreadId}
              onSelect={() => setSelectedThreadId(thread.threadId)}
            />
          ))}
        </div>
      </aside>

      <section className="min-h-[420px] rounded-2xl border border-gray-200 bg-gray-50 p-4">
        {!selectedThread ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Select a conversation to view messages.
          </div>
        ) : conversationLoading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-xl bg-white" />
            <div className="h-32 animate-pulse rounded-xl bg-white" />
            <div className="h-32 animate-pulse rounded-xl bg-white" />
          </div>
        ) : conversationFailed ? (
          <ErrorState
            message={conversationError instanceof Error ? conversationError.message : 'Try again.'}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-gray-950">
                    {conversation?.thread.subject ||
                      selectedThread.subject ||
                      'Untitled conversation'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {participantsSummary(
                      conversation?.thread.participants ?? selectedThread.participants,
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {conversation?.messages.length ?? selectedThread.messageCount} message(s)
                </span>
              </div>
            </div>

            {(conversation?.messages ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                No messages have been synced for this thread yet.
              </div>
            ) : (
              conversation?.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
