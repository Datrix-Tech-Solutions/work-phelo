'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useUpdateInventoryItem, type InventoryItem } from '@/hooks/inventory/useInventoryItems';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

interface EditReorderLevelModalProps {
  /** The item whose reorder level is being edited; null while closed. */
  item: InventoryItem | null;
  onClose: () => void;
}

const invalid = (v: string) => v.trim() !== '' && !(Number(v) >= 0);

/** Quick edit of an item's reorder level and maximum stock, without opening the full item form. */
export function EditReorderLevelModal({ item, onClose }: EditReorderLevelModalProps) {
  const toast = useToast();
  const { updateItem, isPending } = useUpdateInventoryItem();
  // The page remounts this modal per item (keyed by item id), so the field starts from the item.
  const [reorderLevel, setReorderLevel] = useState(() => item?.reorderLevel?.toString() ?? '');
  const [maxStock, setMaxStock] = useState(() => item?.maxStock?.toString() ?? '');
  // The maximum can't be below the reorder level.
  const maxError = invalid(maxStock)
    ? 'Must be 0 or more'
    : maxStock.trim() !== '' &&
        reorderLevel.trim() !== '' &&
        Number(maxStock) < Number(reorderLevel)
      ? 'Must be at least the reorder level'
      : undefined;

  const handleSave = async () => {
    if (!item || invalid(reorderLevel) || maxError) return;
    // The service takes the whole item on update, so send it back with the reorder level changed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, currentStock, warehouseIds, ...rest } = item;
    try {
      await updateItem(item.id, {
        ...rest,
        reorderLevel: reorderLevel.trim() === '' ? null : Number(reorderLevel),
        maxStock: maxStock.trim() === '' ? null : Number(maxStock),
      });
      toast.success('Stock levels updated successfully');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not update stock levels'));
    }
  };

  return (
    <Modal
      isOpen={item !== null}
      onClose={onClose}
      title="Edit Reorder Level & Maximum"
      description={
        item
          ? `Set the stock level at which ${item.name} is flagged as low, and the most each warehouse should hold. It currently has ${item.currentStock} in stock.`
          : undefined
      }
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <Input
          label="Reorder Level"
          type="number"
          step="any"
          min={0}
          placeholder="0"
          value={reorderLevel}
          onChange={(e) => setReorderLevel(e.target.value)}
          error={invalid(reorderLevel) ? 'Must be 0 or more' : undefined}
        />
        <Input
          label="Maximum Stock (per warehouse)"
          type="number"
          step="any"
          min={0}
          placeholder="Optional"
          value={maxStock}
          onChange={(e) => setMaxStock(e.target.value)}
          error={maxError}
        />
      </div>
    </Modal>
  );
}
