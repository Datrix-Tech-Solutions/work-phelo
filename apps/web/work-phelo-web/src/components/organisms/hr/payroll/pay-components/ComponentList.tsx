'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { cn, cardClass } from '@/lib/utils';
import {
  KIND_LABELS,
  KIND_ORDER,
  ROLE_LABELS,
  isDeductedFromPay,
  roleOf,
  type PayRole,
  formatNumber,
  summarize,
  type PayComponent,
  type PayslipResult,
} from '@/lib/payroll-engine';

const ROLE_COLORS: Record<PayRole, TypeChipColor> = {
  salary_wages: 'green',
  income_tax: 'red',
  employee_social_security: 'blue',
  employer_social_security: 'purple',
  pension: 'teal',
  other_deductions: 'gray',
  tax_credit: 'amber',
};

function RoleChip({ component }: { component: PayComponent }) {
  const role = roleOf(component);
  if (role) return <TypeChip label={ROLE_LABELS[role]} color={ROLE_COLORS[role]} />;
  // A deduction that isn't taken from pay posts nothing; one that is still needs a role.
  return component.kind === 'deduction' && !isDeductedFromPay(component) ? (
    <TypeChip label="No role" color="gray" />
  ) : (
    <TypeChip label="Role needed" color="amber" />
  );
}

interface ComponentListProps {
  components: PayComponent[];
  result: PayslipResult | null;
  selectedId: string | null;
  currency: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ComponentList({
  components,
  result,
  selectedId,
  currency,
  onSelect,
  onAdd,
}: ComponentListProps) {
  return (
    <aside className={cardClass('p-3 flex flex-col gap-3')} aria-label="Pay components">
      {components.length === 0 && (
        <p className="px-1 py-6 text-center text-sm text-gray-500">
          No pay components yet. Add the first one to start building the payslip.
        </p>
      )}

      {KIND_ORDER.map((kind) => {
        const items = components.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} className="flex flex-col gap-1">
            <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-gray-500">
              {KIND_LABELS[kind]}
            </h3>
            {items.map((c) => {
              const r = result?.byId.get(c.id);
              let amount = 'Off';
              if (c.enabled && r) {
                amount = formatNumber(c.kind === 'credit' ? r.applied : r.amount - r.relief);
                if (c.kind === 'credit') amount = `−${amount}`;
              } else if (c.enabled) {
                amount = '—';
              }
              const selected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'grid grid-cols-[1fr_auto] gap-x-2 rounded-lg border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-(--module-btn-bg,var(--color-brand)) bg-[color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_10%,transparent)]'
                      : 'border-transparent hover:bg-(--surface-hover,var(--color-gray-100))',
                    !c.enabled && 'opacity-60',
                  )}
                >
                  <span className="truncate text-sm font-medium text-gray-900">{c.name}</span>
                  <span className="text-sm font-medium tabular-nums text-gray-900">{amount}</span>
                  <span className="col-span-2 truncate text-xs text-gray-500">
                    {summarize(c, currency, components)}
                  </span>
                  <span className="col-span-2 mt-1">
                    <RoleChip component={c} />
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}

      <Button variant="outline" size="sm" icon={<Plus className="mr-1 h-4 w-4" />} onClick={onAdd}>
        Add component
      </Button>
    </aside>
  );
}
