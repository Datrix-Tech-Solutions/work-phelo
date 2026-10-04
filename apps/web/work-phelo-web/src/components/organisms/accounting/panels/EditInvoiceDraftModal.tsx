'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCostCentres, useUpdateReceivableInvoiceDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { AccountingTradeDocument, UpdateInvoiceDraftPayload } from '@/types/accounting';

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

interface Props {
  document: AccountingTradeDocument;
  onClose: () => void;
  /** Called once the changes are saved - the caller refreshes what it is showing. */
  onSaved: () => void;
}

/**
 * Completes a draft invoice. What the invoice is for was fixed when it was raised, so the amount,
 * quantity, unit price and customer are shown but cannot be changed here.
 */
export function EditInvoiceDraftModal({ document, onClose, onSaved }: Props) {
  const toast = useToast();
  const update = useUpdateReceivableInvoiceDraft();
  const { data: costCentres = [] } = useCostCentres();

  const [documentDate, setDocumentDate] = useState(toDateInput(document.documentDate));
  const [dueDate, setDueDate] = useState(toDateInput(document.dueDate));
  const [costCentreId, setCostCentreId] = useState(document.costCentreId ?? '');
  const [externalReference, setExternalReference] = useState(document.externalReference ?? '');
  const [description, setDescription] = useState(document.description ?? '');

  const costCentreOptions = useMemo(
    () =>
      costCentres
        .filter((c) => c.status === 'ACTIVE' || c.id === document.costCentreId)
        .map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` })),
    [costCentres, document.costCentreId],
  );

  const payload: UpdateInvoiceDraftPayload = {
    ...(documentDate && documentDate !== toDateInput(document.documentDate)
      ? { documentDate }
      : {}),
    ...(dueDate && dueDate !== toDateInput(document.dueDate) ? { dueDate } : {}),
    ...(costCentreId !== (document.costCentreId ?? '')
      ? { costCentreId: costCentreId || null }
      : {}),
    ...(externalReference.trim() !== (document.externalReference ?? '') && externalReference.trim()
      ? { externalReference: externalReference.trim() }
      : {}),
    ...(description.trim() !== (document.description ?? '') && description.trim()
      ? { description: description.trim() }
      : {}),
  };
  const changed = Object.keys(payload).length > 0;

  const handleSave = async () => {
    try {
      await update.mutateAsync({ id: document.id, ...payload });
      toast.success('Draft updated.');
      onSaved();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update the draft'));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Draft"
      description={document.documentNumber}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!changed}
            isLoading={update.isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">
            Fixed when the draft was raised
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Locked label="Customer" value={`${document.party.name} (${document.party.code})`} />
            <Locked label="Amount" value={fmtAmount(document.subtotalAmount, document.currency)} />
            {document.quantity && document.unitPrice && (
              <>
                <Locked label="Quantity" value={Number(document.quantity).toLocaleString()} />
                <Locked
                  label="Unit Price"
                  value={fmtAmount(document.unitPrice, document.currency)}
                />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Document Date"
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <SearchSelect
          label="Cost Centre"
          placeholder="None"
          options={costCentreOptions}
          value={costCentreId}
          onChange={setCostCentreId}
        />
        <Input
          label="External Reference"
          value={externalReference}
          maxLength={120}
          onChange={(e) => setExternalReference(e.target.value)}
        />
        <Input
          label="Description"
          type="textarea"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
