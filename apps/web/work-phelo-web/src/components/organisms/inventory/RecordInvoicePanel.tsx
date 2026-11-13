'use client';

import { useUnitSymbol } from '@/hooks/inventory/useUnitSymbol';
import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { usePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';

interface LineState {
  quantity: number;
  unitCost: number;
}

const FIELD_GRID = 'grid grid-cols-3 gap-3';

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type OrderLine = PurchaseOrder['lines'][number];
const remaining = (l: OrderLine) => Math.max(0, l.orderedQuantity - l.invoicedQuantity);

interface RecordInvoicePanelProps {
  /** The order being invoiced; null while closed. */
  order: PurchaseOrder | null;
  onClose: () => void;
}

/**
 * Records the supplier's invoice for an order: how many units it charges and at what unit cost.
 * That sets what is owed and the price the goods are received at. It is not a stock in.
 */
export function RecordInvoicePanel({ order, onClose }: RecordInvoicePanelProps) {
  const toast = useToast();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();
  const { recordPurchaseInvoice, isInvoicing } = usePurchaseOrders();
  const [number, setNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  // Each line starts as the rest of what is ordered, at the price last invoiced or the item's cost.
  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      (order?.lines ?? []).map((l) => [
        l.id,
        {
          quantity: remaining(l),
          unitCost: l.unitCost ?? items.find((i) => i.id === l.itemId)?.costPrice ?? 0,
        },
      ]),
    ),
  );

  const itemOf = (id: string) => items.find((i) => i.id === id);
  const unitSymbol = useUnitSymbol();
  const qty = (l: { itemId: string }, n: number) =>
    `${formatNumber(n)} ${unitSymbol(itemOf(l.itemId)?.unitId)}`;
  const lines = (order?.lines ?? []).filter((l) => remaining(l) > 0);
  const update = (id: string, patch: Partial<LineState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const charged = (l: OrderLine) => (state[l.id]?.quantity ?? 0) > 0;

  const quantityError = (l: OrderLine) =>
    state[l.id].quantity > remaining(l)
      ? `Only ${qty(l, remaining(l))} left to invoice`
      : undefined;
  const costError = (l: OrderLine) =>
    showErrors && charged(l) && state[l.id].unitCost <= 0 ? 'Enter the unit cost' : undefined;

  const total = lines.reduce(
    (sum, l) => sum + (state[l.id]?.quantity ?? 0) * (state[l.id]?.unitCost ?? 0),
    0,
  );

  const save = async () => {
    if (!order) return;
    setShowErrors(true);
    if (!number.trim() || !invoiceDate) return;
    if (lines.some((l) => quantityError(l) || costError(l))) return;
    const invoiced = lines.filter(charged);
    if (!invoiced.length) {
      toast.error('Enter a quantity for at least one item');
      return;
    }
    try {
      await recordPurchaseInvoice(order.id, {
        number: number.trim(),
        invoiceDate,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        lines: invoiced.map((l) => ({
          lineId: l.id,
          quantity: state[l.id].quantity,
          unitCost: state[l.id].unitCost,
        })),
      });
      toast.success('Invoice recorded');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not record the invoice'));
    }
  };

  return (
    <SidePanel
      isOpen={order !== null}
      onClose={onClose}
      title={order ? `Record Invoice for ${order.reference}` : 'Record Invoice'}
      description="Enter what the supplier charged. This sets what is owed and the price the goods are received at. It does not add anything to stock."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isInvoicing}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={isInvoicing} loadingText="Saving...">
            Record Invoice
          </Button>
        </div>
      }
    >
      {order && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Summary label="Supplier" value={order.supplierName} />
            <Summary
              label="Warehouse"
              value={warehouses.find((w) => w.id === order.warehouseId)?.name ?? '—'}
            />
            <Summary label="Ordered On" value={formatDate(order.date)} />
          </div>
          {order.paymentTerms && <Summary label="Payment Terms" value={order.paymentTerms} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <span className="mb-1 block text-sm font-semibold text-gray-900">Invoice No.</span>
              <Input
                aria-label="Invoice number"
                placeholder="Supplier's invoice number"
                maxLength={100}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                error={showErrors && !number.trim() ? 'Invoice number is required' : undefined}
              />
            </div>
            <div className="min-w-0">
              <DatePicker
                label="Invoice Date"
                value={invoiceDate}
                onChange={setInvoiceDate}
                disableFuture
                error={showErrors && !invoiceDate ? 'Date is required' : undefined}
              />
            </div>
            <div className="min-w-0">
              <DatePicker
                label="Due Date"
                placeholder="Optional"
                value={dueDate}
                minDate={invoiceDate || undefined}
                onChange={setDueDate}
              />
            </div>
          </div>

          <div className="min-w-0">
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
            <span className="text-sm font-bold text-gray-900">Items</span>
            <div className="flex flex-col gap-3">
              {lines.map((l) => {
                const s = state[l.id];
                const item = itemOf(l.itemId);
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">
                          {item?.name ?? 'Item'}
                        </span>
                        {l.variant && (
                          <span className="block truncate text-xs text-gray-500">{l.variant}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-gray-500">
                        Ordered {qty(l, l.orderedQuantity)} · Invoiced {qty(l, l.invoicedQuantity)}{' '}
                        · Left {qty(l, remaining(l))}
                      </span>
                    </div>
                    <div className={FIELD_GRID}>
                      <Field label="Quantity">
                        <NumberField
                          ariaLabel="Quantity invoiced"
                          className="w-full"
                          placeholder="0"
                          decimals={4}
                          keepTyped
                          value={s.quantity}
                          onChange={(v) => update(l.id, { quantity: v })}
                          error={quantityError(l)}
                        />
                      </Field>
                      <Field label="Unit Cost">
                        <NumberField
                          ariaLabel="Unit cost"
                          className="w-full"
                          placeholder="0.00"
                          value={s.unitCost}
                          onChange={(v) => update(l.id, { unitCost: v })}
                          error={costError(l)}
                        />
                      </Field>
                      <Field label="Amount">
                        <NumberField
                          ariaLabel="Amount"
                          className="w-full"
                          value={money(s.quantity * s.unitCost)}
                          onChange={() => {}}
                          disabled
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end text-sm text-gray-600">
              Invoice total
              <span className="ml-2 font-semibold text-gray-900">
                {formatInventoryValue(money(total))}
              </span>
            </div>
          </div>
        </div>
      )}
    </SidePanel>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs font-semibold text-gray-500">{label}</span>
      <span className="block truncate text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </div>
  );
}
