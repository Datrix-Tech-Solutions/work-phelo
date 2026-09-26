'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder, User, Building2 } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import type { DocumentFolderKey } from '@/components/organisms/hr/documents/types';

const FOLDERS: { key: DocumentFolderKey; label: string; icon: typeof Folder }[] = [
  { key: 'personal', label: 'Personal Documents', icon: User },
  { key: 'company', label: 'Company Documents', icon: Building2 },
];

const EDGE_GAP = 8;

interface Props {
  active: DocumentFolderKey;
  onSelect: (folder: DocumentFolderKey) => void;
  counts: Record<DocumentFolderKey, number>;
  /** Narrows to an icon-only rail (tooltip on hover) — used to give the
   *  preview panel room once a document is selected. */
  collapsed?: boolean;
}

export function DocumentFoldersRail({ active, onSelect, counts, collapsed = false }: Props) {
  const [hovered, setHovered] = useState<DocumentFolderKey | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRefs = useRef<Partial<Record<DocumentFolderKey, HTMLButtonElement | null>>>({});

  const handleMouseEnter = (key: DocumentFolderKey) => {
    if (!collapsed) return;
    const el = buttonRefs.current[key];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + EDGE_GAP });
    setHovered(key);
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setTooltipPos(null);
  };

  return (
    <div
      className={cardClass(
        cn(
          'shrink-0 p-2 flex gap-1 transition-[width] duration-200',
          collapsed ? 'w-full lg:w-14 flex-row lg:flex-col' : 'w-full lg:w-56 flex-row lg:flex-col',
        ),
      )}
    >
      {FOLDERS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            ref={(el) => {
              buttonRefs.current[key] = el;
            }}
            type="button"
            onClick={() => onSelect(key)}
            onMouseEnter={() => handleMouseEnter(key)}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'relative flex-1 lg:flex-none flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors',
              collapsed ? 'justify-center px-0' : 'gap-2.5',
              isActive
                ? 'bg-(--module-btn-bg,var(--color-brand)) text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0 truncate">{label}</span>
                <span
                  className={cn(
                    'text-xs font-semibold rounded-full px-1.5 py-0.5 shrink-0',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {counts[key]}
                </span>
              </>
            )}
          </button>
        );
      })}

      {collapsed &&
        hovered &&
        tooltipPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            style={{
              position: 'fixed',
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: 'translateY(-50%)',
              zIndex: 9999,
            }}
            className="pointer-events-none whitespace-nowrap rounded-lg bg-(--chip-dark,#111827) px-2 py-1 text-xs font-medium text-white shadow-lg"
          >
            {FOLDERS.find((f) => f.key === hovered)?.label} · {counts[hovered]}
          </span>,
          document.body,
        )}
    </div>
  );
}
