'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { ApprovePromptModal } from '@/components/organisms/inventory/ApprovePromptModal';
import { useCanApprove } from '@/hooks/inventory/useApprovalAccess';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useItemVariantsMap } from '@/hooks/inventory/useItemVariants';
import { useInventoryParties } from '@/hooks/inventory/useInventoryParties';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';

interface FormValues {
  reference: string;
  orderDate: string;
  expectedDate: string;
  paymentTerms: string;
  partyId: string;
  warehouseId: string;
  notes: string;
}

interface LineRow {
  key: string;
  itemId: string;
  variant: string;
  quantity: number;
  unitCost: number;
}

let rowCounter = 0;
const newLine = (): LineRow => ({
  key: `po-line-${++rowCounter}`,
  itemId: '',
  variant: '',
  quantity: 0,
  unitCost: 0,
});

// Terms decide when the supplier can be paid: on receipt or cash on delivery, once the goods have
// arrived; on any of the others, as soon as the invoice is recorded.
const PAYMENT_TERMS = [
  'Due on receipt',
  'Cash on delivery',
  'Payment in advance',
  'Net 15',
  'Net 30',
  'Net 60',
].map((t) => ({ value: t, label: t }));

const LINE_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_30px]';

// A purchase order has no prices: the unit cost is entered when the goods are received.
const PURCHASE_LINE_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_30px]';

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): FormValues => ({
  reference: '',
  orderDate: today(),
  expectedDate: '',
  paymentTerms: '',
  partyId: '',
  warehouseId: '',
  notes: '',
});

const lineTotal = (l: LineRow) =>
  Math.round((l.quantity * l.unitCost + Number.EPSILON) * 100) / 100;
const formatValue = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type OrderKind = 'PURCHASE' | 'SALES';

const COPY = {
  PURCHASE: {
    title: 'Purchase Order',
    description:
      'Order stock from this supplier. Prices are entered when you receive the order, and nothing is added to stock until then.',
    partyLabel: 'Supplier',
    warehouseLabel: 'Deliver To',
    dateLabel: 'Expected Delivery',
    priceLabel: 'Unit Cost',
    notesPlaceholder: 'Optional notes about this order',
    save: 'Create Purchase Order',
  },
  SALES: {
    title: 'Sales Order',
    description: "Sell stock to this customer. Sales orders aren't saved yet.",
    partyLabel: 'Customer',
    warehouseLabel: 'Ship From',
    dateLabel: 'Expected Delivery',
    priceLabel: 'Unit Price',
    notesPlaceholder: 'Optional notes about this order',
    save: 'Create Sales Order',
  },
} as const;

interface OrderPanelProps {
  kind: OrderKind;
  isOpen: boolean;
  onClose: () => void;
  /** The supplier or customer the order is for. Leave out to pick one in the form. */
  partyName?: string;
  /** Id of that supplier or customer. */
  partyId?: string;
}

/**
 * A purchase order to a supplier or a sales order for a customer, laid out like Stock In. It
 * isn't saved anywhere yet: saving only checks the form and closes the panel.
 */
export function OrderPanel({ kind, isOpen, onClose, partyName, partyId }: OrderPanelProps) {
  const copy = COPY[kind];
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();
  const variantsByItem = useItemVariantsMap();
  const toast = useToast();
  const { createPurchaseOrder, isCreating, approvePurchaseOrder, isApproving } =
    usePurchaseOrders();
  const canApprove = useCanApprove('PURCHASE_ORDER');
  // The order just placed, while the person who can approve it decides whether to do so now.
  const [justPlaced, setJustPlaced] = useState<{ id: string; reference: string } | null>(null);
  const { parties } = useInventoryParties(kind === 'SALES' ? 'CUSTOMER' : 'SUPPLIER');
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [showLineErrors, setShowLineErrors] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: blankForm() });

  const itemOptions = useMemo(
    () =>
      items
        .filter((i) => i.status === 'ACTIVE')
        .map((i) => ({ value: i.id, label: i.name, sublabel: i.sku })),
    [items],
  );
  const partyOptions = useMemo(
    () => parties.filter((p) => p.status === 'ACTIVE').map((p) => ({ value: p.id, label: p.name })),
    [parties],
  );
  const warehouseOptions = useMemo(
    () =>
      warehouses
        .filter((w) => w.status === 'ACTIVE')
        .map((w) => ({ value: w.id, label: w.name, sublabel: w.code })),
    [warehouses],
  );

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const updateLine = (key: string, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Picking an item fills in its price (read-only, as on Stock In and Out): the purchase cost
  // for a purchase order, the selling price for a sales order.
  const pickItem = (key: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const price = (kind === 'SALES' ? item?.sellingPrice : item?.costPrice) ?? 0;
    updateLine(key, { itemId, variant: '', unitCost: price });
  };

  const isPurchase = kind === 'PURCHASE';
  const lineGrid = isPurchase ? PURCHASE_LINE_GRID : LINE_GRID;

  const handleClose = () => {
    reset(blankForm());
    setLines([newLine()]);
    setShowLineErrors(false);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setShowLineErrors(true);
    if (lines.some((l) => !l.itemId || l.quantity <= 0)) return;
    // Sales orders aren't saved anywhere yet.
    if (!isPurchase) return handleClose();
    try {
      const placed = await createPurchaseOrder({
        reference: values.reference.trim() || null,
        orderDate: values.orderDate,
        expectedDate: values.expectedDate || null,
        supplierId: partyId ?? values.partyId,
        warehouseId: values.warehouseId,
        paymentTerms: values.paymentTerms || null,
        notes: values.notes.trim() || null,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          variant: l.variant.trim() || null,
          quantity: l.quantity,
        })),
      });
      handleClose();
      if (canApprove) {
        setJustPlaced({ id: placed.id, reference: placed.reference });
      } else {
        toast.success('Purchase order created and sent for approval');
      }
    } catch (err) {
      toast.error(extractError(err, 'Could not create purchase order'));
    }
  };

  const approveNow = async () => {
    if (!justPlaced) return;
    try {
      await approvePurchaseOrder(justPlaced.id);
      toast.success('Purchase order approved');
    } catch (err) {
      toast.error(extractError(err, 'Could not approve the order'));
    }
    setJustPlaced(null);
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title={copy.title}
        description={copy.description}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} isLoading={isCreating} loadingText="Saving...">
              {copy.save}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              <FormField
                label="Reference"
                registration={register('reference', {
                  maxLength: { value: 64, message: 'Reference cannot exceed 64 characters' },
                })}
                error={errors.reference}
                placeholder="Auto-generated if left blank"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="orderDate"
                rules={{ required: 'Date is required' }}
                render={({ field, fieldState }) => (
                  <DatePicker
                    label="Order Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              {partyName ? (
                <SearchSelect
                  label={copy.partyLabel}
                  options={[{ value: partyName, label: partyName }]}
                  value={partyName}
                  onChange={() => {}}
                  disabled
                />
              ) : (
                <Controller
                  control={control}
                  name="partyId"
                  rules={{ required: `Select a ${copy.partyLabel.toLowerCase()}` }}
                  render={({ field, fieldState }) => (
                    <SearchSelect
                      label={copy.partyLabel}
                      placeholder={`Select ${copy.partyLabel.toLowerCase()}`}
                      options={partyOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="warehouseId"
                rules={{ required: 'Select a warehouse' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    label={copy.warehouseLabel}
                    placeholder="Select warehouse"
                    options={warehouseOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="expectedDate"
                render={({ field }) => (
                  <DatePicker
                    label={copy.dateLabel}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="paymentTerms"
                render={({ field }) => (
                  <SearchSelect
                    label="Payment Terms"
                    placeholder="Optional"
                    options={PAYMENT_TERMS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <FormField
            label="Notes"
            type="textarea"
            rows={2}
            registration={register('notes', {
              maxLength: { value: 500, message: 'Notes cannot exceed 500 characters' },
            })}
            error={errors.notes}
            placeholder={copy.notesPlaceholder}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-900">Items</span>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className={cn(lineGrid, 'hidden bg-gray-50 px-2.5 py-2 sm:grid')}>
                {(isPurchase
                  ? ['Item', 'Variant', 'Qty']
                  : ['Item', 'Variant', 'Qty', copy.priceLabel, 'Total']
                ).map((h) => (
                  <span key={h} className="text-xs font-bold text-gray-900">
                    {h}
                  </span>
                ))}
                <span aria-hidden />
              </div>

              <div className="divide-y divide-gray-200">
                {lines.map((line) => (
                  <div key={line.key} className={cn(lineGrid, 'items-start px-2.5 py-2')}>
                    <SearchSelect
                      placeholder="Select item…"
                      options={itemOptions}
                      value={line.itemId}
                      onChange={(v) => pickItem(line.key, v)}
                      error={showLineErrors && !line.itemId ? 'Select an item' : undefined}
                    />
                    {isPurchase ? (
                      // An order can name a variant the item doesn't have yet.
                      <CreatableSearchSelect
                        placeholder={line.itemId ? 'Select or add variant' : 'Select item first'}
                        disabled={!line.itemId}
                        options={(variantsByItem[line.itemId] ?? []).map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        value={line.variant}
                        onChange={(v) => updateLine(line.key, { variant: v })}
                      />
                    ) : (
                      <SearchSelect
                        placeholder={
                          !line.itemId
                            ? 'Select item first'
                            : variantsByItem[line.itemId]?.length
                              ? 'Select variant'
                              : 'No variants'
                        }
                        disabled={!line.itemId || !variantsByItem[line.itemId]?.length}
                        options={(variantsByItem[line.itemId] ?? []).map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        value={line.variant}
                        onChange={(v) => updateLine(line.key, { variant: v })}
                      />
                    )}
                    <NumberField
                      ariaLabel="Quantity"
                      className="w-full py-2"
                      placeholder="0"
                      decimals={4}
                      value={line.quantity}
                      onChange={(v) => updateLine(line.key, { quantity: v })}
                      error={showLineErrors && line.quantity <= 0 ? 'Enter a quantity' : undefined}
                    />
                    {!isPurchase && (
                      <>
                        <NumberField
                          ariaLabel={copy.priceLabel}
                          className="w-full py-2"
                          value={line.unitCost}
                          onChange={() => {}}
                          disabled
                        />
                        <NumberField
                          ariaLabel="Total"
                          className="w-full py-2"
                          value={lineTotal(line)}
                          onChange={() => {}}
                          disabled
                        />
                      </>
                    )}
                    <div className="flex h-9.5 items-center">
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Remove line"
                          title="Remove line"
                          onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <span className="block w-7.5" aria-hidden />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLines((r) => [...r, newLine()])}
              >
                Add Item
              </Button>
              {!isPurchase && (
                <div className="text-sm text-gray-600">
                  Total{' '}
                  <span className="ml-2 font-semibold text-gray-900">
                    {formatValue(grandTotal)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidePanel>
      <ApprovePromptModal
        isOpen={justPlaced !== null}
        title="Purchase Order Created"
        description={`${justPlaced?.reference ?? 'The order'} is waiting for approval. Goods can only be received once it is approved. Approve it now?`}
        isApproving={isApproving}
        onApprove={approveNow}
        onLater={() => {
          toast.success('Purchase order created, waiting for approval');
          setJustPlaced(null);
        }}
      />
    </>
  );
}
