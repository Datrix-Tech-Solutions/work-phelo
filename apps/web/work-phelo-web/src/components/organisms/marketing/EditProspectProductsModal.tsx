'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  ProductServiceForm,
  ProductServiceRow,
} from '@/components/molecules/marketing/ProductServiceForm';
import { isCompleteRow } from '@/components/organisms/marketing/ProspectWizard';
import { useProspectingSettings } from '@/hooks/marketing/useProspectingSettings';
import { useUpdateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import type { ProspectDetailProduct } from '@/types/marketing';

interface Props {
  prospectId: string;
  prospectName: string;
  products: ProspectDetailProduct[];
  isOpen: boolean;
  onClose: () => void;
}

function toRows(products: ProspectDetailProduct[]): ProductServiceRow[] {
  return products.map((p) => ({
    // The association id doubles as the row id so edits are sent back as updates.
    id: p.id,
    productType: p.product.id,
    expectedRevenue: p.expectedValue,
    achievedRevenue: p.achievedValue ?? '',
    expectedCloseDate: p.expectedCloseDate ? p.expectedCloseDate.slice(0, 10) : '',
    commissionRate: p.commissionRate != null ? String(Number(p.commissionRate)) : '',
  }));
}

export function EditProspectProductsModal({
  prospectId,
  prospectName,
  products,
  isOpen,
  onClose,
}: Props) {
  const toast = useToast();
  const updateProspect = useUpdateProspect(prospectId);
  const { data: productSettings = [] } = useProspectingSettings('products');
  const [rows, setRows] = useState<ProductServiceRow[]>(() => toRows(products));

  const options = useMemo(
    () => productSettings.map((p) => ({ value: p.id, label: p.name })),
    [productSettings],
  );
  const complete = rows.filter(isCompleteRow);

  function handleSave() {
    const existingIds = new Set(products.map((p) => p.id));
    updateProspect.mutate(
      {
        // The full desired set: existing rows are updated, new ones added, removed ones dropped.
        products: complete.map((row) => ({
          ...(existingIds.has(row.id) ? { id: row.id } : {}),
          productId: row.productType,
          expectedValue: Number(row.expectedRevenue),
          achievedValue: row.achievedRevenue.trim() !== '' ? Number(row.achievedRevenue) : null,
          expectedCloseDate: row.expectedCloseDate || null,
          commissionRate: row.commissionRate?.trim() ? Number(row.commissionRate) : null,
        })),
      },
      {
        onSuccess: () => {
          toast.success('Products updated');
          onClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update products')),
      },
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Products / Services"
      description={prospectName}
      width="max-w-7xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            At least one product with an expected revenue is required.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={updateProspect.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={complete.length === 0}
              isLoading={updateProspect.isPending}
              loadingText="Saving…"
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <ProductServiceForm
        rows={rows}
        onChange={setRows}
        productTypeOptions={options}
        showCommission
      />
    </Modal>
  );
}
