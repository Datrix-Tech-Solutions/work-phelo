'use client';

import { HandHelping, Package, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useForm,
  UseFormRegister,
  UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import {
  AccountingCashbookSettlementMethod,
  CashbookLineKind,
  TransactionTypeDefinition,
} from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCashAccountOptions,
  useCashAccounts,
  useCostCentres,
  useCreateCashbookPayment,
  useCreateCashbookReceipt,
  useCreatePayableBill,
  useCreatePayableCreditNote,
  useCreateReceivableCreditNote,
  useCreateReceivableInvoice,
  useEntityTypes,
  useGLAccountOptions,
  useGLAccounts,
  useMakeSourceLedgerPayment,
  usePayableBills,
  usePostCashbookTransaction,
  useReceivableInvoices,
  useSourceLedger,
  useSubledgers,
  useTransactionTypeRules,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';

function fmtAmount(value: number, currency: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

/** One account a direct receipt/payment posts to — the entry's amount is the sum of its lines. */
type CashLineValues = {
  /** ITEM is what the entry is for; a deduction (discount, withholding tax) reduces the cash
   *  that moves, a charge (input VAT, bank charge) adds to it. */
  kind: CashbookLineKind;
  /** Items only: work the amount out from quantity × unit price (true) or enter it straight.
   *  Starts from the transaction type's setting and can be switched per line. */
  useQtyPrice: boolean;
  glAccountId: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  description: string;
};

const EMPTY_CASH_LINE: CashLineValues = {
  kind: 'ITEM',
  useQtyPrice: true,
  glAccountId: '',
  quantity: '',
  unitPrice: '',
  amount: '',
  description: '',
};

type FormValues = {
  businessRole: string;
  businessEntity: string;
  originalDocumentId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  currency: string;
  costCentreId: string;
  entryDate: string;
  dueDate: string;
  cashAccountId: string;
  offsetGlAccountId: string;
  sourceLedgerEntryId: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
  cashLines: CashLineValues[];
};

/** quantity × unit price, rounded half-up to 2 decimals (EPSILON guards float artefacts like 1.005). */
function computeAmount(quantity: string, unitPrice: string) {
  const product = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return Math.round((product + Number.EPSILON) * 100) / 100;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS: FormValues = {
  businessRole: '',
  businessEntity: '',
  originalDocumentId: '',
  description: '',
  quantity: '',
  unitPrice: '',
  amount: '',
  currency: '',
  costCentreId: '',
  entryDate: '',
  dueDate: '',
  cashAccountId: '',
  offsetGlAccountId: '',
  sourceLedgerEntryId: '',
  settlementMethod: '',
  reference: '',
  cashLines: [EMPTY_CASH_LINE],
};

export function NewTransactionPanel({
  transactionType,
  onClose,
}: {
  transactionType: TransactionTypeDefinition | null | undefined;
  onClose: () => void;
}) {
  const isOpen = transactionType !== null && transactionType !== undefined;
  const isReceivable = transactionType?.category === 'RECEIVABLE';
  const isPayable = transactionType?.category === 'PAYABLE';
  const isSupported = isReceivable || isPayable;
  const hasRule = (transactionType?.rulesCount ?? 0) > 0;
  // A type flagged postsToCashbook (RCPT/PMNT by default, or any Receivable/Payable type
  // opted into it) posts straight to Cashbook — no bill/invoice, no rule required (the
  // offset account can always be picked by hand in the form if no rule set one as default).
  const isCashbookType = transactionType?.postsToCashbook ?? false;
  const isCashbookReceipt = isCashbookType && isReceivable;
  // A linked type is a credit note (receivable) / debit note (payable): it must reference
  // an original posted invoice/bill and reduces what is owed on it.
  const isLinked = !isCashbookType && (transactionType?.isLinked ?? false);
  const canUse = isCashbookType ? isSupported : isSupported && hasRule;
  const toast = useToast();

  const createInvoice = useCreateReceivableInvoice();
  const createBill = useCreatePayableBill();
  const createDocument = isPayable ? createBill : createInvoice;
  const createCreditNote = useCreateReceivableCreditNote();
  const createDebitNote = useCreatePayableCreditNote();
  const createCashbookReceipt = useCreateCashbookReceipt();
  const createCashbookPayment = useCreateCashbookPayment();
  const createCashbookEntry = isCashbookReceipt ? createCashbookReceipt : createCashbookPayment;
  const makeSourceLedgerPayment = useMakeSourceLedgerPayment();
  const postCashbookTransaction = usePostCashbookTransaction();
  const isSaving = isCashbookType
    ? createCashbookEntry.isPending ||
      makeSourceLedgerPayment.isPending ||
      postCashbookTransaction.isPending
    : createDocument.isPending || createCreditNote.isPending || createDebitNote.isPending;
  const [pendingAction, setPendingAction] = useState<'draft' | 'post' | null>(null);

  // A type linked to a Source shows a dropdown of that source's still-unpaid open items —
  // picking one settles it directly (creates the payment AND records the allocation in one
  // action) instead of an untracked generic cashbook entry.
  const { data: unpaidSourceLedgerEntries = [] } = useSourceLedger({
    sourceTypeId: transactionType?.sourceTypeId ?? undefined,
    status: 'UNPAID',
  });
  const sourceLedgerOptions = useMemo<SearchSelectOption[]>(
    () =>
      unpaidSourceLedgerEntries.map((entry) => ({
        value: entry.id,
        label: `${entry.description} — ${fmtAmount(entry.outstandingAmount, entry.currency)} outstanding`,
      })),
    [unpaidSourceLedgerEntries],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: entityTypesData = [] } = useEntityTypes();
  const { data: rules = [] } = useTransactionTypeRules();
  const rule = useMemo(
    () => rules.find((r) => r.transactionTypeId === transactionType?.id),
    [rules, transactionType],
  );
  // The rule's Deduction lines — each backed by a TaxType and shown as its own
  // checkbox, since a single invoice can apply more than one at once.
  const taxLines = useMemo(
    () =>
      (rule?.lines ?? [])
        .filter((line) => line.taxType && !line.settlementKind)
        .map((line) => ({
          taxTypeId: line.taxType!.id,
          name: line.taxType!.name,
          rate: line.taxType!.rate,
        })),
    [rule],
  );
  const { data: costCentres = [] } = useCostCentres();
  const { data: glAccounts = [] } = useGLAccounts();
  const { options: glAccountOptions, isLoading: isLoadingGlAccounts } = useGLAccountOptions();
  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();
  const costCentreOptions = useMemo<SearchSelectOption[]>(
    () =>
      costCentres
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [costCentres],
  );
  // The rule's main (non-tax, non-control) line. A linked type's rule is written in the note's
  // own direction, so its control line flips.
  const controlDirection = isReceivable !== isLinked ? 'DR' : 'CR';
  const mainLine = useMemo(
    () =>
      (rule?.lines ?? []).find(
        (l) => !l.taxType && !l.settlementKind && l.direction !== controlDirection,
      ),
    [rule, controlDirection],
  );
  // A scoped main line has no fixed account — the user picks one inside its category or
  // classification, and the backend re-checks the pick against the same scope.
  const isScopedMainLine = !isCashbookType && !!mainLine && !mainLine.account;
  const controlAccountId = (rule?.lines ?? []).find(
    (l) => !l.taxType && !l.settlementKind && l.direction === controlDirection,
  )?.account?.id;
  const { data: cashAccounts = [] } = useCashAccounts();
  const scopedAccountOptions = useMemo<SearchSelectOption[]>(() => {
    if (!isScopedMainLine || !mainLine) return [];
    const cashGlIds = new Set(cashAccounts.map((c) => c.glAccountId));
    // The backend only accepts leaf accounts, so a parent account is never offered.
    const parentIds = new Set(
      glAccounts.flatMap((a) => (a.parentAccountId ? [a.parentAccountId] : [])),
    );
    return glAccounts
      .filter(
        (a) =>
          a.status === 'ACTIVE' &&
          a.allowPosting &&
          !parentIds.has(a.id) &&
          a.id !== controlAccountId &&
          !cashGlIds.has(a.id) &&
          (mainLine.scopeClassification
            ? a.classificationId === mainLine.scopeClassification.id
            : a.category === mainLine.scopeCategory),
      )
      .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }));
  }, [isScopedMainLine, mainLine, glAccounts, cashAccounts, controlAccountId]);
  const pickedOffsetAccountId = useWatch({ control, name: 'offsetGlAccountId' });
  // The department tag lands on the main line — hide the field when that account is a
  // balance-sheet one (e.g. an asset purchase), since there is no P&L cost to attribute.
  // While accounts are still loading, err on the side of showing it.
  const showCostCentre = useMemo(() => {
    const category = mainLine?.account
      ? glAccounts.find((a) => a.id === mainLine.account?.id)?.category
      : isScopedMainLine
        ? (glAccounts.find((a) => a.id === pickedOffsetAccountId)?.category ??
          mainLine?.scopeClassification?.category ??
          mainLine?.scopeCategory)
        : undefined;
    return !category || category === 'EXPENSE' || category === 'REVENUE';
  }, [mainLine, glAccounts, isScopedMainLine, pickedOffsetAccountId]);
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = useState<string[]>([]);
  const [successInfo, setSuccessInfo] = useState<{ name: string; posted: boolean } | null>(null);

  // Only the roles actually configured on this transaction type — not the tenant's full
  // Entity Types list — and any of them works now, not just the old fixed enum names.
  const businessRoleOptions = useMemo<SearchSelectOption[]>(() => {
    const configured = transactionType?.businessRoles ?? [];
    if (isCashbookType && configured.length === 0) {
      return entityTypesData.map((t) => ({ value: t.name.trim().toUpperCase(), label: t.name }));
    }
    return configured.map((role) => ({
      value: role,
      label: entityTypesData.find((t) => t.name.trim().toUpperCase() === role)?.name ?? role,
    }));
  }, [transactionType, entityTypesData, isCashbookType]);

  const businessRole = useWatch({ control, name: 'businessRole' });
  const businessEntity = useWatch({ control, name: 'businessEntity' });
  const manualAmount = useWatch({ control, name: 'amount' });
  const quantity = useWatch({ control, name: 'quantity' });
  const unitPrice = useWatch({ control, name: 'unitPrice' });
  const currency = useWatch({ control, name: 'currency' });
  const sourceLedgerEntryId = useWatch({ control, name: 'sourceLedgerEntryId' });

  // Source-linked types (e.g. payroll) settle an existing open item, so the amount is keyed in
  // directly; everything else derives it from quantity × unit price.
  // A type can also opt out of quantity × unit price and take a straight amount.
  const hasSource = !!transactionType?.sourceTypeId;
  const isDirectAmount = hasSource || transactionType?.usesQuantityPrice === false;
  const derivedAmount = computeAmount(quantity, unitPrice);
  const subtotal = isDirectAmount ? Number(manualAmount) || 0 : derivedAmount;
  const resolveAmount = (values: FormValues) =>
    isDirectAmount ? Number(values.amount) : computeAmount(values.quantity, values.unitPrice);

  // A direct receipt/payment can post to several accounts against one cash line. Types tied to
  // a source keep the single-account form, since they settle one open item.
  const usesLines = isCashbookType && !hasSource;
  const {
    fields: cashLineFields,
    append: appendCashLine,
    remove: removeCashLine,
  } = useFieldArray({ control, name: 'cashLines' });
  const cashLines = useWatch({ control, name: 'cashLines' });
  // Quantity × price only applies to items that use it; a deduction or charge, and any item
  // switched to a straight amount, is just the amount typed.
  const cashLineAmount = (line: CashLineValues) =>
    line.kind !== 'ITEM' || !line.useQtyPrice
      ? Number(line.amount) || 0
      : computeAmount(line.quantity, line.unitPrice);
  const sumOfKind = (kinds: CashbookLineKind[]) =>
    (cashLines ?? [])
      .filter((line) => kinds.includes(line.kind))
      .reduce((sum, line) => sum + cashLineAmount(line), 0);
  const itemsTotal = sumOfKind(['ITEM']);
  const chargesTotal = sumOfKind(['CHARGE']);
  const deductionsTotal = sumOfKind(['DEDUCTION']);
  // The cash that actually moves — what the bank statement will show.
  const cashLinesTotal = itemsTotal + chargesTotal - deductionsTotal;
  const taxBreakdown = taxLines
    .filter((line) => selectedTaxTypeIds.includes(line.taxTypeId))
    .map((line) => ({ ...line, amount: (subtotal * line.rate) / 100 }));
  const taxAmount = taxBreakdown.reduce((sum, line) => sum + line.amount, 0);
  const total = subtotal + taxAmount;

  // A blank form with the transaction type's defaults — used on every fresh open, and
  // between entries while the panel is locked for multiple entries.
  function resetForNextEntry() {
    const configuredRoles = transactionType?.businessRoles ?? [];
    reset({
      ...DEFAULTS,
      businessRole: configuredRoles.length === 1 ? configuredRoles[0] : '',
      entryDate: today(),
      cashAccountId: rule?.defaultCashAccountId ?? '',
      offsetGlAccountId: rule?.lines?.[0]?.account?.id ?? '',
      cashLines: [
        {
          ...EMPTY_CASH_LINE,
          useQtyPrice: transactionType?.usesQuantityPrice !== false,
          glAccountId: rule?.lines?.[0]?.account?.id ?? '',
        },
      ],
    });
    setSelectedTaxTypeIds([]);
  }

  // Reset the form whenever a fresh "open" happens (rather than in an effect, to avoid
  const openKey = isOpen ? (transactionType?.id ?? 'unknown') : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== null && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    resetForNextEntry();
  }

  const { data: entities = [], isLoading: isLoadingEntities } = useSubledgers(
    businessRole ? { type: businessRole, status: 'ACTIVE' } : { status: 'ACTIVE' },
  );
  const entityOptions = useMemo<SearchSelectOption[]>(
    () => entities.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` })),
    [entities],
  );

  // A linked type picks the entity's open, posted invoice (receivable) / bill (payable) it
  // reduces. Only fetched once an entity is chosen; the backend re-checks everything.
  const originalDocumentsEnabled = isOpen && isLinked && !!businessEntity;
  const originalInvoices = useReceivableInvoices(
    { status: 'POSTED', partyId: businessEntity || undefined, limit: 100 },
    { enabled: originalDocumentsEnabled && isReceivable },
  );
  const originalBills = usePayableBills(
    { status: 'POSTED', partyId: businessEntity || undefined, limit: 100 },
    { enabled: originalDocumentsEnabled && isPayable },
  );
  const originalDocuments = useMemo(
    () =>
      ((isPayable ? originalBills.data?.items : originalInvoices.data?.items) ?? []).filter(
        (doc) => doc.party.id === businessEntity && Number(doc.outstandingAmount ?? 0) > 0,
      ),
    [isPayable, originalBills.data, originalInvoices.data, businessEntity],
  );
  const originalDocumentOptions = useMemo<SearchSelectOption[]>(
    () =>
      originalDocuments.map((doc) => ({
        value: doc.id,
        label: `${doc.documentNumber} — ${fmtAmount(Number(doc.outstandingAmount), doc.currency)} outstanding`,
      })),
    [originalDocuments],
  );
  const isLoadingOriginals = isPayable ? originalBills.isLoading : originalInvoices.isLoading;

  const close = () => {
    reset(DEFAULTS);
    setSelectedTaxTypeIds([]);
    onClose();
  };

  const entry = useMultiEntryPanel({
    isOpen,
    onStop: close,
    onContinue: resetForNextEntry,
  });

  // Success feedback for a saved entry. Unlocked: close and show the usual modal. Locked:
  // the panel stays open and its Continue / Stop prompt takes the modal's place.
  const finishSave = (posted: boolean) => {
    const name = transactionType?.name ?? '';
    entry.finishSave(
      {
        title: posted ? 'Transaction Posted!' : 'Transaction Submitted!',
        message: posted
          ? `Your ${name} has been posted.`
          : `Your ${name} has been submitted for review.`,
      },
      () => {
        close();
        setSuccessInfo({ name, posted });
      },
    );
  };

  const toggleTaxType = (taxTypeId: string) => {
    setSelectedTaxTypeIds((prev) =>
      prev.includes(taxTypeId) ? prev.filter((id) => id !== taxTypeId) : [...prev, taxTypeId],
    );
  };

  // `post`: only meaningful for a plain direct entry (no Settle Item picked) — Submit for
  // Review leaves it DRAFT (the normal process, matching Bills/Invoices/every other
  // transaction), Post creates it and immediately posts it. Picking a Settle Item always
  // posts regardless of which button was clicked — settling a specific open item only makes
  // sense once the payment actually happens, so there's no meaningful "draft" version of it.
  const submit = async (values: FormValues, post: boolean) => {
    if (!transactionType) return;

    if (isCashbookType) {
      if (!values.cashAccountId) {
        toast.error('Select a cash/bank account');
        return;
      }
      if (usesLines) {
        if (values.cashLines.some((line) => !line.glAccountId)) {
          toast.error(
            `Select the account to ${isCashbookReceipt ? 'credit' : 'debit'} on every line`,
          );
          return;
        }
        if (values.cashLines.some((line) => !(cashLineAmount(line) > 0))) {
          toast.error('Every line needs an amount above zero');
          return;
        }
        if (!values.cashLines.some((line) => line.kind === 'ITEM')) {
          toast.error('Add at least one item line');
          return;
        }
        if (!(cashLinesTotal > 0)) {
          toast.error(
            `The deductions leave nothing to ${isCashbookReceipt ? 'receive' : 'pay'} — the net amount must be above zero`,
          );
          return;
        }
      } else if (!values.offsetGlAccountId) {
        toast.error(`Select the account to ${isCashbookReceipt ? 'credit' : 'debit'}`);
        return;
      }
      if (!values.settlementMethod) {
        toast.error('Select a settlement method');
        return;
      }
      const willPost = !!values.sourceLedgerEntryId || post;
      setPendingAction(willPost ? 'post' : 'draft');
      try {
        // Settling a picked source ledger item creates the payment AND records the
        // allocation against it in one call — a generic cashbook entry has no concept of
        // "which open item this settles", so it can't be used once one is selected.
        if (values.sourceLedgerEntryId) {
          await makeSourceLedgerPayment.mutateAsync({
            entryId: values.sourceLedgerEntryId,
            payload: {
              cashAccountId: values.cashAccountId,
              transactionTypeId: transactionType.id,
              amount: resolveAmount(values),
              transactionDate: values.entryDate || today(),
              settlementMethod: values.settlementMethod,
              description: values.description || undefined,
            },
          });
        } else {
          const created = await createCashbookEntry.mutateAsync({
            cashAccountId: values.cashAccountId,
            transactionTypeId: transactionType.id,
            ...(usesLines
              ? {
                  lines: values.cashLines.map((line) => ({
                    kind: line.kind,
                    glAccountId: line.glAccountId,
                    amount: cashLineAmount(line),
                    ...(line.kind !== 'ITEM' || !line.useQtyPrice
                      ? {}
                      : { quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }),
                    description: line.description || undefined,
                  })),
                }
              : {
                  offsetGlAccountId: values.offsetGlAccountId,
                  amount: resolveAmount(values),
                  ...(isDirectAmount
                    ? {}
                    : { quantity: Number(values.quantity), unitPrice: Number(values.unitPrice) }),
                }),
            currency: values.currency,
            transactionDate: values.entryDate || today(),
            settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
            ...(values.businessEntity && values.businessRole
              ? { counterpartyType: values.businessRole, counterpartyId: values.businessEntity }
              : {}),
            reference: values.reference || undefined,
            description: values.description || transactionType.name,
          });
          if (post) {
            await postCashbookTransaction.mutateAsync(created.id);
          }
        }
        finishSave(willPost);
      } catch (error) {
        toast.error(extractError(error, 'Failed to save transaction'));
      } finally {
        setPendingAction(null);
      }
      return;
    }

    const entity = entities.find((e) => e.id === values.businessEntity);
    if (!entity) {
      toast.error('Select a business entity');
      return;
    }
    if (isScopedMainLine && !values.offsetGlAccountId) {
      toast.error('Select the account for this transaction');
      return;
    }
    const scopedOffset = isScopedMainLine ? { offsetGlAccountId: values.offsetGlAccountId } : {};

    if (isLinked) {
      const original = originalDocuments.find((doc) => doc.id === values.originalDocumentId);
      if (!original) {
        toast.error(`Select the original ${isPayable ? 'bill' : 'invoice'}`);
        return;
      }
      if (subtotal + taxAmount > Number(original.outstandingAmount)) {
        toast.error(
          `Total exceeds the ${isPayable ? 'bill' : 'invoice'}'s outstanding balance (${fmtAmount(Number(original.outstandingAmount), original.currency)})`,
        );
        return;
      }
      try {
        await (isPayable ? createDebitNote : createCreditNote).mutateAsync({
          partyId: values.businessEntity,
          documentDate: values.entryDate || today(),
          currency: values.currency,
          amount: resolveAmount(values),
          ...(isDirectAmount
            ? {}
            : { quantity: Number(values.quantity), unitPrice: Number(values.unitPrice) }),
          transactionTypeId: transactionType.id,
          ...scopedOffset,
          originalDocumentId: values.originalDocumentId,
          selectedTaxTypeIds: selectedTaxTypeIds.length ? selectedTaxTypeIds : undefined,
          costCentreId: showCostCentre && values.costCentreId ? values.costCentreId : undefined,
          description: values.description || undefined,
        });
        finishSave(false);
      } catch (error) {
        toast.error(extractError(error, 'Failed to save transaction'));
      }
      return;
    }

    const payload = {
      partyId: values.businessEntity,
      documentDate: values.entryDate || today(),
      dueDate: values.dueDate || undefined,
      currency: values.currency,
      amount: resolveAmount(values),
      ...(isDirectAmount
        ? {}
        : { quantity: Number(values.quantity), unitPrice: Number(values.unitPrice) }),
      transactionTypeId: transactionType.id,
      ...scopedOffset,
      selectedTaxTypeIds: selectedTaxTypeIds.length ? selectedTaxTypeIds : undefined,
      costCentreId: showCostCentre && values.costCentreId ? values.costCentreId : undefined,
      description: values.description || undefined,
      // No externalReference here — the system generates the transaction/document
      // number itself (e.g. INV-2026-0001) once the document is created.
    };

    try {
      await createDocument.mutateAsync(payload);
      finishSave(false);
    } catch (error) {
      toast.error(extractError(error, 'Failed to save transaction'));
    }
  };

  const amountFields = isDirectAmount ? (
    <div className="grid grid-cols-2 gap-3">
      <Controller
        name="amount"
        control={control}
        rules={{
          required: 'Amount is required',
          min: { value: 0.01, message: 'Amount must be greater than 0' },
        }}
        render={({ field }) => (
          <NumberField
            label="Amount"
            value={Number(field.value) || 0}
            onChange={(value) => field.onChange(String(value))}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        name="currency"
        control={control}
        rules={{ required: 'Currency is required' }}
        render={({ field }) => (
          <SearchSelect
            label="Currency"
            placeholder="Select currency…"
            options={currencyOptions}
            value={field.value}
            onChange={field.onChange}
            error={errors.currency?.message}
          />
        )}
      />
    </div>
  ) : (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="quantity"
          control={control}
          rules={{
            required: 'Quantity is required',
            validate: (v) => Number(v) > 0 || 'Quantity must be greater than 0',
          }}
          render={({ field }) => (
            <NumberField
              label="Quantity"
              placeholder="0"
              value={Number(field.value) || 0}
              onChange={(value) => field.onChange(String(value))}
              error={errors.quantity?.message}
            />
          )}
        />
        <Controller
          name="unitPrice"
          control={control}
          rules={{
            required: 'Unit price is required',
            validate: (v) => Number(v) > 0 || 'Unit price must be greater than 0',
          }}
          render={({ field }) => (
            <NumberField
              label="Unit Price"
              value={Number(field.value) || 0}
              onChange={(value) => field.onChange(String(value))}
              error={errors.unitPrice?.message}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Amount" value={derivedAmount} onChange={() => {}} disabled />
        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />
      </div>
    </>
  );

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={close}
        {...entry.panelProps}
        title="New Transaction"
        description={
          transactionType ? `Recording a ${transactionType.name.toLowerCase()}.` : undefined
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={close} disabled={isSaving}>
              Cancel
            </Button>
            {canUse && isCashbookType && !sourceLedgerEntryId && (
              <Button
                variant="outline"
                isLoading={pendingAction === 'draft'}
                loadingText="Submitting…"
                disabled={isSaving}
                onClick={handleSubmit((values) => submit(values, false))}
              >
                Submit for Review
              </Button>
            )}
            {canUse && (
              <Button
                variant="primary"
                isLoading={isCashbookType ? pendingAction === 'post' : isSaving}
                loadingText={
                  !isCashbookType ? 'Submitting…' : isCashbookReceipt ? 'Receiving…' : 'Paying…'
                }
                disabled={isSaving}
                onClick={handleSubmit((values) => submit(values, true))}
              >
                {!isCashbookType
                  ? 'Submit for Review'
                  : isCashbookReceipt
                    ? 'Receive Payment'
                    : 'Make Payment'}
              </Button>
            )}
          </div>
        }
      >
        {!isSupported ? (
          <p className="text-sm text-gray-500">
            Forms for {transactionType?.category.toLowerCase() ?? 'this'} transaction types are
            coming soon.
          </p>
        ) : !isCashbookType && !hasRule ? (
          <p className="text-sm text-gray-500">
            {transactionType?.name} has no rule configured yet. Add one under Settings → Transaction
            Types before creating transactions of this type.
          </p>
        ) : isCashbookType ? (
          <div className="flex flex-col gap-3">
            <Input
              label="Transaction Type"
              readOnly
              value={transactionType ? `${transactionType.name} (${transactionType.code})` : ''}
            />

            {!hasRule && !transactionType?.sourceTypeId && (
              <p className="text-xs text-gray-500">
                No rule configured for this type yet — pick the accounts below directly, or add a
                default rule under Settings → Transaction Types.
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {transactionType?.sourceTypeId ? (
                <div className="sm:col-span-2">
                  <Controller
                    name="sourceLedgerEntryId"
                    control={control}
                    render={({ field }) => (
                      <SearchSelect
                        label="Settle Item"
                        placeholder={
                          unpaidSourceLedgerEntries.length === 0
                            ? 'No unpaid items right now'
                            : 'Select an item to settle (optional)…'
                        }
                        options={sourceLedgerOptions}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          const entry = unpaidSourceLedgerEntries.find((e) => e.id === value);
                          if (entry) {
                            setValue('offsetGlAccountId', entry.glAccount.id);
                            setValue('amount', String(entry.outstandingAmount));
                            setValue('currency', entry.currency);
                          }
                        }}
                      />
                    )}
                  />
                </div>
              ) : (
                <>
                  <Controller
                    name="businessRole"
                    control={control}
                    render={({ field }) => (
                      <SearchSelect
                        label="Business Role"
                        placeholder="Optional — select a role…"
                        options={businessRoleOptions}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          setValue('businessEntity', '');
                        }}
                      />
                    )}
                  />
                  <Controller
                    name="businessEntity"
                    control={control}
                    render={({ field }) => (
                      <SearchSelect
                        label="Business Entity"
                        placeholder={
                          !businessRole
                            ? 'Select a role first…'
                            : isLoadingEntities
                              ? 'Loading…'
                              : 'Optional — select an entity…'
                        }
                        options={entityOptions}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          const entity = entities.find((e) => e.id === value);
                          if (entity?.currency) setValue('currency', entity.currency);
                        }}
                        disabled={!businessRole}
                      />
                    )}
                  />
                </>
              )}
              <Controller
                name="entryDate"
                control={control}
                rules={{ required: 'Date is required' }}
                render={({ field }) => (
                  <DatePicker
                    label={`${transactionType?.name ?? 'Transaction'} Date`}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.entryDate?.message}
                  />
                )}
              />
            </div>

            <div
              className={`grid grid-cols-1 gap-2 ${usesLines ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
            >
              <Controller
                name="cashAccountId"
                control={control}
                rules={{ required: 'Cash/bank account is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Cash/Bank Account"
                    placeholder={isLoadingCashAccounts ? 'Loading…' : 'Select cash/bank account…'}
                    options={cashAccountOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.cashAccountId?.message}
                  />
                )}
              />
              {usesLines && (
                <Controller
                  name="currency"
                  control={control}
                  rules={{ required: 'Currency is required' }}
                  render={({ field }) => (
                    <SearchSelect
                      label="Currency"
                      placeholder="Select currency…"
                      options={currencyOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.currency?.message}
                    />
                  )}
                />
              )}
              <Controller
                name="settlementMethod"
                control={control}
                rules={{ required: 'Settlement method is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label={isCashbookReceipt ? 'Method of Receipt' : 'Method of Payment'}
                    placeholder="Select method…"
                    options={SETTLEMENT_METHOD_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.settlementMethod?.message}
                  />
                )}
              />
            </div>

            <FormField
              label="Reference"
              registration={register('reference')}
              placeholder="Optional bank/cheque reference"
            />

            <FormField
              label="Description"
              type="textarea"
              rows={2}
              registration={register('description')}
              placeholder={`What is this ${transactionType?.name.toLowerCase() ?? 'transaction'} for?`}
            />

            {usesLines ? (
              <CashEntryLines
                control={control}
                register={register}
                errors={errors}
                fields={cashLineFields}
                lines={cashLines ?? []}
                setValue={setValue}
                defaultUseQtyPrice={transactionType?.usesQuantityPrice !== false}
                accountLabel={isCashbookReceipt ? 'Account to Credit' : 'Account to Debit'}
                accountOptions={glAccountOptions}
                isLoadingAccounts={isLoadingGlAccounts}
                total={cashLinesTotal}
                itemsTotal={itemsTotal}
                chargesTotal={chargesTotal}
                deductionsTotal={deductionsTotal}
                isReceipt={isCashbookReceipt}
                currency={currency}
                lineAmount={cashLineAmount}
                onAdd={(kind) =>
                  appendCashLine({
                    ...EMPTY_CASH_LINE,
                    kind,
                    useQtyPrice: transactionType?.usesQuantityPrice !== false,
                  })
                }
                onRemove={removeCashLine}
              />
            ) : (
              <>
                <Controller
                  name="offsetGlAccountId"
                  control={control}
                  rules={{ required: 'Account is required' }}
                  render={({ field }) => (
                    <SearchSelect
                      label={isCashbookReceipt ? 'Account to Credit' : 'Account to Debit'}
                      placeholder={isLoadingGlAccounts ? 'Loading…' : 'Select account…'}
                      options={glAccountOptions}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!!sourceLedgerEntryId}
                      error={errors.offsetGlAccountId?.message}
                    />
                  )}
                />

                {amountFields}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              label="Transaction Type"
              readOnly
              value={transactionType ? `${transactionType.name} (${transactionType.code})` : ''}
            />

            <Controller
              name="businessRole"
              control={control}
              rules={{ required: 'Business role is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Business Role"
                  placeholder="Select a business role…"
                  options={businessRoleOptions}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue('businessEntity', '');
                  }}
                  error={errors.businessRole?.message}
                />
              )}
            />

            <Controller
              name="businessEntity"
              control={control}
              rules={{ required: 'Business entity is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Business Entity"
                  placeholder={
                    !businessRole
                      ? 'Select a business role first…'
                      : isLoadingEntities
                        ? 'Loading…'
                        : 'Select an entity…'
                  }
                  options={entityOptions}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue('originalDocumentId', '');
                    const entity = entities.find((e) => e.id === value);
                    if (entity?.currency) setValue('currency', entity.currency);
                  }}
                  error={errors.businessEntity?.message}
                />
              )}
            />

            {isLinked && (
              <Controller
                name="originalDocumentId"
                control={control}
                rules={{ required: `Original ${isPayable ? 'bill' : 'invoice'} is required` }}
                render={({ field }) => (
                  <SearchSelect
                    label={`Original ${isPayable ? 'Bill' : 'Invoice'}`}
                    placeholder={
                      !businessEntity
                        ? 'Select a business entity first…'
                        : isLoadingOriginals
                          ? 'Loading…'
                          : originalDocumentOptions.length === 0
                            ? `No open ${isPayable ? 'bills' : 'invoices'} for this entity`
                            : `Select the ${isPayable ? 'bill' : 'invoice'} this reduces…`
                    }
                    options={originalDocumentOptions}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      const original = originalDocuments.find((doc) => doc.id === value);
                      if (original) setValue('currency', original.currency);
                    }}
                    disabled={!businessEntity}
                    error={errors.originalDocumentId?.message}
                  />
                )}
              />
            )}

            {isScopedMainLine && (
              <Controller
                name="offsetGlAccountId"
                control={control}
                rules={{ required: 'Account is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label={`Account to ${controlDirection === 'CR' ? 'Debit' : 'Credit'}`}
                    placeholder={
                      scopedAccountOptions.length === 0
                        ? 'No accounts available for this transaction type'
                        : 'Select account…'
                    }
                    options={scopedAccountOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.offsetGlAccountId?.message}
                  />
                )}
              />
            )}

            {showCostCentre && (
              <Controller
                name="costCentreId"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    label="Cost Centre"
                    placeholder="Optional — select a cost centre"
                    options={costCentreOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}

            <FormField
              label="Description"
              type="textarea"
              registration={register('description')}
              error={errors.description}
              placeholder="Optional description"
            />

            {amountFields}

            {taxLines.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                <span className="text-sm font-bold text-gray-900">Tax</span>
                {taxLines.map((line) => (
                  <label key={line.taxTypeId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTaxTypeIds.includes(line.taxTypeId)}
                      onChange={() => toggleTaxType(line.taxTypeId)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      {line.name} ({line.rate}%)
                    </span>
                  </label>
                ))}

                {taxBreakdown.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-gray-900">{fmtAmount(subtotal, currency)}</span>
                    </div>
                    {taxBreakdown.map((line) => (
                      <div key={line.taxTypeId} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {line.name} ({line.rate}%)
                        </span>
                        <span className="text-gray-900">{fmtAmount(line.amount, currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-semibold">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">{fmtAmount(total, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="entryDate"
                control={control}
                rules={{ required: 'Entry date is required' }}
                render={({ field }) => (
                  <DatePicker
                    label="Entry Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.entryDate?.message}
                  />
                )}
              />
              {!isLinked && (
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Due Date"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.dueDate?.message}
                    />
                  )}
                />
              )}
            </div>
          </div>
        )}
      </SidePanel>
      <SuccessModal
        isOpen={!!successInfo}
        onClose={() => setSuccessInfo(null)}
        title={successInfo?.posted ? 'Transaction Posted!' : 'Transaction Submitted!'}
        message={
          successInfo?.posted
            ? `Your ${successInfo.name} has been posted.`
            : `Your ${successInfo?.name ?? ''} has been submitted for review.`
        }
      />
    </>
  );
}

/** The accounts a direct receipt or payment posts to — one card per line, with the cash that
 *  actually moves at the bottom. A deduction (discount, withholding tax) reduces that cash and a
 *  charge (input VAT, bank charge) adds to it; the user never has to think in debits and credits. */
function CashEntryLines({
  control,
  register,
  errors,
  fields,
  lines,
  setValue,
  defaultUseQtyPrice,
  accountLabel,
  accountOptions,
  isLoadingAccounts,
  total,
  itemsTotal,
  chargesTotal,
  deductionsTotal,
  isReceipt,
  currency,
  lineAmount,
  onAdd,
  onRemove,
}: {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  fields: { id: string }[];
  lines: CashLineValues[];
  setValue: UseFormSetValue<FormValues>;
  defaultUseQtyPrice: boolean;
  accountLabel: string;
  accountOptions: SearchSelectOption[];
  isLoadingAccounts: boolean;
  total: number;
  itemsTotal: number;
  chargesTotal: number;
  deductionsTotal: number;
  isReceipt: boolean;
  currency: string;
  lineAmount: (line: CashLineValues) => number;
  onAdd: (kind: CashbookLineKind) => void;
  onRemove: (index: number) => void;
}) {
  const verb = isReceipt ? 'received' : 'paid';
  const itemCount = lines.filter((line) => line.kind === 'ITEM').length;
  const hasAdjustments = deductionsTotal > 0 || chargesTotal > 0;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-gray-900">Lines</span>

      {fields.map((field, index) => {
        const lineErrors = errors.cashLines?.[index];
        const kind = lines[index]?.kind ?? 'ITEM';
        const isItem = kind === 'ITEM';
        const useQtyPrice = isItem && (lines[index]?.useQtyPrice ?? defaultUseQtyPrice);
        const accountFieldLabel = isItem
          ? accountLabel
          : kind === 'DEDUCTION'
            ? `Deduction (reduces the cash ${verb})`
            : `Charge (adds to the cash ${verb})`;

        const accountField = (
          <Controller
            name={`cashLines.${index}.glAccountId`}
            control={control}
            rules={{ required: 'Account is required' }}
            render={({ field: f }) => (
              <SearchSelect
                label={accountFieldLabel}
                placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
                options={accountOptions}
                value={f.value}
                onChange={f.onChange}
                error={lineErrors?.glAccountId?.message}
              />
            )}
          />
        );
        const amountField = (
          <Controller
            name={`cashLines.${index}.amount`}
            control={control}
            rules={{
              validate: (v) => Number(v) > 0 || 'Amount must be greater than 0',
            }}
            render={({ field: f }) => (
              <NumberField
                label="Amount"
                value={Number(f.value) || 0}
                onChange={(value) => f.onChange(String(value))}
                error={lineErrors?.amount?.message}
              />
            )}
          />
        );
        const descriptionField = (
          <FormField
            label="Description"
            registration={register(`cashLines.${index}.description`)}
            placeholder={isItem ? 'Optional' : 'e.g. Early payment discount, VAT, bank charge'}
          />
        );
        // The switch (items only) and remove icon sit last on the row.
        const actions = (
          <div className="flex items-center gap-1 pb-1.5">
            {isItem && (
              <button
                type="button"
                role="switch"
                aria-checked={useQtyPrice}
                aria-label={useQtyPrice ? 'Goods' : 'Service'}
                title={
                  useQtyPrice
                    ? 'Goods (quantity × unit price) — click for a service, a straight amount'
                    : 'Service (straight amount) — click for goods, quantity × unit price'
                }
                onClick={() => {
                  const line = lines[index];
                  if (!line) return;
                  // Carry the figure across so switching never loses what was typed.
                  if (useQtyPrice) {
                    setValue(`cashLines.${index}.amount`, String(lineAmount(line) || ''));
                  } else {
                    setValue(`cashLines.${index}.quantity`, '1');
                    setValue(`cashLines.${index}.unitPrice`, line.amount);
                  }
                  setValue(`cashLines.${index}.useQtyPrice`, !useQtyPrice);
                }}
                className={`rounded-md p-1.5 transition-colors ${
                  useQtyPrice
                    ? 'bg-brand/10 text-brand'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
              >
                {useQtyPrice ? <Package size={15} /> : <HandHelping size={15} />}
              </button>
            )}
            {!isItem || itemCount > 1 ? (
              <button
                type="button"
                aria-label="Remove line"
                title="Remove line"
                onClick={() => onRemove(index)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <span className="w-[27px]" aria-hidden />
            )}
          </div>
        );

        return (
          <div key={field.id} className="rounded-xl border border-gray-200 p-2.5">
            {useQtyPrice ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
                  {accountField}
                  <Controller
                    name={`cashLines.${index}.quantity`}
                    control={control}
                    rules={{ validate: (v) => Number(v) > 0 || 'Must be above 0' }}
                    render={({ field: f }) => (
                      <NumberField
                        label="Quantity"
                        placeholder="0"
                        value={Number(f.value) || 0}
                        onChange={(value) => f.onChange(String(value))}
                        error={lineErrors?.quantity?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`cashLines.${index}.unitPrice`}
                    control={control}
                    rules={{ validate: (v) => Number(v) > 0 || 'Must be above 0' }}
                    render={({ field: f }) => (
                      <NumberField
                        label="Unit Price"
                        value={Number(f.value) || 0}
                        onChange={(value) => f.onChange(String(value))}
                        error={lineErrors?.unitPrice?.message}
                      />
                    )}
                  />
                  <NumberField
                    label="Amount"
                    value={lines[index] ? lineAmount(lines[index]) : 0}
                    onChange={() => {}}
                    disabled
                  />
                  {actions}
                </div>
                {descriptionField}
              </div>
            ) : (
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_minmax(0,2fr)_auto]">
                {accountField}
                {amountField}
                {descriptionField}
                {actions}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onAdd('ITEM')}>
          Add Line
        </Button>
        <Button type="button" variant="outline" onClick={() => onAdd('DEDUCTION')}>
          Add Deduction
        </Button>
        <Button type="button" variant="outline" onClick={() => onAdd('CHARGE')}>
          Add Charge
        </Button>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-gray-50 px-3 py-2 text-sm">
        {hasAdjustments && (
          <>
            <div className="flex items-center justify-between text-gray-600">
              <span>Amount</span>
              <span>{fmtAmount(itemsTotal, currency)}</span>
            </div>
            {deductionsTotal > 0 && (
              <div className="flex items-center justify-between text-gray-600">
                <span>Less deductions</span>
                <span>− {fmtAmount(deductionsTotal, currency)}</span>
              </div>
            )}
            {chargesTotal > 0 && (
              <div className="flex items-center justify-between text-gray-600">
                <span>Plus charges</span>
                <span>+ {fmtAmount(chargesTotal, currency)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Cash {verb}</span>
          <span className="font-semibold text-gray-900">{fmtAmount(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
