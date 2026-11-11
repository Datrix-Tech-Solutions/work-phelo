'use client';

import { useMemo, useState } from 'react';
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
  received: number;
  extra: number;
  lotNumber: string;
  manufactureDate: string;
  expiryDate: string;
}

const FIELD_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-6';

const today = () => new Date().toISOString().slice(0, 10);
const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface ReceivePurchaseOrderPanelProps {
  /** The order being received; null while closed. */
  order: PurchaseOrder | null;
  onClose: () => void;
}

/**
 * Records goods arriving against a purchase order, line by line. The units received are paid for;
 * the extra units are free: both are added to stock (a stock in) at the order's unit cost, but
 * only the units received count toward what is owed to the supplier.
 */
export function ReceivePurchaseOrderPanel({ order, onClose }: ReceivePurchaseOrderPanelProps) {
  const toast = useToast();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();
  const { receivePurchaseOrder, isReceiving } = usePurchaseOrders();
  const [dateReceived, setDateReceived] = useState(today);
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  // Each line starts by taking in everything still outstanding.
  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      (order?.lines ?? []).map((l) => [
        l.id,
        {
          received: Math.max(0, l.orderedQuantity - l.receivedQuantity),
          extra: 0,
          lotNumber: '',
          manufactureDate: '',
          expiryDate: '',
        },
      ]),
    ),
  );

  const itemOf = (id: string) => items.find((i) => i.id === id);
  const outstanding = (l: PurchaseOrder['lines'][number]) =>
    Math.max(0, l.orderedQuantity - l.receivedQuantity);
  const update = (id: string, patch: Partial<LineState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const lines = useMemo(() => order?.lines ?? [], [order]);
  const taking = (id: string) => (state[id]?.received ?? 0) + (state[id]?.extra ?? 0) > 0;

  const lineError = (l: PurchaseOrder['lines'][number]) => {
    const s = state[l.id];
    if (s.received > outstanding(l)) return `Only ${formatNumber(outstanding(l))} outstanding`;
    return undefined;
  };
  const expiryError = (l: PurchaseOrder['lines'][number]) => {
    const s = state[l.id];
    if (!itemOf(l.itemId)?.isPerishable || !taking(l.id)) return undefined;
    if (!s.expiryDate) return showErrors ? 'Expiry date is required' : undefined;
    if (s.manufactureDate && s.expiryDate < s.manufactureDate)
      return 'Expiry is before manufacture';
    return undefined;
  };

  const owedNow = lines.reduce((sum, l) => sum + (state[l.id]?.received ?? 0) * l.unitCost, 0);
  const stockedNow = lines.reduce(
    (sum, l) => sum + (state[l.id]?.received ?? 0) + (state[l.id]?.extra ?? 0),
    0,
  );
  const valueNow = lines.reduce(
    (sum, l) => sum + ((state[l.id]?.received ?? 0) + (state[l.id]?.extra ?? 0)) * l.unitCost,
    0,
  );

  const save = async () => {
    if (!order) return;
    setShowErrors(true);
    if (!dateReceived) return;
    if (lines.some((l) => lineError(l) || expiryError(l))) return;
    const receiving = lines.filter((l) => taking(l.id));
    if (!receiving.length) {
      toast.error('Enter a quantity received for at least one item');
      return;
    }
    try {
      await receivePurchaseOrder(order.id, {
        dateReceived,
        notes: notes.trim() || null,
        lines: receiving.map((l) => {
          const s = state[l.id];
          const perishable = !!itemOf(l.itemId)?.isPerishable;
          return {
            lineId: l.id,
            receivedQuantity: s.received,
            extraQuantity: s.extra,
            lotNumber: s.lotNumber.trim() || null,
            manufactureDate: perishable ? s.manufactureDate || null : null,
            expiryDate: perishable ? s.expiryDate || null : null,
          };
        }),
      });
      toast.success('Items received and added to stock');
      onClose();
    } catch (err) {
      toast.error(extractError(err, 'Could not receive the order'));
    }
  };

  return (
    <SidePanel
      isOpen={order !== null}
      onClose={onClose}
      title={order ? `Receive ${order.reference}` : 'Receive Purchase Order'}
      description="Enter what arrived. Received items are paid for; extra items are free. Both are added to stock."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isReceiving}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={isReceiving} loadingText="Saving...">
            Receive Items
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

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              <DatePicker
                label="Date Received"
                value={dateReceived}
                onChange={setDateReceived}
                disableFuture
                error={showErrors && !dateReceived ? 'Date is required' : undefined}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="mb-1 block text-sm font-semibold text-gray-900">Notes</span>
              <Input
                aria-label="Notes"
                placeholder="Optional"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-900">Items</span>
            <div className="flex flex-col gap-3">
              {lines.map((l) => {
                const s = state[l.id];
                const item = itemOf(l.itemId);
                const perishable = !!item?.isPerishable;
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
                        Ordered {formatNumber(l.orderedQuantity)} · Received{' '}
                        {formatNumber(l.receivedQuantity)} · Outstanding{' '}
                        {formatNumber(outstanding(l))}
                      </span>
                    </div>

                    <div className={FIELD_GRID}>
                      <Field label="Qty Received">
                        <NumberField
                          ariaLabel="Quantity received"
                          className="w-full"
                          placeholder="0"
                          decimals={4}
                          value={s.received}
                          disabled={outstanding(l) === 0}
                          onChange={(v) => update(l.id, { received: v })}
                          error={lineError(l)}
                        />
                      </Field>
                      <Field label="Extra (free)">
                        <NumberField
                          ariaLabel="Extra quantity"
                          className="w-full"
                          placeholder="0"
                          decimals={4}
                          value={s.extra}
                          onChange={(v) => update(l.id, { extra: v })}
                        />
                      </Field>
                      <Field label="Amount to Pay">
                        <NumberField
                          ariaLabel="Amount to pay"
                          className="w-full"
                          value={money(s.received * l.unitCost)}
                          onChange={() => {}}
                          disabled
                        />
                      </Field>

                      <Field label="Batch / Lot No.">
                        <Input
                          aria-label="Batch / Lot No."
                          placeholder="Optional"
                          maxLength={100}
                          value={s.lotNumber}
                          onChange={(e) => update(l.id, { lotNumber: e.target.value })}
                        />
                      </Field>
                      {perishable && (
                        <>
                          <Field label="Mfg Date">
                            <DatePicker
                              size="sm"
                              placeholder="Mfg date"
                              disableFuture
                              maxDate={s.expiryDate || undefined}
                              value={s.manufactureDate}
                              onChange={(v) => update(l.id, { manufactureDate: v })}
                            />
                          </Field>
                          <Field label="Expiry Date">
                            <DatePicker
                              size="sm"
                              placeholder="Expiry date"
                              minDate={s.manufactureDate || undefined}
                              value={s.expiryDate}
                              onChange={(v) => update(l.id, { expiryDate: v })}
                              error={expiryError(l)}
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-end gap-1 text-sm text-gray-600">
              <div>
                Added to stock
                <span className="ml-2 font-semibold text-gray-900">{formatNumber(stockedNow)}</span>
                <span className="ml-3">Stock value</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {formatInventoryValue(money(valueNow))}
                </span>
              </div>
              <div>
                Amount to pay supplier
                <span className="ml-2 font-semibold text-gray-900">
                  {formatInventoryValue(money(owedNow))}
                </span>
              </div>
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
