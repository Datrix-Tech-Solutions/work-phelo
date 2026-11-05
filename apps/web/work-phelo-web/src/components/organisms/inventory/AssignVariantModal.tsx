'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import {
  useAssignVariant,
  useItemVariants,
  useVariantBalances,
} from '@/hooks/inventory/useItemVariants';
import { useStockPositions } from '@/hooks/inventory/useStockBalances';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface AssignVariantModalProps {
  itemId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Counts stock the item held before it had variants (its "No variant" stock) as one of its
 * variants. The item's total doesn't change; the movement history records both sides.
 */
export function AssignVariantModal({ itemId, isOpen, onClose }: AssignVariantModalProps) {
  const toast = useToast();
  const { warehouses } = useInventoryWarehouses();
  const { variants } = useItemVariants();
  const { balances } = useVariantBalances();
  const { positions } = useStockPositions();
  const { assignVariant, isPending } = useAssignVariant();
  const [warehouseId, setWarehouseId] = useState('');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [showErrors, setShowErrors] = useState(false);

  const close = () => {
    setWarehouseId('');
    setVariant('');
    setQuantity(0);
    setShowErrors(false);
    onClose();
  };

  // Stock in each warehouse that no variant accounts for.
  const unassigned = useMemo(() => {
    const result = new Map<string, number>();
    for (const [locationId, onHand] of positions.get(itemId) ?? []) {
      const tagged = balances
        .filter((b) => b.itemId === itemId && b.locationId === locationId)
        .reduce((n, b) => n + b.quantity, 0);
      if (onHand - tagged > 0) result.set(locationId, onHand - tagged);
    }
    return result;
  }, [positions, balances, itemId]);

  const warehouseOptions = warehouses
    .filter((w) => unassigned.has(w.id))
    .map((w) => ({
      value: w.id,
      label: w.name,
      sublabel: `${unassigned.get(w.id)} without a variant`,
    }));
  const variantOptions = variants
    .filter((v) => v.itemId === itemId && v.status === 'ACTIVE')
    .map((v) => ({ value: v.name, label: v.name }));
  const max = unassigned.get(warehouseId) ?? 0;

  const quantityError = !warehouseId
    ? undefined
    : quantity <= 0
      ? 'Enter a quantity'
      : quantity > max
        ? `Only ${max} without a variant`
        : undefined;

  const save = async () => {
    setShowErrors(true);
    if (!warehouseId || !variant || quantityError) return;
    try {
      await assignVariant({ itemId, locationId: warehouseId, variant, quantity });
    } catch (err) {
      toast.error(extractError(err, 'Could not assign the variant'));
      return;
    }
    toast.success(`${quantity} assigned to ${variant}`);
    close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Assign to Variant"
      description="Count stock the item held without a variant as one of its variants. The item's total stock doesn't change."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Assigning…" onClick={save}>
            Assign
          </Button>
        </div>
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        <SearchSelect
          label="Warehouse"
          placeholder="Select warehouse…"
          options={warehouseOptions}
          value={warehouseId}
          onChange={(v) => {
            setWarehouseId(v);
            setQuantity(0);
          }}
          error={showErrors && !warehouseId ? 'Select a warehouse' : undefined}
        />
        <SearchSelect
          label="Variant"
          placeholder={variantOptions.length ? 'Select variant…' : 'No variants'}
          options={variantOptions}
          value={variant}
          onChange={setVariant}
          error={showErrors && !variant ? 'Select a variant' : undefined}
        />
        <div className="flex flex-col gap-1">
          <NumberField
            label="Quantity"
            value={quantity}
            onChange={setQuantity}
            decimals={4}
            disabled={!warehouseId}
            error={showErrors ? quantityError : undefined}
          />
          {warehouseId && <span className="text-xs text-gray-500">Max: {max}</span>}
        </div>
      </div>
    </Modal>
  );
}
