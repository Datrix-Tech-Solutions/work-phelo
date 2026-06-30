'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { InvoiceDetailsSection } from '@/components/molecules/accounting/InvoiceDetailsSection';
import { InvoiceLineDetailsSection } from '@/components/molecules/accounting/InvoiceLineDetailsSection';
import { InvoiceFormValues, INVOICE_DEFAULTS } from '@/types/accounting';
import { Icons } from '@/components/atoms/icons';

interface NewInvoiceFormProps {
  onCancel: () => void;
  vendorLabel?: string;
}

export function NewInvoiceForm({ onCancel, vendorLabel }: NewInvoiceFormProps) {
  const form = useForm<InvoiceFormValues>({ defaultValues: INVOICE_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);

  const onSubmit = () => {
    // TODO: call create invoice mutation
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <InvoiceDetailsSection form={form} vendorLabel={vendorLabel} />
        </div>

        <InvoiceLineDetailsSection form={form} />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowCancelModal(true)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Icons.Save className="w-4 h-4" />}
            onClick={form.handleSubmit(onSubmit)}
          >
            Save as Draft
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)}>Submit for Approval</Button>
        </div>
      </div>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Entry"
        description="Are you sure you want to cancel the invoice creation?"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Go Back
            </Button>
            <Button variant="danger" onClick={onCancel}>
              Yes, Cancel
            </Button>
          </>
        }
      />
    </>
  );
}
