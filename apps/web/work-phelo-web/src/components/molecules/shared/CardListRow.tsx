'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { TableButton } from '@/components/atoms/TableButton';

interface Props {
  label: string;
  sublabel?: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardListRow({ label, sublabel, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 truncate">{sublabel}</p>}
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
