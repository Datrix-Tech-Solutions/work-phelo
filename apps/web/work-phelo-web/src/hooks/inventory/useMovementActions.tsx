'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { downloadCsv } from '@/lib/downloadCsv';
import { MOVEMENT_STATUS_BADGE, MOVEMENT_TYPE_LABEL } from '@/lib/inventoryMovement';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useReversedMovementStore } from '@/hooks/inventory/useReversedMovements';
import { useStockMovementDrafts } from '@/hooks/inventory/useStockMovementDrafts';
import type { StockMovement } from '@/hooks/inventory/useStockMovements';
import { useToast } from '@/hooks/useToast';

/** Only a posted movement can be reversed — not a draft, and not one already reversed. */
export const canReverse = (m: StockMovement) => m.status === 'COMPLETED';

/**
 * Reverse, export and delete-draft for a stock movement, shared by the table and details page.
 * Render `modals` once alongside whatever triggers these. Reverse and draft delete are
 * front-end only: the inventory service has no endpoint for either.
 */
export function useMovementActions() {
  const toast = useToast();
  const { items } = useInventoryItems();
  const { units } = useInventoryUnits();
  const { warehouses } = useInventoryWarehouses();
  const markReversed = useReversedMovementStore((s) => s.markReversed);
  const { deleteDraft } = useStockMovementDrafts();
  const [reverseTarget, setReverseTarget] = useState<StockMovement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockMovement | null>(null);

  const exportMovement = (m: StockMovement) => {
    const warehouse = (id: string | null) =>
      id ? (warehouses.find((w) => w.id === id)?.name ?? '') : '';
    const from = warehouse(m.fromWarehouseId) || m.source || '';
    const rows: (string | number | null)[][] = [
      [
        'Reference',
        'Date',
        'Type',
        'Status',
        'From',
        'To',
        'Item',
        'SKU',
        'Unit',
        'Quantity',
        'Unit Cost',
        'Total Value',
      ],
      ...m.lines.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        const unit = units.find((u) => u.id === item?.unitId);
        return [
          m.reference,
          m.date,
          MOVEMENT_TYPE_LABEL[m.type],
          MOVEMENT_STATUS_BADGE[m.status].label,
          from,
          warehouse(m.toWarehouseId),
          item?.name ?? '',
          item?.sku ?? '',
          unit?.symbol || unit?.name || '',
          l.quantity,
          l.unitCost,
          l.quantity * (l.unitCost ?? 0),
        ];
      }),
    ];
    downloadCsv(`${m.reference}.csv`, rows);
  };

  const modals = (
    <>
      <Modal
        isOpen={reverseTarget !== null}
        onClose={() => setReverseTarget(null)}
        title="Reverse Transaction"
        description={`Mark ${reverseTarget?.reference ?? 'this movement'} as reversed? This is recorded in this browser only and does not put the stock back.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setReverseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!reverseTarget) return;
                markReversed(reverseTarget.id);
                toast.success('Transaction reversed');
                setReverseTarget(null);
              }}
            >
              Reverse
            </Button>
          </div>
        }
      />
      <DeleteInventoryRecordModal
        kind="Draft"
        name={deleteTarget?.reference ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteDraft(deleteTarget.id);
          toast.success('Draft deleted');
          setDeleteTarget(null);
        }}
      />
    </>
  );

  return {
    exportMovement,
    requestReverse: setReverseTarget,
    requestDeleteDraft: setDeleteTarget,
    modals,
  };
}
