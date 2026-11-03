'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { useUpdateInventoryItem, type InventoryItem } from '@/hooks/inventory/useInventoryItems';
import { INVENTORY_CURRENCY } from '@/lib/inventoryCurrency';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

interface EditItemValueModalProps {
  /** The item whose prices are being edited; null while closed. */
  item: InventoryItem | null;
  onClose: () => void;
}

const optionalNumber = (v: string) => (v.trim() === '' ? null : Number(v));
const invalid = (v: string) => v.trim() !== '' && !(Number(v) >= 0);

/** Quick edit of an item's purchase cost and selling price, without opening the full item form. */
export function EditItemValueModal({ item, onClose }: EditItemValueModalProps) {
  const toast = useToast();
  const { updateItem, isPending } = useUpdateInventoryItem();
  // The page remounts this modal per item (keyed by item id), so the fields start from the item.
  const [costPrice, setCostPrice] = useState(() => item?.costPrice?.toString() ?? '');
  const [sellingPrice, setSellingPrice] = useState(() => item?.sellingPrice?.toString() ?? '');

  const handleSave = async () => {
    if (!item || invalid(costPrice) || invalid(sellingPrice)) return;
    // The service takes the whole item on update, so send it back with the two prices changed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, currentStock, warehouseIds, ...rest } = item;
    try {
      await updateItem(item.id, {
        ...rest,
        costPrice: optionalNumber(costPrice),
        sellingPrice: optionalNumber(sellingPrice),
      });
      toast.success('Value updated successfully');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not update value'));
    }
  };

  return (
    <Modal
      isOpen={item !== null}
      onClose={onClose}
      title="Edit Value"
      description={item ? `Update the prices of ${item.name}.` : undefined}
      width="max-w-lg"
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
      <div className="flex flex-col gap-4 mt-4 sm:flex-row">
        <div className="flex-1 min-w-0">
          <CurrencyInput
            label="Purchase Cost"
            value={costPrice}
            currency={INVENTORY_CURRENCY}
            lockCurrency
            onValueChange={setCostPrice}
            error={invalid(costPrice) ? 'Must be 0 or more' : undefined}
          />
        </div>
        <div className="flex-1 min-w-0">
          <CurrencyInput
            label="Selling Price"
            value={sellingPrice}
            currency={INVENTORY_CURRENCY}
            lockCurrency
            onValueChange={setSellingPrice}
            error={invalid(sellingPrice) ? 'Must be 0 or more' : undefined}
          />
        </div>
      </div>
    </Modal>
  );
}
