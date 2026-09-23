import { Folder, User, Building2 } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import type { DocumentFolderKey } from '@/components/organisms/hr/documents/types';

const FOLDERS: { key: DocumentFolderKey; label: string; icon: typeof Folder }[] = [
  { key: 'personal', label: 'Personal Documents', icon: User },
  { key: 'company', label: 'Company Documents', icon: Building2 },
];

interface Props {
  active: DocumentFolderKey;
  onSelect: (folder: DocumentFolderKey) => void;
  counts: Record<DocumentFolderKey, number>;
}

export function DocumentFoldersRail({ active, onSelect, counts }: Props) {
  return (
    <div className={cardClass('w-full lg:w-56 shrink-0 p-2 flex lg:flex-col gap-1')}>
      {FOLDERS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'flex-1 lg:flex-none flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors',
              isActive
                ? 'bg-(--module-btn-bg,var(--color-brand)) text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0 truncate">{label}</span>
            <span
              className={cn(
                'text-xs font-semibold rounded-full px-1.5 py-0.5 shrink-0',
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500',
              )}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
