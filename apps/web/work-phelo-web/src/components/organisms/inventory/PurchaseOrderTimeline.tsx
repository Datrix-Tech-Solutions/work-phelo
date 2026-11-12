'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import { formatDate, formatTime } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { useUserNames } from '@/hooks/inventory/useUserNames';
import {
  PAYMENT_METHOD_LABEL,
  termsPayOnReceipt,
  type PurchaseOrder,
} from '@/hooks/inventory/usePurchaseOrders';
import { getMovementQuantity, type StockMovement } from '@/hooks/inventory/useStockMovements';

interface TimelineEvent {
  /** ISO date-time; null when it wasn't recorded. */
  at: string | null;
  /** User id of who handled the step. */
  by: string | null;
  detail: string;
}

interface Stage {
  key: string;
  title: string;
  /** Shown while the step has not happened yet. */
  waiting: string;
  events: TimelineEvent[];
}

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const byTime = (a: TimelineEvent, b: TimelineEvent) => (a.at ?? '').localeCompare(b.at ?? '');

interface PurchaseOrderTimelineProps {
  order: PurchaseOrder;
  /** The stock ins posted against the order's lines. */
  receipts: StockMovement[];
}

/**
 * The steps an order goes through, with when each happened and who handled it: placed, approved,
 * invoiced, then receiving and paying in the order its payment terms give (paid once the goods
 * arrive, or against the invoice before them).
 */
export function PurchaseOrderTimeline({ order, receipts }: PurchaseOrderTimelineProps) {
  const userName = useUserNames();

  const stages = useMemo<Stage[]>(() => {
    const placed: Stage = {
      key: 'placed',
      title: 'Order sent',
      waiting: '',
      events: [
        {
          at: order.createdAt,
          by: order.createdBy,
          detail: `${order.lines.length} ${order.lines.length === 1 ? 'item' : 'items'}`,
        },
      ],
    };

    const decided = order.status !== 'PENDING_APPROVAL';
    const approval: Stage =
      order.status === 'REJECTED'
        ? {
            key: 'approval',
            title: 'Order rejected',
            waiting: '',
            events: [
              {
                at: order.rejectedAt,
                by: order.rejectedBy,
                detail: order.rejectionReason ?? '',
              },
            ],
          }
        : {
            key: 'approval',
            title: 'Order approved',
            waiting: 'Waiting for approval',
            events: decided
              ? [
                  {
                    at: order.approvedAt,
                    by: order.approvedBy,
                    // Orders from before approvals were recorded have no approver.
                    detail: order.approvedBy ? '' : 'Approved before approvals were recorded',
                  },
                ]
              : [],
          };

    const invoices: Stage = {
      key: 'invoices',
      title: 'Invoice received',
      waiting: 'Waiting for the supplier’s invoice',
      events: order.invoices
        .map((i) => ({
          at: i.recordedAt,
          by: i.recordedBy,
          detail: `${i.number} · ${formatInventoryValue(i.total)}${i.void ? ' · Void' : ''}`,
        }))
        .sort(byTime),
    };

    const received: Stage = {
      key: 'received',
      title: 'Items received',
      waiting: 'Waiting for the goods',
      events: receipts
        .map((m) => ({
          at: m.createdAt ?? null,
          by: m.createdBy ?? null,
          detail: `${formatNumber(getMovementQuantity(m))} units · ${m.reference}`,
        }))
        .sort(byTime),
    };

    const paid: Stage = {
      key: 'paid',
      title: 'Payment made',
      waiting: 'Waiting for payment',
      events: order.payments
        .map((p) => ({
          at: p.recordedAt,
          by: p.recordedBy,
          detail: `${formatInventoryValue(p.amount)} · ${PAYMENT_METHOD_LABEL[p.method]}`,
        }))
        .sort(byTime),
    };

    // Paid when the goods arrive: receiving comes first. Otherwise the invoice is paid up front.
    return [
      placed,
      approval,
      invoices,
      ...(termsPayOnReceipt(order.paymentTerms) ? [received, paid] : [paid, received]),
    ];
  }, [order, receipts]);

  // A cancelled, rejected or closed order has finished: only the steps that happened are shown.
  const finished =
    order.status === 'CANCELLED' || order.status === 'REJECTED' || order.status === 'CLOSED';
  const shown = finished ? stages.filter((s) => s.events.length > 0) : stages;
  const currentKey = finished ? null : shown.find((s) => s.events.length === 0)?.key;

  return (
    <div className={cardClass('flex flex-col gap-2 px-3 py-2.5')}>
      <h2 className="text-sm font-semibold text-gray-900">Timeline</h2>
      <ol className="flex overflow-x-auto">
        {shown.map((stage, index) => {
          const done = stage.events.length > 0;
          const current = stage.key === currentKey;
          const first = index === 0;
          const last = index === shown.length - 1;
          const line = (hidden: boolean) =>
            cn('h-0.5 flex-1', hidden ? 'bg-transparent' : done ? 'bg-green-600' : 'bg-gray-200');
          return (
            <li key={stage.key} className="flex min-w-44 flex-1 flex-col gap-1.5">
              <div className="flex items-center">
                <span className={line(first)} />
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                    done
                      ? 'border-green-600 bg-green-600 text-white'
                      : current
                        ? 'border-brand bg-white'
                        : 'border-gray-300 bg-white',
                  )}
                >
                  {done && <Check size={10} strokeWidth={3.5} />}
                </span>
                <span className={line(last)} />
              </div>
              <div className="flex min-w-0 flex-col items-center px-2 text-center leading-snug">
                <span
                  className={cn(
                    'text-xs font-bold',
                    done || current ? 'text-gray-900' : 'text-gray-400',
                  )}
                >
                  {stage.title}
                </span>
                {done ? (
                  stage.events.map((e, i) => (
                    <div key={i} className="flex flex-col text-[11px] font-medium text-gray-500">
                      <span>
                        {e.at ? `${formatDate(e.at)}, ${formatTime(e.at)}` : 'Date not recorded'}
                        {` · ${userName(e.by)}`}
                      </span>
                      {e.detail && <span className="text-gray-700">{e.detail}</span>}
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] font-medium text-gray-400">{stage.waiting}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
