'use client';

import { useMemo, useState } from 'react';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { Button } from '@/components/atoms/Button';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { UpdatePriceModal } from '@/components/organisms/hr/projects/UpdatePriceModal';
import { ProjectInvoiceModal } from '@/components/organisms/hr/projects/ProjectInvoiceModal';
import { useProject, useProjectTasks } from '@/hooks';
import { billingLines } from '@/lib/projectBilling';
import { formatMoney, pricingExpectedValue } from '@/lib/projectPricing';
import { formatHoursMinutes, timerElapsedMs, useNow } from '@/lib/taskTime';
import { cardClass, cn } from '@/lib/utils';
import { useProjectInvoices } from '@/hooks/hr/useProjectInvoices';
import { useProjectLocalStore } from '@/store/projectLocal.store';
import { useTaskTimeStore } from '@/store/taskTime.store';

type BillingTab = 'bill' | 'history';

const STATE_COLORS: Record<string, TypeChipColor> = {
  POSTED: 'green',
  REJECTED: 'red',
  REVERSED: 'gray',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

/** Make billing for a billable client project and look back over what has been billed. */
export function ProjectBilling({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: tasks = [] } = useProjectTasks(projectId);
  const details = useProjectLocalStore((s) => s.byProjectId[projectId]);
  const timersByTaskId = useTaskTimeStore((s) => s.timersByTaskId);
  const timedByTaskId = useTaskTimeStore((s) => s.timedByTaskId);

  const [tab, setTab] = useState<BillingTab>('bill');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const setPricing = useProjectLocalStore((s) => s.setPricing);

  const client = details?.client;
  const pricing = details?.pricing;
  const { invoices, active, transactions } = useProjectInvoices(projectId);

  const anyRunning = useMemo(
    () =>
      Object.values(timersByTaskId).some((byPerson) =>
        Object.values(byPerson).some((t) => t.runningSince),
      ),
    [timersByTaskId],
  );
  const now = useNow(anyRunning);

  const lines = useMemo(() => {
    if (!pricing) return [];
    return billingLines({
      pricing,
      startDate: details?.summary?.startDate,
      endDate: details?.summary?.endDate,
      tasks: tasks
        .filter((t) => timedByTaskId[t.id])
        .map((t) => ({
          id: t.id,
          name: t.name,
          ms: Object.values(timersByTaskId[t.id] ?? {}).reduce(
            (sum, timer) => sum + timerElapsedMs(timer, now),
            0,
          ),
        })),
      invoices: active,
    });
  }, [pricing, details?.summary, tasks, timedByTaskId, timersByTaskId, now, active]);

  const stateOf = (transactionId: string) =>
    transactions?.items.find((t) => t.id === transactionId);

  if (!pricing || !project) return null;

  if (!client) {
    return (
      <div className={cardClass('p-6 text-sm text-gray-500')}>
        This project isn&apos;t linked to a client, so there is nobody to bill. Billing needs a
        client chosen when the project is created.
      </div>
    );
  }

  const invoiced = active.reduce((sum, i) => sum + i.amount, 0);
  const left = lines.filter((l) => !l.billed).reduce((sum, l) => sum + l.amount, 0);
  const full =
    pricing.type === 'TIMED'
      ? invoiced + left
      : (pricingExpectedValue(pricing, details?.summary?.startDate, details?.summary?.endDate) ??
        0);

  // Once the price is on an invoice, changing it would no longer match what the client was billed.
  const priceInvoiced = active.some((i) => i.lines.some((l) => l.key === 'price'));

  const chosen = lines.filter((l) => selected.has(l.key) && !l.billed && l.amount > 0);
  const chosenTotal = chosen.reduce((sum, l) => sum + l.amount, 0);
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass('px-5 py-4 flex flex-wrap items-center gap-x-12 gap-y-3')}>
        <Stat
          label={pricing.type === 'TIMED' ? 'Full price so far' : 'Full price'}
          value={formatMoney(full)}
        />
        <Stat label="Invoiced" value={formatMoney(invoiced)} />
        <Stat label="Left to bill" value={formatMoney(left)} />
        <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
          <span>
            Billing <span className="font-semibold text-gray-900">{client.name}</span>
          </span>
          {pricing.type === 'FLAT_RATE' && (
            <Button
              variant="outline"
              disabled={priceInvoiced}
              title={
                priceInvoiced
                  ? 'The price has been invoiced, so it can no longer change'
                  : undefined
              }
              onClick={() => setPriceOpen(true)}
            >
              Update Price
            </Button>
          )}
        </div>
      </div>

      <TabBar
        tabs={[
          { key: 'bill', label: 'Make Billing' },
          { key: 'history', label: 'Billing History', count: invoices.length },
        ]}
        activeTab={tab}
        onTabChange={(t) => setTab(t as BillingTab)}
      />

      {tab === 'bill' && (
        <div className={cardClass('flex flex-col')}>
          {lines.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">
              {pricing.type === 'TIMED'
                ? 'No time logged on timed tasks yet.'
                : 'Nothing to bill yet.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {lines.map((line) => {
                const disabled = line.billed || line.amount <= 0;
                return (
                  <li key={line.key}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 border-b border-gray-100 last:border-b-0',
                        disabled ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={selected.has(line.key) && !disabled}
                        onChange={() => toggle(line.key)}
                        className="h-4 w-4 accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            line.billed ? 'text-gray-400' : 'text-gray-900',
                          )}
                        >
                          {line.label}
                        </p>
                        <p className="text-xs text-gray-400">{line.detail}</p>
                      </div>
                      {line.billed ? (
                        <TypeChip label="Billed" color="green" />
                      ) : (
                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                          {formatMoney(line.amount)}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {chosen.length === 0
                ? 'Select what to invoice'
                : `${chosen.length} selected · ${formatMoney(chosenTotal)}`}
            </p>
            <Button disabled={chosen.length === 0} onClick={() => setInvoiceOpen(true)}>
              Raise Invoice
            </Button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className={cardClass('overflow-x-auto')}>
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">Nothing has been billed yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Billed for</th>
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const tx = stateOf(inv.transactionId);
                  return (
                    <tr key={inv.id} className="border-t border-gray-100 align-top">
                      <td className="px-5 py-3 whitespace-nowrap text-gray-700">
                        {new Date(inv.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        <ul className="flex flex-col gap-0.5">
                          {inv.lines.map((l) => (
                            <li key={l.key}>
                              {l.label}
                              {l.minutes ? (
                                <span className="text-xs text-gray-400">
                                  {' '}
                                  · {formatHoursMinutes(l.minutes * 60000)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{tx?.documentNumber ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                        {formatMoney(inv.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <TypeChip
                          label={tx?.stateLabel ?? 'Sent'}
                          color={(tx && STATE_COLORS[tx.state.toUpperCase()]) || 'amber'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {priceOpen && pricing.type === 'FLAT_RATE' && (
        <UpdatePriceModal
          currentPrice={pricing.price}
          isOpen
          onClose={() => setPriceOpen(false)}
          onSave={(price) => {
            setPricing(projectId, { type: 'FLAT_RATE', price });
            setPriceOpen(false);
          }}
        />
      )}

      {invoiceOpen && (
        <ProjectInvoiceModal
          // A new form (and submission id) each time it opens.
          key={chosen.map((l) => l.key).join(',')}
          projectId={projectId}
          projectName={project.name}
          clientId={client.id}
          clientName={client.name}
          lines={chosen}
          isOpen
          onClose={() => setInvoiceOpen(false)}
          onSent={() => {
            setInvoiceOpen(false);
            setSelected(new Set());
            setTab('history');
          }}
        />
      )}
    </div>
  );
}
