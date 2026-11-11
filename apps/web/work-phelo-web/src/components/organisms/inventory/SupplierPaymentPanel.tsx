'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import {
  PAYMENT_METHOD_LABEL,
  canPay,
  purchaseOrderAmountOwed,
  purchaseOrderBalance,
  usePurchaseOrders,
  type PurchaseOrder,
  type SupplierPaymentMethod,
} from '@/hooks/inventory/usePurchaseOrders';

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** The most that can be entered for an order: its balance, in whole pence. */
const maxFor = (po: PurchaseOrder) => Math.floor(purchaseOrderBalance(po) * 100 + 1e-6) / 100;

interface SupplierPaymentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  /** The supplier's orders. Only those with something owed can be paid. */
  orders: PurchaseOrder[];
  /** Orders ticked when the panel opens. */
  initialSelectedIds?: string[];
  /** `popup` is a small dialog for paying one order; `panel` (default) is the side panel for several. */
  layout?: 'popup' | 'panel';
}

/**
 * Records a payment to a supplier and shares it over the orders it settles. Several orders can be
 * ticked at once; each gets its own amount, which starts at what is still owed on it. Nothing can
 * be paid ahead of delivery: an order's balance is what was received less what was already paid.
 */
export function SupplierPaymentPanel({
  isOpen,
  onClose,
  supplierId,
  supplierName,
  orders,
  initialSelectedIds = [],
  layout = 'panel',
}: SupplierPaymentPanelProps) {
  const toast = useToast();
  const { makeSupplierPayment, isPaying } = usePurchaseOrders();
  const payable = useMemo(() => orders.filter(canPay), [orders]);
  const popup = layout === 'popup';
  const single = popup || payable.length === 1;

  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<SupplierPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialSelectedIds.map((id) => [id, true])),
  );
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  const isSelected = (po: PurchaseOrder) => single || !!selected[po.id];
  const amountOf = (po: PurchaseOrder) => amounts[po.id] ?? maxFor(po);
  const picked = payable.filter(isSelected);
  const total = picked.reduce((sum, po) => sum + amountOf(po), 0);

  const errorOf = (po: PurchaseOrder) => {
    const amount = amountOf(po);
    if (!(amount > 0)) return 'Enter an amount';
    if (amount > maxFor(po) + 0.0001) return `At most ${formatInventoryValue(maxFor(po))} is owed`;
    return undefined;
  };

  const save = async () => {
    setShowErrors(true);
    if (!date) return;
    if (picked.length === 0) {
      toast.error('Choose at least one order to pay');
      return;
    }
    if (picked.some(errorOf)) return;
    try {
      await makeSupplierPayment({
        supplierId,
        paymentDate: date,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        allocations: picked.map((po) => ({ purchaseOrderId: po.id, amount: amountOf(po) })),
      });
      toast.success('Payment recorded');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not record the payment'));
    }
  };

  const title = `Make Payment${supplierName ? ` to ${supplierName}` : ''}`;
  const footer = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600">
        Total payment
        <span className="ml-2 text-base font-bold text-gray-900">
          {formatInventoryValue(money(total))}
        </span>
      </span>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} disabled={isPaying}>
          Cancel
        </Button>
        <Button
          onClick={save}
          isLoading={isPaying}
          loadingText="Saving..."
          disabled={payable.length === 0}
        >
          Make Payment
        </Button>
      </div>
    </div>
  );
  const content = (
    <div className="mt-2 flex flex-col gap-4">
      <div className={`grid grid-cols-1 gap-4 ${popup ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        <DatePicker
          label="Date Paid"
          value={date}
          onChange={setDate}
          disableFuture
          error={showErrors && !date ? 'Date is required' : undefined}
        />
        <SearchSelect
          label="Method"
          clearable={false}
          options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          value={method}
          onChange={(v) => v && setMethod(v as SupplierPaymentMethod)}
        />
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-semibold text-gray-900">Reference</span>
          <Input
            aria-label="Reference"
            placeholder="Optional"
            maxLength={100}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold text-gray-900">Notes</span>
        <Input
          aria-label="Notes"
          placeholder="Optional"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-gray-900">{single ? 'Order' : 'Orders'}</span>
        {payable.length === 0 ? (
          <p className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
            Nothing is owed on any order. Receive items on an order first, then pay for them.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {payable.map((po) => {
              const on = isSelected(po);
              const error = on && showErrors ? errorOf(po) : undefined;
              return (
                <div
                  key={po.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <label className="flex min-w-0 items-start gap-3">
                    {!single && (
                      <input
                        type="checkbox"
                        aria-label={`Pay ${po.reference}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-brand"
                        checked={on}
                        onChange={(e) => setSelected((s) => ({ ...s, [po.id]: e.target.checked }))}
                      />
                    )}
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="font-mono text-sm font-bold text-gray-900">
                        {po.reference}
                      </span>
                      <span className="text-xs text-gray-500">
                        Ordered {formatDate(po.date)} · Owed{' '}
                        {formatInventoryValue(purchaseOrderAmountOwed(po))} · Paid{' '}
                        {formatInventoryValue(po.amountPaid)}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">
                        Balance {formatInventoryValue(purchaseOrderBalance(po))}
                      </span>
                    </span>
                  </label>
                  <div className="w-full sm:w-40">
                    <NumberField
                      ariaLabel={`Amount for ${po.reference}`}
                      className="w-full"
                      value={amountOf(po)}
                      disabled={!on}
                      onChange={(v) => setAmounts((a) => ({ ...a, [po.id]: v }))}
                      error={error}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (popup)
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description="Pay for goods already received on this order. The most you can pay is the balance still owed."
        width="max-w-xl"
        footer={footer}
      >
        {content}
      </Modal>
    );

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Pay for goods already received. Tick the orders this payment covers and set how much goes to each."
      footer={footer}
    >
      {content}
    </SidePanel>
  );
}
