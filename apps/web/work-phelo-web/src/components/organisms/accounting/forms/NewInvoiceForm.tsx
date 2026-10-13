'use client';

import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { InvoiceDetailsSection } from '@/components/molecules/accounting/InvoiceDetailsSection';
import { InvoiceLineDetailsSection } from '@/components/molecules/accounting/InvoiceLineDetailsSection';
import {
  DocAdjustmentRow,
  docAdjustmentAmount,
  DocumentAdjustments,
  summarizeDocAdjustments,
} from '@/components/organisms/accounting/panels/DocumentAdjustments';
import { SearchSelectOption } from '@/components/atoms/SearchSelect';
import { AccountingTradeSide, InvoiceFormValues, INVOICE_DEFAULTS } from '@/types/accounting';
import {
  useCreatePayableBill,
  useCreateReceivableInvoice,
  useGLAccountOptions,
  useSubledgers,
  useTaxTypes,
  useTransactionTypeRules,
} from '@/hooks';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface NewInvoiceFormProps {
  onCancel: () => void;
  onCreated: () => void;
  side: AccountingTradeSide;
  vendorLabel?: string;
}

export function NewInvoiceForm({ onCancel, onCreated, side, vendorLabel }: NewInvoiceFormProps) {
  const toast = useToast();
  const isReceivable = side === 'RECEIVABLE';
  const partyLabel = vendorLabel ?? (isReceivable ? 'Customer' : 'Vendor');

  const form = useForm<InvoiceFormValues>({ defaultValues: INVOICE_DEFAULTS });
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Taxes, deductions and charges are added here, as on a direct payment. A rule made before
  // that may still name an account for a tax, which is then offered first.
  const [adjustments, setAdjustments] = useState<DocAdjustmentRow[]>([]);
  const { data: taxTypes = [] } = useTaxTypes();
  const { data: rules = [] } = useTransactionTypeRules();
  const { options: accountOptions, isLoading: isLoadingAccounts } = useGLAccountOptions();
  const watchedLines = useWatch({ control: form.control, name: 'lines' });
  const transactionTypeId = useWatch({ control: form.control, name: 'transactionTypeId' });
  const invoiceDate = useWatch({ control: form.control, name: 'invoiceDate' });
  const currency = useWatch({ control: form.control, name: 'currency' });
  const subtotal = (watchedLines ?? []).reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0,
  );
  const ruleTaxAccounts = useMemo(
    () =>
      new Map(
        (rules.find((r) => r.transactionTypeId === transactionTypeId)?.lines ?? [])
          .filter((line) => line.taxType && !line.settlementKind && line.account)
          .map((line) => [line.taxType!.id, line.account!.id] as const),
      ),
    [rules, transactionTypeId],
  );

  // Any active entity can be picked here — the Transaction Type decides whether the
  // resulting document is Receivable or Payable, not the entity itself.
  const { data: entities, isLoading: isLoadingParties } = useSubledgers({ status: 'ACTIVE' });
  const parties = entities ?? [];
  const partyOptions: SearchSelectOption[] = parties.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
  }));

  const createInvoice = useCreateReceivableInvoice();
  const createBill = useCreatePayableBill();
  const isPending = isReceivable ? createInvoice.isPending : createBill.isPending;

  const onSubmit = async (data: InvoiceFormValues) => {
    const subtotalAmount = data.lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0,
    );

    if (subtotalAmount <= 0) {
      toast.error('Add at least one line with a quantity and unit price.');
      return;
    }
    if (!data.transactionTypeId) {
      toast.error('Select a transaction type.');
      return;
    }

    for (const row of adjustments) {
      if (row.kind === 'TAX' && !row.taxTypeId) {
        toast.error('Select the tax on every tax line.');
        return;
      }
      if (!row.glAccountId) {
        toast.error('Select an account on every tax, deduction and charge.');
        return;
      }
      if (row.kind !== 'TAX' && !(docAdjustmentAmount(row, subtotalAmount, taxTypes) > 0)) {
        toast.error('Every deduction and charge needs an amount above zero.');
        return;
      }
    }
    if (
      adjustments.length > 0 &&
      !(summarizeDocAdjustments(adjustments, subtotalAmount, taxTypes).total > 0)
    ) {
      toast.error('The deductions leave nothing owed — the total must be above zero.');
      return;
    }

    const payload = {
      partyId: data.vendor,
      documentDate: data.invoiceDate,
      dueDate: data.dueDate || undefined,
      currency: data.currency,
      amount: subtotalAmount,
      transactionTypeId: data.transactionTypeId,
      ...(adjustments.length
        ? {
            taxes: adjustments
              .filter((row) => row.kind === 'TAX')
              .map((row) => ({ taxTypeId: row.taxTypeId, glAccountId: row.glAccountId })),
            adjustments: adjustments
              .filter((row) => row.kind !== 'TAX')
              .map((row) => ({
                kind: row.kind as 'DEDUCTION' | 'CHARGE',
                glAccountId: row.glAccountId,
                amount: docAdjustmentAmount(row, subtotalAmount, taxTypes),
                description: row.description || undefined,
              })),
          }
        : {}),
      description: data.description || undefined,
      externalReference: data.invoiceNumber || undefined,
    };

    try {
      if (isReceivable) {
        await createInvoice.mutateAsync(payload);
      } else {
        await createBill.mutateAsync(payload);
      }
      toast.success('Invoice created as a draft.');
      onCreated();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create invoice'));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className={cardClass('p-6')}>
          <InvoiceDetailsSection
            form={form}
            vendorLabel={partyLabel}
            parties={parties}
            partyOptions={partyOptions}
            isLoadingParties={isLoadingParties}
            side={side}
          />
        </div>

        <InvoiceLineDetailsSection form={form} />

        <DocumentAdjustments
          rows={adjustments}
          onChange={setAdjustments}
          subtotal={subtotal}
          currency={currency}
          side={side}
          documentDate={invoiceDate}
          taxTypes={taxTypes}
          ruleTaxAccounts={ruleTaxAccounts}
          accountOptions={accountOptions}
          isLoadingAccounts={isLoadingAccounts}
        />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowCancelModal(true)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={<Icons.Save className="w-4 h-4" />}
            isLoading={isPending}
            loadingText="Saving…"
            onClick={form.handleSubmit(onSubmit)}
          >
            Save as Draft
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={form.handleSubmit(onSubmit)}>
            Submit for Approval
          </Button>
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
