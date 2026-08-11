import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CASHBOOK_KEY } from '@/hooks/accounting/useCashAccounts';
import {
  cedantSettlementsKey,
  claimKey,
  claimsKey,
  recoveryPositionKey,
  recoveryReceiptsKey,
} from '@/hooks/reinsurance/useClaims';
import type {
  AccountingBankConfirmationWorkItem,
  SettlementMethod,
  ConfirmBankPaymentPayload,
} from '@/types/accountingIntegration';
import type {
  PlacementClaimCedantSettlement,
  PlacementClaimRecoveryReceipt,
  PlacementPayment,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const ACCOUNTING_INTEGRATION_BASE = '/operations/reinsurance/accounting-integration';
const PENDING_BANK_CONFIRMATIONS_KEY = ['accounting', 'reinsurance-bank-confirmations'] as const;

export interface ConfirmReinsurerDisbursementBankPaymentPayload extends ConfirmBankPaymentPayload {
  placementId: string;
  paymentId: string;
}

export interface ConfirmClaimRecoveryReceiptBankPaymentPayload extends ConfirmBankPaymentPayload {
  placementId: string;
  claimId: string;
  receiptId: string;
}

export interface ConfirmClaimCedantSettlementBankPaymentPayload extends ConfirmBankPaymentPayload {
  placementId: string;
  claimId: string;
  settlementId: string;
}

interface ReinsuranceConfirmationCounterparty {
  id: string;
  type: string;
  name: string;
  registrationNumber: string | null;
}

interface ReinsuranceClaimConfirmationItem {
  id: string;
  sourceModule: 'REINSURANCE';
  sourceRecordType: 'PlacementClaimRecoveryReceipt' | 'PlacementClaimCedantSettlement';
  sourceRecordId: string;
  sourceParentId: string;
  sourceReference: string;
  action: 'CONFIRM_BANK_RECEIPT' | 'CONFIRM_BANK_PAYMENT';
  transactionType?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  amount: string;
  currency: string;
  operationalDate: string;
  settlementMethod: SettlementMethod | null;
  settlementCurrency: string | null;
  agreedExchangeRate: string | null;
  counterparty: ReinsuranceConfirmationCounterparty;
  sourceDetailUrl: string | null;
  businessSnapshot?: {
    placementId?: string | null;
    placementReference?: string | null;
    policyNumber?: string | null;
    placementTitle?: string | null;
    claimId?: string | null;
    claimNumber?: string | null;
    allocationId?: string | null;
    cashCallId?: string | null;
    recoveryApprovalId?: string | null;
    payableApprovalId?: string | null;
  };
}

function sourceDescription(payment: PlacementPayment) {
  if (payment.type === 'PREMIUM_RECEIVED') {
    return 'Cedant premium receipt';
  }
  if (payment.endorsementClosing) {
    return `Endorsement closing ${payment.endorsementClosing.closingNumber}`;
  }
  if (payment.closing) {
    return `Closing ${payment.closing.closingNumber}`;
  }
  return 'Credit-note allocation';
}

function sourceDetailUrl(payment: PlacementPayment) {
  return `/operations/reinsurance/facultative/${payment.placementId}`;
}

function firstAllocation(payment: PlacementPayment) {
  return payment.allocations?.[0] ?? null;
}

function sourceNicLevy(payment: PlacementPayment) {
  const values = payment.allocations
    ?.map((allocation) => allocation.note?.nicLevyAmount)
    .filter(Boolean)
    .map(Number);
  if (!values?.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) && total !== 0 ? total : null;
}

function sourceWithholdingTaxAmount(payment: PlacementPayment) {
  const values = payment.allocations
    ?.map((allocation) => allocation.note?.withholdingTaxAmount)
    .filter(Boolean)
    .map(Number);
  if (!values?.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) && total !== 0 ? total : null;
}

export function mapReinsurancePaymentToBankConfirmationWorkItem(
  payment: PlacementPayment,
): AccountingBankConfirmationWorkItem {
  const allocation = firstAllocation(payment);
  const obligationCurrency =
    allocation?.obligationCurrency ??
    payment.closing?.currency ??
    payment.endorsementClosing?.currency ??
    payment.placement?.currency ??
    payment.currency;
  const settlementMethod = payment.settlementMethod ?? null;
  const settlementCurrency = payment.settlementCurrency ?? null;

  return {
    id: `REINSURANCE:${payment.id}`,
    sourceModule: 'REINSURANCE',
    sourceRecordId: payment.id,
    sourceParentId: payment.placementId,
    sourceReference: payment.settlementReference ?? payment.reference ?? payment.id,
    transactionType: payment.type,
    direction: payment.direction,
    counterpartyId: payment.counterpartyId,
    sourceDescription: sourceDescription(payment),
    sourceDetailUrl: sourceDetailUrl(payment),
    counterpartyName: payment.counterparty.name,
    counterpartyType: payment.counterparty.type,
    amount: payment.amount,
    currency: payment.currency,
    operationalDate: payment.paymentDate,
    operationalReference: payment.reference,
    settlementReference: payment.settlementReference,
    operationalStatus: payment.status,
    confirmationStatus: payment.status === 'RECORDED' ? 'PENDING_CONFIRMATION' : payment.status,
    availableConfirmationActions: payment.status === 'RECORDED' ? ['CONFIRM_BANK_PAYMENT'] : [],
    businessSnapshot: {
      placementReference: payment.placement?.reference ?? payment.placementId,
      endorsementReference: payment.endorsementClosing?.endorsement?.endorsementNumber ?? null,
      closingReference:
        payment.endorsementClosing?.closingNumber ?? payment.closing?.closingNumber ?? null,
      counterpartyName: payment.counterparty.name,
      reinsurerName: payment.type === 'REINSURER_DISBURSEMENT' ? payment.counterparty.name : null,
      cedantName: payment.type === 'PREMIUM_RECEIVED' ? payment.counterparty.name : null,
      operationalPaymentAmount: payment.amount,
      operationalPaymentCurrency: payment.currency,
      settlementMethod,
      settlementCurrency,
      obligationCurrency,
      cedantPremiumPaymentCurrency: null,
      cedantPaymentFxRate: allocation?.agreedExchangeRate ?? payment.agreedExchangeRate,
      nicLevyAmount: sourceNicLevy(payment),
      contractualWithholdingTaxAmount: sourceWithholdingTaxAmount(payment),
      contractualWithholdingTaxRate: allocation?.note?.withholdingTaxPercent ?? null,
      creditNoteReference: allocation?.note?.noteNumber ?? null,
      operationalPaymentDate: payment.paymentDate,
      paymentReference: payment.reference,
    },
    metadata: {
      placementId: payment.placementId,
      closingId: payment.closingId,
      endorsementClosingId: payment.endorsementClosingId,
      participantId: payment.participantId,
    },
  };
}

function mapClaimConfirmationToWorkItem(
  item: ReinsuranceClaimConfirmationItem,
): AccountingBankConfirmationWorkItem {
  const isRecoveryReceipt = item.sourceRecordType === 'PlacementClaimRecoveryReceipt';
  const settlementMethod = item.settlementMethod ?? null;
  const settlementCurrency = item.settlementCurrency ?? item.currency;

  return {
    id: item.id,
    sourceModule: item.sourceModule,
    sourceRecordType: item.sourceRecordType,
    sourceRecordId: item.sourceRecordId,
    sourceParentId: item.sourceParentId,
    sourceReference: item.sourceReference,
    transactionType:
      item.transactionType ??
      (isRecoveryReceipt ? 'CLAIM_RECOVERY_RECEIPT' : 'CLAIM_CEDANT_SETTLEMENT'),
    action: item.action,
    direction: item.direction,
    counterpartyId: item.counterparty.id,
    sourceDescription: isRecoveryReceipt
      ? `Claim recovery receipt ${item.businessSnapshot?.claimNumber ?? item.sourceReference}`
      : `Cedant claim settlement ${item.businessSnapshot?.claimNumber ?? item.sourceReference}`,
    sourceDetailUrl: item.sourceDetailUrl,
    counterpartyName: item.counterparty.name,
    counterpartyType: item.counterparty.type,
    amount: item.amount,
    currency: item.currency,
    operationalDate: item.operationalDate,
    operationalReference: item.sourceReference,
    settlementReference: item.sourceReference,
    operationalStatus: item.status,
    confirmationStatus: item.status === 'RECORDED' ? 'PENDING_CONFIRMATION' : item.status,
    availableConfirmationActions: item.status === 'RECORDED' ? [item.action] : [],
    businessSnapshot: {
      ...item.businessSnapshot,
      placementReference: item.businessSnapshot?.placementReference,
      counterpartyName: item.counterparty.name,
      reinsurerName: isRecoveryReceipt ? item.counterparty.name : null,
      cedantName: isRecoveryReceipt ? null : item.counterparty.name,
      operationalPaymentAmount: item.amount,
      operationalPaymentCurrency: item.currency,
      settlementMethod,
      settlementCurrency,
      obligationCurrency: item.currency,
      cedantPremiumPaymentCurrency: null,
      cedantPaymentFxRate: item.agreedExchangeRate,
      operationalPaymentDate: item.operationalDate,
      paymentReference: item.sourceReference,
    },
    metadata: {
      placementId: item.businessSnapshot?.placementId ?? item.sourceParentId,
      claimId: item.businessSnapshot?.claimId ?? null,
      cashCallId: item.businessSnapshot?.cashCallId ?? null,
      allocationId: item.businessSnapshot?.allocationId ?? null,
    },
  };
}

export function usePendingReinsurerDisbursementConfirmations() {
  return useQuery({
    queryKey: PENDING_BANK_CONFIRMATIONS_KEY,
    queryFn: async () => {
      const res = await api.get<{ items: PlacementPayment[] }>(
        `${BASE}/payments/pending-bank-confirmation`,
      );
      return res.data.items;
    },
  });
}

export function useReinsuranceBankConfirmationWorkItems() {
  const paymentQuery = usePendingReinsurerDisbursementConfirmations();
  const recoveryReceiptQuery = usePendingClaimRecoveryReceiptConfirmations();
  const cedantSettlementQuery = usePendingClaimCedantSettlementConfirmations();
  return {
    data: [
      ...(paymentQuery.data?.map(mapReinsurancePaymentToBankConfirmationWorkItem) ?? []),
      ...(recoveryReceiptQuery.data?.map(mapClaimConfirmationToWorkItem) ?? []),
      ...(cedantSettlementQuery.data?.map(mapClaimConfirmationToWorkItem) ?? []),
    ],
    isLoading:
      paymentQuery.isLoading || recoveryReceiptQuery.isLoading || cedantSettlementQuery.isLoading,
    isError: paymentQuery.isError || recoveryReceiptQuery.isError || cedantSettlementQuery.isError,
    refetch: async () => {
      await Promise.all([
        paymentQuery.refetch(),
        recoveryReceiptQuery.refetch(),
        cedantSettlementQuery.refetch(),
      ]);
    },
  };
}

export function usePendingClaimRecoveryReceiptConfirmations() {
  return useQuery({
    queryKey: [...PENDING_BANK_CONFIRMATIONS_KEY, 'claim-recovery-receipts'],
    queryFn: async () => {
      const res = await api.get<{ items: ReinsuranceClaimConfirmationItem[] }>(
        `${ACCOUNTING_INTEGRATION_BASE}/financial-confirmations/claim-recovery-receipts`,
      );
      return res.data.items;
    },
  });
}

export function usePendingClaimCedantSettlementConfirmations() {
  return useQuery({
    queryKey: [...PENDING_BANK_CONFIRMATIONS_KEY, 'claim-cedant-settlements'],
    queryFn: async () => {
      const res = await api.get<{ items: ReinsuranceClaimConfirmationItem[] }>(
        `${ACCOUNTING_INTEGRATION_BASE}/financial-confirmations/claim-cedant-settlements`,
      );
      return res.data.items;
    },
  });
}

function invalidateConfirmationAndCashbook(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: PENDING_BANK_CONFIRMATIONS_KEY });
  queryClient.invalidateQueries({ queryKey: CASHBOOK_KEY });
  queryClient.invalidateQueries({ queryKey: ['accounting', 'cash-accounts'] });
}

export function useConfirmReinsurerDisbursementBankPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      ...payload
    }: ConfirmReinsurerDisbursementBankPaymentPayload) => {
      const res = await api.post<PlacementPayment>(
        `${BASE}/${placementId}/payments/${paymentId}/bank-confirmation`,
        payload,
      );
      return res.data;
    },
    onSuccess: (payment) => {
      invalidateConfirmationAndCashbook(queryClient);
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'payments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'financial-position'],
      });
    },
  });
}

export function useConfirmClaimRecoveryReceiptBankPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      receiptId,
      ...payload
    }: ConfirmClaimRecoveryReceiptBankPaymentPayload) => {
      const res = await api.post<PlacementClaimRecoveryReceipt>(
        `${BASE}/${placementId}/claims/${claimId}/recovery-receipts/${receiptId}/bank-confirm`,
        payload,
      );
      return res.data;
    },
    onSuccess: (receipt) => {
      invalidateConfirmationAndCashbook(queryClient);
      queryClient.invalidateQueries({ queryKey: claimsKey(receipt.placementId) });
      queryClient.invalidateQueries({ queryKey: claimKey(receipt.placementId, receipt.claimId) });
      queryClient.invalidateQueries({
        queryKey: recoveryPositionKey(receipt.placementId, receipt.claimId),
      });
      queryClient.invalidateQueries({
        queryKey: recoveryReceiptsKey(receipt.placementId, receipt.claimId, receipt.cashCallId),
      });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
    },
  });
}

export function useConfirmClaimCedantSettlementBankPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      settlementId,
      ...payload
    }: ConfirmClaimCedantSettlementBankPaymentPayload) => {
      const res = await api.post<PlacementClaimCedantSettlement>(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements/${settlementId}/bank-confirm`,
        payload,
      );
      return res.data;
    },
    onSuccess: (settlement) => {
      invalidateConfirmationAndCashbook(queryClient);
      queryClient.invalidateQueries({ queryKey: claimsKey(settlement.placementId) });
      queryClient.invalidateQueries({
        queryKey: claimKey(settlement.placementId, settlement.claimId),
      });
      queryClient.invalidateQueries({
        queryKey: recoveryPositionKey(settlement.placementId, settlement.claimId),
      });
      queryClient.invalidateQueries({
        queryKey: cedantSettlementsKey(settlement.placementId, settlement.claimId),
      });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
    },
  });
}
