'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { Input } from '@/components/atoms/Input';
import { formatMoney } from '@/lib/formatMoney';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useAddClientProduct } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface Props {
  clientId: string;
  clientName: string;
  /** Product ids the client already has — they're left out of the picker. */
  existingProductIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function AddClientProductModal({
  clientId,
  clientName,
  existingProductIds,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const addProduct = useAddClientProduct(clientId);
  const { data: products = [], isLoading } = useProspectingSettings('products');
  const [productId, setProductId] = useState('');
  const [expectedRevenue, setExpectedRevenue] = useState('');
  const [commissionRate, setCommissionRate] = useState('');

  const expected = parseFloat(expectedRevenue);
  const rate = parseFloat(commissionRate);
  const commission =
    Number.isFinite(expected) && Number.isFinite(rate)
      ? Math.round(((expected * rate) / 100 + Number.EPSILON) * 100) / 100
      : null;

  const options = useMemo(
    () =>
      products
        .filter((p) => !existingProductIds.includes(p.id))
        .map((p) => ({ value: p.id, label: p.name })),
    [products, existingProductIds],
  );

  function handleSave() {
    addProduct.mutate(
      {
        productId,
        ...(Number.isFinite(expected) ? { expectedValue: expected } : {}),
        ...(Number.isFinite(rate) ? { commissionRate: rate } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Product added');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add product')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Product / Service"
      description={`${clientName} — it starts as pending.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={addProduct.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!productId}
            isLoading={addProduct.isPending}
            loadingText="Adding…"
          >
            Add
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchSelect
          label="Product / Service"
          placeholder={isLoading ? 'Loading products...' : 'Select product or service'}
          options={options}
          value={productId}
          onChange={setProductId}
          disabled={isLoading}
        />
        <CurrencyInput
          label="Expected Revenue"
          currency="GHS"
          lockCurrency
          value={expectedRevenue}
          onValueChange={setExpectedRevenue}
        />
        <Input
          label="Commission Rate"
          type="number"
          min={0}
          max={100}
          step="any"
          placeholder="0"
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          rightElement={<span className="text-sm text-gray-400">%</span>}
        />
        {commission !== null && (
          <p className="text-sm text-gray-600">
            Commission: <span className="font-semibold">{formatMoney(commission)}</span>
          </p>
        )}
      </div>
    </Modal>
  );
}
