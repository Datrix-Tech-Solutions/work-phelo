'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
}

interface AnnouncementCardProps {
  announcements: Announcement[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
}

export function AnnouncementCard({
  announcements,
  currentIndex,
  onPrev,
  onNext,
}: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (announcements.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-gray-900">General Announcements</h2>
        </div>
        <div className="h-px bg-gray-100 -mx-5" />
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No announcements yet</p>
        </div>
      </div>
    );
  }

  const announcement = announcements[currentIndex];
  const BODY_LIMIT = 220;
  const isTruncatable = announcement.body.length > BODY_LIMIT;
  const displayBody =
    !expanded && isTruncatable ? announcement.body.slice(0, BODY_LIMIT) + '…' : announcement.body;

  return (
    <div className="bg-white border border-gray-200 rounded-card p-5 flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-gray-900">General Announcements</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium tabular-nums">
            {currentIndex + 1} / {announcements.length}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex === announcements.length - 1}
              className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 -mx-5 mt-4 mb-4 shrink-0" />

      {/* Content */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-2">
        <div className="flex items-start justify-between gap-4 shrink-0">
          <p className="text-sm font-bold text-gray-900 leading-snug">{announcement.title}</p>
          <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap mt-0.5">
            {announcement.date}
          </span>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          {displayBody}
          {isTruncatable && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="ml-1 text-xs font-semibold text-[#0D2244] hover:underline"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
