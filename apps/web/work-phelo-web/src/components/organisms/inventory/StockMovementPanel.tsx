'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ArrowDown, ArrowUp, Tag, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { useItemVariantsMap, useVariantBalances } from '@/hooks/inventory/useItemVariants';
import { useStockLots } from '@/hooks/inventory/useStockLots';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryParties } from '@/hooks/inventory/useInventoryParties';
import { useStockPositions } from '@/hooks/inventory/useStockBalances';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useCreateStockMovement } from '@/hooks/inventory/useStockMovements';
import { variantStockAt } from '@/lib/inventoryVariants';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useAdjustmentReasons } from '@/hooks/inventory/useAdjustmentReasons';
import { STOCK_OUT_PURPOSES } from '@/lib/inventoryMovement';
import {
  useStockMovementDrafts,
  type DraftFormValues,
  type StockMovementDraft,
} from '@/hooks/inventory/useStockMovementDrafts';
import { useRevaluationStore } from '@/hooks/inventory/useStockRevaluations';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type PanelFormValues = DraftFormValues;
interface LineRow {
  key: string;
  itemId: string;
  variant: string;
  quantity: number;
  unitCost: number;
  /** Stock in only: the batch / lot being received. */
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  /** Stock out only: the batch to issue from; blank lets the service pick, earliest expiry first. */
  lotId: string;
}

const newLine = (): LineRow => ({
  // Random, not a module counter: a hot reload resets a counter while line state survives.
  key: `line-${crypto.randomUUID()}`,
  itemId: '',
  variant: '',
  quantity: 0,
  unitCost: 0,
  batchNumber: '',
  manufactureDate: '',
  expiryDate: '',
  lotId: '',
});

const LINE_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.7fr)_1fr_1fr_30px]';
// Lines that draw on or add to a batch (stock out, transfers, adjustments) get a batch picker.
const BATCH_LINE_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,0.7fr)_1fr_1fr_30px]';
// Stock in puts batch and dates on a second row under each line.
const STOCK_IN_LINE_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_30px]';

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

const lineTotal = (l: LineRow, quantity = l.quantity) =>
  Math.round((quantity * l.unitCost + Number.EPSILON) * 100) / 100;
const formatValue = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PanelType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

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
  {
    value: 'PRICE',
    label: 'Price Adjustment',
    hint: '(Revalue stock on hand)',
    Icon: Tag,
    iconClass: 'text-blue-600',
    accent: 'accent-blue-600',
    selectedClass: 'border-blue-300 bg-blue-50',
  },
] as const;

const COPY = {
  STOCK_IN: {
    title: 'Stock In',
    description: 'Record stock received into a warehouse.',
    dateLabel: 'Date Received',
    partyLabel: 'Supplier',
    partyPlaceholder: 'Select or add supplier',
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
    partyPlaceholder: 'Select or add customer',
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
  /** A saved draft to continue; omit to start a new movement. */
  draft?: StockMovementDraft | null;
}

export function StockMovementPanel({ type, isOpen, onClose, draft }: StockMovementPanelProps) {
  const isOut = type === 'STOCK_OUT';
  const isTransfer = type === 'TRANSFER';
  const isAdjustment = type === 'ADJUSTMENT';
  const copy = COPY[type];
  const toast = useToast();
  const { items } = useInventoryItems();
  const { lots } = useStockLots();
  const variantsByItem = useItemVariantsMap();
  const { balances: variantBalances } = useVariantBalances();
  const { warehouses } = useInventoryWarehouses();
  const { positions } = useStockPositions();
  // Stock in is received from a supplier and stock out is issued to a customer: suggest the ones
  // set up in Settings, though a name that isn't there yet can still be typed.
  const { parties, createParty } = useInventoryParties(isOut ? 'CUSTOMER' : 'SUPPLIER');
  const partyOptions = useMemo(
    () =>
      parties.filter((p) => p.status === 'ACTIVE').map((p) => ({ value: p.name, label: p.name })),
    [parties],
  );
  const { reasons, createReason } = useAdjustmentReasons();
  // Reasons are listed (and held in the form) by their name; saving maps one back to its code,
  // creating the reason first if the name is new.
  const reasonOptions = useMemo(
    () =>
      reasons.filter((r) => r.status === 'ACTIVE').map((r) => ({ value: r.name, label: r.name })),
    [reasons],
  );
  const { createMovement, isPending } = useCreateStockMovement();
  const { saveDraft, deleteDraft } = useStockMovementDrafts();
  // The page remounts the panel per draft (keyed by draft id), so the lines start from the draft.
  const [lines, setLines] = useState<LineRow[]>(() =>
    draft?.lines.length
      ? draft.lines.map((l) => ({
          ...newLine(),
          ...l,
          variant: l.variant ?? '',
        }))
      : [newLine()],
  );
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
  // A price adjustment revalues what a warehouse holds: only items on hand there, at that quantity.
  const isRevaluation = isAdjustment && adjustmentType === 'PRICE';
  const onHandOnly = drawsStock || isRevaluation;
  // A price adjustment revalues stock and doesn't move any batch.
  const showBatch = isOut || isTransfer || (isAdjustment && !isRevaluation);

  useEffect(() => {
    if (!isOpen) return;
    reset(draft ? draft.form : blankForm());
  }, [isOpen, draft, reset]);

  // On-hand quantity of an item in one warehouse (not the total across warehouses).
  const stockAt = (itemId: string, warehouseId: string) =>
    positions.get(itemId)?.get(warehouseId) ?? 0;

  // Taking stock out needs a source warehouse first, and only offers what that warehouse holds.
  const itemOptions = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.status === 'ACTIVE' &&
            (!onHandOnly || (!!sourceWarehouseId && stockAt(i.id, sourceWarehouseId) > 0)),
        )
        .map((i) => ({
          value: i.id,
          label: i.name,
          sublabel: onHandOnly ? `${i.sku} · ${stockAt(i.id, sourceWarehouseId)} in stock` : i.sku,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, onHandOnly, positions, sourceWarehouseId],
  );
  const warehouseOptions = useMemo(
    () =>
      warehouses
        .filter((w) => w.status === 'ACTIVE')
        .map((w) => ({ value: w.id, label: w.name, sublabel: w.code })),
    [warehouses],
  );

  // A revaluation covers all the stock on hand; other movements use the quantity entered.
  const qtyOf = (l: LineRow) => (isRevaluation ? stockAt(l.itemId, sourceWarehouseId) : l.quantity);
  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l, qtyOf(l)), 0);

  const updateLine = (key: string, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Picking an item fills in its price (read-only in the form): the selling price when
  // stock goes out to a customer, the purchase cost otherwise.
  const pickItem = (key: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const price = (isOut ? item?.sellingPrice : item?.costPrice) ?? 0;
    updateLine(key, { itemId, variant: '', lotId: '', unitCost: price });
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

  // Stock leaving a warehouse can't exceed what that warehouse holds.
  // What a line can take out: the chosen variant's stock in the warehouse (never more than the
  // item holds there), or the item's stock there when no variant is chosen.
  const maxFor = (l: LineRow) => {
    const itemStock = stockAt(l.itemId, sourceWarehouseId);
    const ofVariant = l.variant
      ? Math.max(
          0,
          Math.min(
            variantStockAt(variantBalances, l.itemId, sourceWarehouseId, l.variant),
            itemStock,
          ),
        )
      : itemStock;
    const lot = lots.find((x) => x.id === l.lotId);
    return lot ? Math.min(ofVariant, lot.remainingQuantity) : ofVariant;
  };

  // Batches of a line's item still holding stock at the source warehouse (and under its variant).
  // An increase can top up any batch at the warehouse, even a used-up one.
  const addsStock = isAdjustment && adjustmentType === 'INCREASE';
  const lotsFor = (l: LineRow) =>
    lots.filter(
      (x) =>
        x.itemId === l.itemId &&
        x.warehouseId === sourceWarehouseId &&
        (x.remainingQuantity > 0 || addsStock) &&
        (x.variant ?? '') === l.variant,
    );

  const stockError = (l: LineRow) => {
    if (!drawsStock || !l.itemId || !sourceWarehouseId) return undefined;
    const available = stockAt(l.itemId, sourceWarehouseId);
    if (available <= 0) return 'Not in stock at this warehouse';
    const lot = lots.find((x) => x.id === l.lotId);
    if (lot) {
      const requested = lines.filter((x) => x.lotId === lot.id).reduce((n, x) => n + x.quantity, 0);
      if (requested > lot.remainingQuantity) return `Only ${lot.remainingQuantity} in this batch`;
    }
    if (l.variant) {
      const max = maxFor(l);
      const requested = lines
        .filter((x) => x.itemId === l.itemId && x.variant === l.variant)
        .reduce((n, x) => n + x.quantity, 0);
      if (max <= 0) return 'None of this variant in stock';
      if (requested > max) return `Only ${max} of this variant`;
    }
    // Lines for the same item (e.g. different variants) draw on the same stock together.
    const requested = lines
      .filter((x) => x.itemId === l.itemId)
      .reduce((n, x) => n + x.quantity, 0);
    return requested > available ? `Only ${available} in stock` : undefined;
  };

  // Changing the source warehouse drops items the new one doesn't hold.
  const changeSourceWarehouse = (warehouseId: string) => {
    if (!onHandOnly) {
      // Batches belong to a warehouse, so a new one clears the picks.
      setLines((rows) => rows.map((l) => ({ ...l, lotId: '' })));
      return;
    }
    setLines((rows) =>
      rows.map((l) =>
        l.itemId && stockAt(l.itemId, warehouseId) <= 0
          ? { ...l, itemId: '', variant: '', lotId: '', quantity: 0, unitCost: 0 }
          : { ...l, lotId: '' },
      ),
    );
  };

  // Perishable stock being received carries a manufacturing and expiry date.
  const needsDates = (l: LineRow) =>
    type === 'STOCK_IN' && !!items.find((i) => i.id === l.itemId)?.isPerishable;
  const dateError = (l: LineRow) =>
    needsDates(l) && l.manufactureDate && l.expiryDate && l.expiryDate < l.manufactureDate
      ? 'Expiry must be after the manufacturing date'
      : undefined;

  const lineGrid =
    type === 'STOCK_IN' ? STOCK_IN_LINE_GRID : showBatch ? BATCH_LINE_GRID : LINE_GRID;

  // A perishable item can't be received without an expiry date.
  const missingExpiry = (l: LineRow) => needsDates(l) && !l.expiryDate;

  const save = async (data: PanelFormValues) => {
    if (
      lines.some(
        (l) => !l.itemId || qtyOf(l) <= 0 || stockError(l) || dateError(l) || missingExpiry(l),
      )
    ) {
      setShowLineErrors(true);
      return;
    }
    if (isRevaluation) {
      useRevaluationStore.getState().add({
        reference: data.reference.trim(),
        date: data.date,
        warehouseId: data.warehouseId,
        notes: data.notes.trim() || null,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          variant: l.variant || null,
          quantity: qtyOf(l),
          unitCost: l.unitCost,
        })),
      });
      if (draft) deleteDraft(draft.id);
      toast.success('Price adjustment recorded');
      entry.finishSave({ title: copy.promptTitle, message: copy.promptMessage }, handleClose);
      return;
    }
    const decrease = isAdjustment && data.adjustmentType === 'DECREASE';
    let reasonCode: string | null = null;
    if (isAdjustment) {
      const reasonText = data.reason.trim();
      const known = reasons.find(
        (r) => r.name.toLowerCase() === reasonText.toLowerCase() || r.code === reasonText,
      );
      reasonCode = known ? known.code : (await createReason(reasonText)).code;
    }
    await createMovement({
      type,
      date: data.date,
      reference: data.reference,
      // Adjustment quantities are signed: negative when stock is reduced.
      lines: lines.map((l) => ({
        itemId: l.itemId,
        variant: l.variant || null,
        quantity: decrease ? -l.quantity : l.quantity,
        unitCost: l.unitCost,
        ...(showBatch ? { lotId: l.lotId || null } : {}),
        ...(type === 'STOCK_IN'
          ? {
              lotNumber: l.batchNumber.trim() || null,
              manufactureDate: needsDates(l) ? l.manufactureDate || null : null,
              expiryDate: needsDates(l) ? l.expiryDate || null : null,
            }
          : {}),
      })),
      fromWarehouseId: isOut || isTransfer || decrease ? data.warehouseId : null,
      toWarehouseId: isTransfer ? data.toWarehouseId : isOut || decrease ? null : data.warehouseId,
      source: isTransfer || isAdjustment ? null : data.party.trim() || null,
      reason: reasonCode,
      purpose: isOut ? data.purpose : null,
      notes: data.notes.trim() || null,
    });
    // A supplier or customer typed in the form is kept in the list so it can be picked again.
    const partyName = data.party.trim();
    if (!isTransfer && !isAdjustment && partyName) {
      if (!parties.some((p) => p.name.toLowerCase() === partyName.toLowerCase())) {
        createParty({
          name: partyName,
          contactPerson: null,
          phone: null,
          email: null,
          address: null,
          status: 'ACTIVE',
        }).catch(() => {});
      }
    }
    if (draft) deleteDraft(draft.id);
    toast.success(copy.toast);
    entry.finishSave({ title: copy.promptTitle, message: copy.promptMessage }, handleClose);
  };

  // Drafts skip validation and stay in this browser; nothing reaches the service.
  const handleSaveDraft = () => {
    saveDraft({
      id: draft?.id,
      type,
      form: getValues(),
      lines: lines.map(
        ({
          itemId,
          variant,
          quantity,
          unitCost,
          batchNumber,
          manufactureDate,
          expiryDate,
          lotId,
        }) => ({
          itemId,
          variant,
          quantity,
          unitCost,
          batchNumber,
          manufactureDate,
          expiryDate,
          lotId,
        }),
      ),
    });
    toast.success('Draft saved');
    handleClose();
  };

  const handleDeleteDraft = () => {
    if (!draft) return;
    deleteDraft(draft.id);
    toast.success('Draft deleted');
    handleClose();
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
      title={draft ? `${copy.title} (Draft)` : copy.title}
      description={copy.description}
      {...entry.panelProps}
      footer={
        <div className={cn('flex gap-3', draft ? 'justify-between' : 'justify-end')}>
          {draft && (
            <Button variant="danger" onClick={handleDeleteDraft} disabled={isPending}>
              Delete Draft
            </Button>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isPending}>
              Save Draft
            </Button>
            <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
              {copy.save}
            </Button>
          </div>
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
                      onChange={(v) => {
                        field.onChange(v);
                        changeSourceWarehouse(v);
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              {!isRevaluation && (
                <div className="flex-1 min-w-0">
                  <Controller
                    control={control}
                    name="reason"
                    rules={{ required: 'Select a reason' }}
                    render={({ field, fieldState }) => (
                      <CreatableSearchSelect
                        label="Reason"
                        placeholder="Select or add reason"
                        options={reasonOptions}
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
              <span className="text-sm font-bold text-gray-900">Adjustment Type</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                      changeSourceWarehouse(v);
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
              <Controller
                control={control}
                name="party"
                rules={{
                  maxLength: {
                    value: 150,
                    message: `${copy.partyLabel} cannot exceed 150 characters`,
                  },
                }}
                render={({ field, fieldState }) => (
                  <CreatableSearchSelect
                    label={copy.partyLabel}
                    placeholder={copy.partyPlaceholder}
                    options={partyOptions}
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
                name="warehouseId"
                rules={{ required: 'Select a warehouse' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    label="Warehouse"
                    placeholder="Select warehouse"
                    options={warehouseOptions}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      changeSourceWarehouse(v);
                    }}
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
            <div className={cn(lineGrid, 'hidden bg-gray-50 px-2.5 py-2 sm:grid')}>
              {[
                'Item',
                'Variant',
                ...(showBatch ? ['Batch'] : []),
                'Qty',
                'Unit Cost',
                'Total',
              ].map((h) => (
                <span key={h} className="text-xs font-bold text-gray-900">
                  {h}
                </span>
              ))}
              <span aria-hidden />
            </div>

            <div className="divide-y divide-gray-200">
              {lines.map((line) => (
                <div key={line.key} className="px-1.5 py-2">
                  <div className={cn(lineGrid, 'items-start')}>
                    <SearchSelect
                      placeholder={
                        onHandOnly && !sourceWarehouseId
                          ? 'Select a warehouse first'
                          : 'Select item…'
                      }
                      disabled={onHandOnly && !sourceWarehouseId}
                      options={itemOptions}
                      value={line.itemId}
                      onChange={(v) => pickItem(line.key, v)}
                      error={showLineErrors && !line.itemId ? 'Select an item' : undefined}
                    />
                    {type === 'STOCK_IN' ? (
                      // Receiving stock can name a variant the item doesn't have yet; it is added
                      // to the item's variants on save.
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
                        onChange={(v) => updateLine(line.key, { variant: v, lotId: '' })}
                      />
                    )}
                    {showBatch && (
                      <SearchSelect
                        placeholder={
                          !line.itemId
                            ? 'Select item first'
                            : lotsFor(line).length
                              ? addsStock
                                ? 'No batch'
                                : 'Auto (earliest expiry)'
                              : 'No batches'
                        }
                        disabled={!line.itemId || !sourceWarehouseId || !lotsFor(line).length}
                        options={lotsFor(line).map((x) => ({
                          value: x.id,
                          label: x.lotNumber || 'No batch no.',
                          sublabel: `${x.remainingQuantity} left${x.expiryDate ? ` · exp ${x.expiryDate}` : ''}`,
                        }))}
                        value={line.lotId}
                        onChange={(v) => updateLine(line.key, { lotId: v })}
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <NumberField
                        ariaLabel="Quantity"
                        className="w-full py-2"
                        placeholder="0"
                        decimals={4}
                        value={isRevaluation ? qtyOf(line) : line.quantity}
                        onChange={(v) => updateLine(line.key, { quantity: v })}
                        disabled={isRevaluation}
                        error={
                          isRevaluation
                            ? line.itemId && qtyOf(line) <= 0
                              ? 'Not in stock at this warehouse'
                              : undefined
                            : line.quantity <= 0
                              ? showLineErrors
                                ? 'Enter a quantity'
                                : undefined
                              : stockError(line)
                        }
                      />
                      {drawsStock && line.itemId && sourceWarehouseId && !stockError(line) && (
                        <span className="text-xs text-gray-500">Max: {maxFor(line)}</span>
                      )}
                    </div>
                    <NumberField
                      ariaLabel="Unit cost"
                      className="w-full py-2"
                      value={line.unitCost}
                      onChange={(v) => {
                        if (isRevaluation) updateLine(line.key, { unitCost: v });
                      }}
                      disabled={!isRevaluation}
                    />
                    <NumberField
                      ariaLabel="Total"
                      className="w-full py-2"
                      value={lineTotal(line, qtyOf(line))}
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
                  {type === 'STOCK_IN' && (
                    <div className={cn(lineGrid, 'items-start mt-2')}>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-600">Batch / Lot No.</span>
                        <Input
                          aria-label="Batch / Lot No."
                          placeholder="Optional"
                          maxLength={64}
                          disabled={!line.itemId}
                          value={line.batchNumber}
                          onChange={(e) => updateLine(line.key, { batchNumber: e.target.value })}
                        />
                      </label>
                      {needsDates(line) ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-gray-600">Mfg Date</span>
                          <DatePicker
                            size="sm"
                            placeholder="Mfg date"
                            disableFuture
                            maxDate={line.expiryDate || undefined}
                            value={line.manufactureDate}
                            onChange={(v) => updateLine(line.key, { manufactureDate: v })}
                          />
                        </div>
                      ) : (
                        <span aria-hidden />
                      )}
                      {needsDates(line) && (
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <span className="text-xs font-semibold text-gray-600">Expiry Date</span>
                          <DatePicker
                            size="sm"
                            placeholder="Expiry date"
                            minDate={line.manufactureDate || undefined}
                            value={line.expiryDate}
                            onChange={(v) => updateLine(line.key, { expiryDate: v })}
                            error={
                              dateError(line) ??
                              (showLineErrors && missingExpiry(line)
                                ? 'Expiry date is required'
                                : undefined)
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLines((r) => [...r, newLine()])}
            >
              Add Item
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
