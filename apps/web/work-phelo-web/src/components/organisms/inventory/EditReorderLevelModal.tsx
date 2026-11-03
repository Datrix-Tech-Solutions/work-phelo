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

/** Quick edit of an item's reorder level, without opening the full item form. */
export function EditReorderLevelModal({ item, onClose }: EditReorderLevelModalProps) {
  const toast = useToast();
  const { updateItem, isPending } = useUpdateInventoryItem();
  // The page remounts this modal per item (keyed by item id), so the field starts from the item.
  const [reorderLevel, setReorderLevel] = useState(() => item?.reorderLevel?.toString() ?? '');

  const handleSave = async () => {
    if (!item || invalid(reorderLevel)) return;
    // The service takes the whole item on update, so send it back with the reorder level changed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, currentStock, warehouseIds, ...rest } = item;
    try {
      await updateItem(item.id, {
        ...rest,
        reorderLevel: reorderLevel.trim() === '' ? null : Number(reorderLevel),
      });
      toast.success('Reorder level updated successfully');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not update reorder level'));
    }
  };

  return (
    <Modal
      isOpen={item !== null}
      onClose={onClose}
      title="Edit Reorder Level"
      description={
        item
          ? `Set the stock level at which ${item.name} is flagged as low. It currently has ${item.currentStock} in stock.`
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
      <div className="mt-4">
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
      </div>
    </Modal>
  );
}
