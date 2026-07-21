'use client';

import { useEffect, useMemo, useState } from 'react';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Icons } from '@/components/atoms/icons';
import { PremiumCreditNoteModal } from '@/components/organisms/reinsurance/documents/PremiumCreditNoteModal';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { useReinsurers } from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';

interface ReinsurersPaymentTableProps {
  placement: Facultative;
  participants: PlacementParticipant[];
  grossPremium: number;
  commission: number;
  currency: string | null;
  cedantId: string;
  paidAmount?: number;
  onTotalChange?: (total: number) => void;
}

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function participantNetPremium(
  p: PlacementParticipant,
  grossPremium: number,
  commission: number,
  nicLevyPct: number,
  withholdingTaxPct: number,
) {
  const share = parseFloat(p.sharePercent ?? '0') / 100;
  const brokerage = parseFloat(p.brokerageFee ?? '0');
  const yourPremium = share * grossPremium;
  const commissionAmt = yourPremium * ((commission + brokerage) / 100);
  const nicLevyAmt = yourPremium * (nicLevyPct / 100);
  const withholdingTaxAmt = yourPremium * (withholdingTaxPct / 100);
  return yourPremium - commissionAmt - nicLevyAmt - withholdingTaxAmt;
}

export function ReinsurersPaymentTable({
  placement,
  participants,
  grossPremium,
  commission,
  currency,
  // paidAmount = 0,

  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const [creditNoteTarget, setCreditNoteTarget] = useState<PlacementParticipant | null>(null);
  const [mailTarget, setMailTarget] = useState<PlacementParticipant | null>(null);

  const { data: reinsurers = [] } = useReinsurers();
  const { data: charges } = useReinsuranceCharges();

  const reinsurerById = useMemo(() => new Map(reinsurers.map((r) => [r.id, r])), [reinsurers]);

  const ratesFor = useMemo(
    () => (counterpartyId: string) => {
      const foreign = isForeignCedant(reinsurerById.get(counterpartyId));
      return {
        nicLevyPct: foreign ? selectChargeRate(charges, 'NIC_LEVY', currency) : 0,
        withholdingTaxPct: foreign ? selectChargeRate(charges, 'WITHHOLDING_TAX', currency) : 0,
      };
    },
    [reinsurerById, charges, currency],
  );

  const reinsurerEmails = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        reinsurers.map((r) => {
          const emails: string[] = [];
          if (r.email) emails.push(r.email);
          r.contacts.forEach((c) => {
            if (c.email) emails.push(c.email);
          });
          return [r.id, emails];
        }),
      ),
    [reinsurers],
  );

  const participants_ = useMemo(
    () =>
      participants.filter(
        (p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'),
      ),
    [participants],
  );

  const total = useMemo(
    () =>
      participants_.reduce((sum, p) => {
        const { nicLevyPct, withholdingTaxPct } = ratesFor(p.counterpartyId);
        return (
          sum + participantNetPremium(p, grossPremium, commission, nicLevyPct, withholdingTaxPct)
        );
      }, 0),
    [participants_, grossPremium, commission, ratesFor],
  );

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  // const proRataFactor = total > 0 ? Math.min(paidAmount / total, 1) : 0;

  const columns: Column<PlacementParticipant>[] = useMemo(
    () => [
      {
        key: 'counterparty',
        label: 'Reinsurer',
        render: (row) => <span className="font-medium text-gray-900">{row.counterparty.name}</span>,
      },
      {
        key: 'sharePercent',
        label: 'Share %',
        width: '80px',
        className: 'text-center',
        render: (row) => (
          <span className="text-gray-600 block text-center">{row.sharePercent ?? '—'}</span>
        ),
      },
      {
        key: 'premiumShare',
        label: 'Premium Share',
        width: '160px',
        className: 'text-right',
        render: (row) => {
          const { nicLevyPct, withholdingTaxPct } = ratesFor(row.counterpartyId);
          return (
            <span className="text-gray-900 block text-right">
              {fmt(
                participantNetPremium(row, grossPremium, commission, nicLevyPct, withholdingTaxPct),
                currency,
              )}
            </span>
          );
        },
      },
      // {
      //   key: 'allocated',
      //   label: 'Allocated',
      //   width: '160px',
      //   className: 'text-right',
      //   render: (row) => {
      //     const allocated = participantNetPremium(row, grossPremium, commission) * proRataFactor;
      //     return (
      //       <span className="text-orange-600 font-medium block text-right">
      //         {fmt(allocated, currency)}
      //       </span>
      //     );
      //   },
      // },
      {
        key: 'status',
        label: 'Actions',
        width: '100px',
        className: 'pr-6',
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="View Credit Note"
              className="text-blue-500 hover:text-blue-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setCreditNoteTarget(row);
              }}
            >
              <Icons.Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Send Mail"
              className="text-green-500 hover:text-green-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMailTarget(row);
              }}
            >
              <Icons.Mail className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [grossPremium, commission, currency, ratesFor], //proRataFactor],
  );

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 pt-4 pb-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <span className="text-sm font-bold text-gray-900">Participants</span>
      </div>

      <DataTable
        columns={columns}
        data={participants_}
        emptyMessage="No participants"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      {creditNoteTarget && (
        <PremiumCreditNoteModal
          isOpen
          placement={placement}
          sharePercent={parseFloat(creditNoteTarget.sharePercent ?? '0')}
          brokerageFee={parseFloat(creditNoteTarget.brokerageFee ?? '0')}
          counterpartyId={creditNoteTarget.counterpartyId}
          reinsurerCompany={creditNoteTarget.counterparty.name}
          {...ratesFor(creditNoteTarget.counterpartyId)}
          onPrint={() => setCreditNoteTarget(null)}
          onClose={() => setCreditNoteTarget(null)}
        />
      )}

      {mailTarget && (
        <MailPreviewModal
          isOpen
          placement={placement}
          brokerageFee={parseFloat(mailTarget.brokerageFee ?? '0')}
          recipients={reinsurerEmails[mailTarget.counterpartyId] ?? []}
          onSend={() => setMailTarget(null)}
          onClose={() => setMailTarget(null)}
        />
      )}
    </div>
  );
}
