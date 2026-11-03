'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useCreateStockMovement } from '@/hooks/inventory/useStockMovements';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface PanelFormValues {
  reference: string;
  date: string;
  party: string;
  /** The warehouse stock goes into (in), comes out of (out), or is sent from (transfer). */
  warehouseId: string;
  /** Transfers only: the warehouse the stock is sent to. */
  toWarehouseId: string;
  /** Stock out only: why the stock is issued. */
  purpose: string;
  /** Adjustments only. */
  reason: string;
  adjustmentType: AdjustmentDirection;
  notes: string;
}

interface LineRow {
  key: string;
  itemId: string;
  quantity: number;
  unitCost: number;
}

let rowCounter = 0;
const newLine = (): LineRow => ({
  key: `stock-in-line-${++rowCounter}`,
  itemId: '',
  quantity: 0,
  unitCost: 0,
});

const LINE_GRID = 'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_30px]';

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): PanelFormValues => ({
  reference: '',
  date: today(),
  party: '',
  warehouseId: '',
  toWarehouseId: '',
  purpose: '',
  reason: '',
  adjustmentType: 'INCREASE',
  notes: '',
});

const lineTotal = (l: LineRow) =>
  Math.round((l.quantity * l.unitCost + Number.EPSILON) * 100) / 100;
const formatValue = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PanelType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

// Values are the inventory service's reason and purpose codes.
const ADJUSTMENT_REASONS = [
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'PHYSICAL_COUNT_DIFFERENCE', label: 'Physical Count Difference' },
  { value: 'DATA_CORRECTION', label: 'Data Correction' },
  { value: 'EXPIRED_GOODS', label: 'Expired Goods' },
  { value: 'OTHER', label: 'Other' },
];

const STOCK_OUT_PURPOSES = [
  { value: 'SALE', label: 'Sale' },
  { value: 'INTERNAL_USE', label: 'Internal Use' },
  { value: 'CONSUMPTION', label: 'Consumption' },
  { value: 'PROJECT_USE', label: 'Project Use' },
  { value: 'EMPLOYEE_ISSUE', label: 'Employee Issue' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'OTHER', label: 'Other' },
];

type AdjustmentDirection = 'INCREASE' | 'DECREASE';

const ADJUSTMENT_TYPE_OPTIONS = [
  {
    value: 'INCREASE',
    label: 'Increase',
    hint: '(Add to stock)',
    Icon: ArrowUp,
    iconClass: 'text-green-600',
    accent: 'accent-green-600',
    selectedClass: 'border-green-300 bg-green-50',
  },
  {
    value: 'DECREASE',
    label: 'Decrease',
    hint: '(Remove from stock)',
    Icon: ArrowDown,
    iconClass: 'text-red-600',
    accent: 'accent-red-600',
    selectedClass: 'border-red-300 bg-red-50',
  },
] as const;

const COPY = {
  STOCK_IN: {
    title: 'Stock In',
    description: 'Record stock received into a warehouse.',
    dateLabel: 'Date Received',
    partyLabel: 'Supplier',
    partyPlaceholder: 'e.g. Supplier Company Limited',
    notesPlaceholder: 'Optional notes about this delivery',
    save: 'Save Stock In',
    toast: 'Stock received successfully',
    promptTitle: 'Stock Received!',
    promptMessage: 'The stock in has been recorded.',
  },
  ADJUSTMENT: {
    title: 'Stock Adjustment',
    description: 'Correct the stock held in a warehouse.',
    dateLabel: 'Date Adjusted',
    partyLabel: '',
    partyPlaceholder: '',
    notesPlaceholder: 'Optional notes about this adjustment',
    save: 'Save Adjustment',
    toast: 'Stock adjusted successfully',
    promptTitle: 'Stock Adjusted!',
    promptMessage: 'The adjustment has been recorded.',
  },
  TRANSFER: {
    title: 'Transfer',
    description: 'Move stock from one warehouse to another.',
    dateLabel: 'Date Transferred',
    partyLabel: '',
    partyPlaceholder: '',
    notesPlaceholder: 'Optional notes about this transfer',
    save: 'Save Transfer',
    toast: 'Stock transferred successfully',
    promptTitle: 'Stock Transferred!',
    promptMessage: 'The transfer has been recorded.',
  },
  STOCK_OUT: {
    title: 'Stock Out',
    description: 'Record stock issued from a warehouse.',
    dateLabel: 'Date Issued',
    partyLabel: 'Customer',
    partyPlaceholder: 'e.g. Customer Company Limited',
    notesPlaceholder: 'Optional notes about this issue',
    save: 'Save Stock Out',
    toast: 'Stock issued successfully',
    promptTitle: 'Stock Issued!',
    promptMessage: 'The stock out has been recorded.',
  },
} as const;

interface StockMovementPanelProps {
  type: PanelType;
  isOpen: boolean;
  onClose: () => void;
}

export function StockMovementPanel({ type, isOpen, onClose }: StockMovementPanelProps) {
  const isOut = type === 'STOCK_OUT';
  const isTransfer = type === 'TRANSFER';
  const isAdjustment = type === 'ADJUSTMENT';
  const copy = COPY[type];
  const toast = useToast();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();
  const { createMovement, isPending } = useCreateStockMovement();
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const [showLineErrors, setShowLineErrors] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<PanelFormValues>({ defaultValues: blankForm() });

  const sourceWarehouseId = useWatch({ control, name: 'warehouseId' });
  const adjustmentType = useWatch({ control, name: 'adjustmentType' });
  // Stock out, transfers and adjustments that reduce stock draw on what is on hand.
  const drawsStock = isOut || isTransfer || (isAdjustment && adjustmentType === 'DECREASE');

  useEffect(() => {
    if (!isOpen) return;
    reset(blankForm());
  }, [isOpen, reset]);

  const itemOptions = useMemo(
    () =>
      items
        .filter((i) => i.status === 'ACTIVE' && (!drawsStock || i.currentStock > 0))
        .map((i) => ({
          value: i.id,
          label: i.name,
          sublabel: drawsStock ? `${i.sku} · ${i.currentStock} in stock` : i.sku,
        })),
    [items, drawsStock],
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

  // Picking an item fills in its purchase cost, which can still be changed.
  const pickItem = (key: string, itemId: string) => {
    const cost = items.find((i) => i.id === itemId)?.costPrice ?? 0;
    updateLine(key, { itemId, unitCost: cost });
  };

  const handleClose = () => {
    reset(blankForm());
    setLines([newLine()]);
    setShowLineErrors(false);
    onClose();
  };

  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => {
      reset({ ...blankForm(), date: getValues('date'), warehouseId: getValues('warehouseId') });
      setLines([newLine()]);
      setShowLineErrors(false);
    },
  });

  // Stock out can't issue more than is on hand (stock is tracked as a total per item for now).
  const stockError = (l: LineRow) => {
    if (!drawsStock || !l.itemId) return undefined;
    const available = items.find((i) => i.id === l.itemId)?.currentStock ?? 0;
    return l.quantity > available ? `Only ${available} in stock` : undefined;
  };

  const save = async (data: PanelFormValues) => {
    if (lines.some((l) => !l.itemId || l.quantity <= 0 || stockError(l))) {
      setShowLineErrors(true);
      return;
    }
    const decrease = isAdjustment && data.adjustmentType === 'DECREASE';
    await createMovement({
      type,
      date: data.date,
      reference: data.reference,
      // Adjustment quantities are signed: negative when stock is reduced.
      lines: lines.map((l) => ({
        itemId: l.itemId,
        quantity: decrease ? -l.quantity : l.quantity,
        unitCost: l.unitCost,
      })),
      fromWarehouseId: isOut || isTransfer || decrease ? data.warehouseId : null,
      toWarehouseId: isTransfer ? data.toWarehouseId : isOut || decrease ? null : data.warehouseId,
      source: isTransfer || isAdjustment ? null : data.party.trim() || null,
      reason: isAdjustment ? data.reason : null,
      purpose: isOut ? data.purpose : null,
      notes: data.notes.trim() || null,
    });
    toast.success(copy.toast);
    entry.finishSave({ title: copy.promptTitle, message: copy.promptMessage }, handleClose);
  };

  const onSubmit = async (data: PanelFormValues) => {
    try {
      await save(data);
    } catch (err) {
      toast.error(extractError(err, 'Could not save stock movement'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={copy.title}
      description={copy.description}
      {...entry.panelProps}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
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
              name="date"
              rules={{ required: 'Date is required' }}
              render={({ field, fieldState }) => (
                <DatePicker
                  label={copy.dateLabel}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
        </div>

        {isAdjustment ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 min-w-0">
                <Controller
                  control={control}
                  name="warehouseId"
                  rules={{ required: 'Select a warehouse' }}
                  render={({ field, fieldState }) => (
                    <SearchSelect
                      label="Warehouse"
                      placeholder="Select warehouse"
                      options={warehouseOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <Controller
                  control={control}
                  name="reason"
                  rules={{ required: 'Select a reason' }}
                  render={({ field, fieldState }) => (
                    <SearchSelect
                      label="Reason"
                      placeholder="Select reason"
                      options={ADJUSTMENT_REASONS}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
              <span className="text-sm font-bold text-gray-900">Adjustment Type</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ADJUSTMENT_TYPE_OPTIONS.map((o) => {
                  const selected = adjustmentType === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                        selected ? o.selectedClass : 'border-gray-200 bg-white hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="radio"
                        value={o.value}
                        className={cn('h-5 w-5 shrink-0', o.accent)}
                        {...register('adjustmentType')}
                      />
                      <o.Icon className={cn('h-6 w-6 shrink-0', o.iconClass)} />
                      <span className="flex flex-col">
                        <span className="text-sm text-gray-900">{o.label}</span>
                        <span className="text-xs text-gray-500">{o.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        ) : isTransfer ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="warehouseId"
                rules={{ required: 'Select a source warehouse' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    label="Source Warehouse"
                    placeholder="Select source warehouse"
                    options={warehouseOptions}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      if (v === getValues('toWarehouseId')) setValue('toWarehouseId', '');
                    }}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="toWarehouseId"
                rules={{ required: 'Select a destination warehouse' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    label="Destination Warehouse"
                    placeholder="Select destination warehouse"
                    options={warehouseOptions.filter((w) => w.value !== sourceWarehouseId)}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 min-w-0">
              <FormField
                label={copy.partyLabel}
                registration={register('party', {
                  maxLength: {
                    value: 150,
                    message: `${copy.partyLabel} cannot exceed 150 characters`,
                  },
                })}
                error={errors.party}
                placeholder={copy.partyPlaceholder}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="warehouseId"
                rules={{ required: 'Select a warehouse' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    label="Warehouse"
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
        )}

        {isOut && (
          <Controller
            control={control}
            name="purpose"
            rules={{ required: 'Select a purpose' }}
            render={({ field, fieldState }) => (
              <SearchSelect
                label="Purpose"
                placeholder="Select purpose"
                options={STOCK_OUT_PURPOSES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        )}

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
            <div className={cn(LINE_GRID, 'hidden bg-gray-50 px-2.5 py-2 sm:grid')}>
              {['Item', 'Qty', 'Unit Cost', 'Total'].map((h) => (
                <span key={h} className="text-xs font-bold text-gray-900">
                  {h}
                </span>
              ))}
              <span aria-hidden />
            </div>

            <div className="divide-y divide-gray-200">
              {lines.map((line) => (
                <div key={line.key} className={cn(LINE_GRID, 'items-start px-2.5 py-2')}>
                  <SearchSelect
                    placeholder="Select item…"
                    options={itemOptions}
                    value={line.itemId}
                    onChange={(v) => pickItem(line.key, v)}
                    error={showLineErrors && !line.itemId ? 'Select an item' : undefined}
                  />
                  <NumberField
                    ariaLabel="Quantity"
                    className="w-full py-2"
                    placeholder="0"
                    decimals={4}
                    value={line.quantity}
                    onChange={(v) => updateLine(line.key, { quantity: v })}
                    error={
                      showLineErrors
                        ? line.quantity <= 0
                          ? 'Enter a quantity'
                          : stockError(line)
                        : undefined
                    }
                  />
                  <NumberField
                    ariaLabel="Unit cost"
                    className="w-full py-2"
                    value={line.unitCost}
                    onChange={(v) => updateLine(line.key, { unitCost: v })}
                  />
                  <NumberField
                    ariaLabel="Total"
                    className="w-full py-2"
                    value={lineTotal(line)}
                    onChange={() => {}}
                    disabled
                  />
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
              Add Line
            </Button>
            <div className="text-sm text-gray-600">
              Total{' '}
              <span className="ml-2 font-semibold text-gray-900">{formatValue(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
