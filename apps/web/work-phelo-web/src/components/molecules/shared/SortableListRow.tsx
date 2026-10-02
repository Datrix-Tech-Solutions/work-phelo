'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { TableButton } from '@/components/atoms/TableButton';
import { cn } from '@/lib/utils';

const BADGE_COLORS = [
  'bg-amber-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-cyan-500',
];

interface Props {
  id: string;
  index: number;
  label: string;
  sublabel: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableListRow({ id, index, label, sublabel, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 select-none',
        isDragging ? 'opacity-50 shadow-lg z-50' : 'shadow-sm',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Order badge */}
      <span
        className={cn(
          'shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold',
          BADGE_COLORS[index % BADGE_COLORS.length],
        )}
      >
        {index + 1}
      </span>

      {/* Label + sublabel */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-500 truncate">{sublabel}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3.5 shrink-0">
        <TableButton variant="blue" onClick={onEdit} className="inline-flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </TableButton>
        <TableButton variant="red" onClick={onDelete} className="inline-flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </TableButton>
      </div>
    </div>
  );
}
