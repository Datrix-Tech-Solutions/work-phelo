'use client';

import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/organisms/shared/Modal';
import type { StockMovementType } from '@/hooks/inventory/useStockMovements';

const OPTIONS: {
  type: StockMovementType;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** Tint for the icon tile — matches the type's chip colour on the table. */
  tile: string;
}[] = [
  {
    type: 'STOCK_IN',
    label: 'Stock In',
    tile: 'bg-emerald-100 text-emerald-700',
    description: 'Receive stock into a warehouse',
    icon: <ArrowDownToLine className="w-5 h-5" />,
  },
  {
    type: 'STOCK_OUT',
    label: 'Stock Out',
    tile: 'bg-rose-100 text-rose-700',
    description: 'Issue stock from a warehouse',
    icon: <ArrowUpFromLine className="w-5 h-5" />,
  },
  {
    type: 'TRANSFER',
    label: 'Transfer',
    tile: 'bg-blue-100 text-blue-700',
    description: 'Move stock between warehouses',
    icon: <ArrowLeftRight className="w-5 h-5" />,
  },
  {
    type: 'ADJUSTMENT',
    label: 'Adjustment',
    tile: 'bg-amber-100 text-amber-700',
    description: 'Correct stock after a count',
    icon: <SlidersHorizontal className="w-5 h-5" />,
  },
];

interface StockMovementTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: StockMovementType) => void;
}

export function StockMovementTypeModal({ isOpen, onClose, onSelect }: StockMovementTypeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Stock Movement"
      description="Choose the type of movement to record."
      width="max-w-xl"
    >
      <div className="grid grid-cols-1 gap-3 mt-4 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            type="button"
            onClick={() => onSelect(o.type)}
            className="flex items-center gap-3 rounded-input border border-gray-200 p-4 text-left transition-colors hover:border-brand hover:bg-brand/5"
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                o.tile,
              )}
            >
              {o.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">{o.label}</span>
              <span className="text-xs text-gray-500">{o.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
