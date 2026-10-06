'use client';

import { cn, cardClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import {
  BASE_LABELS,
  INPUT_LABELS,
  PAYSLIP_TYPES,
  PAYSLIP_TYPE_ORDER,
  formatAmount,
  formatNumber,
  isDeductedFromPay,
  type ComponentResult,
  type PayComponent,
  type PayInput,
  type PayInputs,
  type PayslipResult,
  type PayslipTypeKey,
  type VariableAmounts,
} from '@/lib/payroll-engine';

interface SamplePayslipProps {
  components: PayComponent[];
  result: PayslipResult | null;
  error: string | null;
  payslipType: PayslipTypeKey;
  onTypeChange: (type: PayslipTypeKey) => void;
  inputs: PayInputs;
  onInputChange: (input: PayInput, value: number) => void;
  /** Amounts typed in for the variable components, by component id. */
  variables: VariableAmounts;
  onVariableChange: (id: string, value: number) => void;
  /** Problems with this configuration for the previewed payslip type. */
  errors: string[];
  warnings: string[];
  currency: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function variableSourceText(c: PayComponent): string {
  if (c.params.source === 'allowance') return 'from employee allowances';
  if (c.params.source === 'loans') return 'from employee loans';
  return 'entered each run';
}

function Row({
  label,
  amount,
  selected,
  sub,
  total,
  onClick,
}: {
  label: string;
  amount: string;
  selected?: boolean;
  sub?: boolean;
  total?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    'flex w-full justify-between gap-3 rounded-md px-2 py-1 text-left text-sm',
    sub && 'pl-5 text-xs text-gray-500',
    total && 'mt-1 rounded-none border-t border-gray-200 pt-2 font-semibold',
    selected && 'bg-[color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_12%,transparent)]',
    onClick && 'hover:bg-(--surface-hover,var(--color-gray-100))',
  );
  const content = (
    <>
      <span>{label}</span>
      <span className="tabular-nums">{amount}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 px-2 text-xs font-medium text-gray-500">{children}</div>;
}

function Working({ result, currency }: { result: ComponentResult; currency: string }) {
  const t = result.trace;
  const f = (n: number) => formatAmount(n, currency);
  const line = (label: string, value: string) => (
    <div className="flex justify-between py-0.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );

  let body: React.ReactNode = null;
  if (t.type === 'fixed') {
    body = (
      <p className="text-sm text-gray-600">
        A fixed amount of <b>{f(t.amount)}</b> each period.
      </p>
    );
  } else if (t.type === 'variable') {
    body = (
      <p className="text-sm text-gray-600">
        An amount of <b>{f(t.amount)}</b> entered for this payroll run.
      </p>
    );
  } else if (t.type === 'percent') {
    const base = t.baseName ?? BASE_LABELS[t.base];
    body = (
      <dl>
        {line(base[0].toUpperCase() + base.slice(1), f(t.full))}
        {t.cap !== null && line('Limited to', f(t.cap))}
        {line('Rate', `${t.rate}%`)}
        {t.floor !== null && line('Raised to the minimum', f(t.floor))}
        {t.ceil !== null && line('Held at the maximum', f(t.ceil))}
        {line('Amount', f(result.amount))}
      </dl>
    );
  } else if (t.type === 'bands') {
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-600">
          Taxed on <b>{f(t.income)}</b>{' '}
          {t.factor === 12
            ? `a year (monthly ${t.baseName ?? BASE_LABELS[t.base]} × 12)`
            : 'this period'}
          .
        </p>
        {t.slices.map((s, i) => {
          const width =
            s.to === Infinity
              ? s.amount > 0
                ? 100
                : 0
              : s.to - s.from > 0
                ? Math.min(100, (s.amount / (s.to - s.from)) * 100)
                : 0;
          return (
            <div key={i} className={cn(s.amount > 0 ? '' : 'opacity-45')}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="tabular-nums">
                  {formatNumber(s.from)} to {s.to === Infinity ? 'and above' : formatNumber(s.to)}
                </span>
                <span className="text-gray-500 tabular-nums">{s.rate}%</span>
                <span className="tabular-nums">{f(s.tax)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full rounded bg-(--module-btn-bg,var(--color-brand))"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
        {t.factor === 12 && (
          <p className="text-sm text-gray-600">
            Tax for the year {f(t.tax)} ÷ 12 = <b>{f(t.tax / 12)}</b> a month.
          </p>
        )}
      </div>
    );
  } else if (t.type === 'formula') {
    body = (
      <>
        <p className="text-sm font-semibold">{t.expr}</p>
        <dl>{line('Result', f(t.value))}</dl>
      </>
    );
  }

  const roundingNote = {
    whole: 'to the nearest whole number',
    down: 'down to 2 decimal places',
    none: 'none',
    cent: '',
  }[result.component.rounding];

  const credit =
    result.component.kind === 'credit' ? (
      <p className="mt-2 text-sm text-gray-600">
        Takes <b>{f(result.applied)}</b> off {result.targetName ?? 'the deduction'}
        {result.applied < result.amount ? ', all it has left to reduce' : ''}.
      </p>
    ) : null;

  return (
    <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
      <h4 className="mb-2 text-sm font-semibold">How {result.component.name} was worked out</h4>
      {body}
      {credit}
      {roundingNote && <p className="mt-1 text-xs text-gray-500">Rounding: {roundingNote}.</p>}
    </div>
  );
}

export function SamplePayslip({
  components,
  result,
  error,
  payslipType,
  onTypeChange,
  inputs,
  onInputChange,
  variables,
  onVariableChange,
  errors,
  warnings,
  currency,
  selectedId,
  onSelect,
}: SamplePayslipProps) {
  const f = (n: number) => formatAmount(n, currency);
  const enabled = components.filter((c) => c.enabled);
  const selected = components.find((c) => c.id === selectedId);
  const type = PAYSLIP_TYPES[payslipType];

  return (
    <aside className={cardClass('p-4 lg:sticky lg:top-3')} aria-label="Sample payslip">
      <h2 className="text-base font-bold text-gray-900">Sample payslip</h2>
      <div className="mt-2">
        <SearchSelect
          label="Payslip type"
          clearable={false}
          options={PAYSLIP_TYPE_ORDER.map((key) => ({
            value: key,
            label: PAYSLIP_TYPES[key].label,
          }))}
          value={payslipType}
          onChange={(v) => v && onTypeChange(v as PayslipTypeKey)}
        />
      </div>
      {type.inputs.map((input) => (
        <div key={input} className="mt-3">
          <NumberField
            label={`${INPUT_LABELS[input]} (${currency})`}
            value={inputs[input]}
            onChange={(value) => onInputChange(input, value)}
          />
        </div>
      ))}

      {enabled
        .filter((c) => c.method === 'variable')
        .map((c) => (
          <div key={c.id} className="mt-3">
            <NumberField
              label={`${c.name} - ${variableSourceText(c)} (${currency})`}
              value={variables[c.id] ?? 0}
              onChange={(value) => onVariableChange(c.id, value)}
            />
          </div>
        ))}

      {[
        ...errors.map((m) => ['err', m] as const),
        ...warnings.map((m) => ['warn', m] as const),
      ].map(([tone, message]) => (
        <p
          key={message}
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-xs',
            tone === 'err' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
          )}
        >
          {message}
        </p>
      ))}

      {!result ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>This payslip can&apos;t be calculated.</strong>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <>
          <Heading>Earnings</Heading>
          {type.inputs.includes('basic') && <Row label="Basic salary" amount={f(inputs.basic)} />}
          {enabled
            .filter((c) => c.kind === 'earning')
            .map((c) => (
              <Row
                key={c.id}
                label={c.name}
                amount={f(result.byId.get(c.id)?.amount ?? 0)}
                selected={c.id === selectedId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          <Row label="Gross pay" amount={f(result.gross)} total />

          {enabled.some((c) => c.kind === 'deduction' && isDeductedFromPay(c)) && (
            <>
              <Heading>Deductions</Heading>
              {enabled
                .filter((c) => c.kind === 'deduction' && isDeductedFromPay(c))
                .map((c) => {
                  const r = result.byId.get(c.id);
                  if (!r) return null;
                  return (
                    <div key={c.id}>
                      <Row
                        label={c.name}
                        amount={f(r.amount - r.relief)}
                        selected={c.id === selectedId}
                        onClick={() => onSelect(c.id)}
                      />
                      {enabled
                        .filter((x) => x.kind === 'credit' && x.reduces === c.id)
                        .map((x) => {
                          const rr = result.byId.get(x.id);
                          if (!rr || rr.applied <= 0) return null;
                          return (
                            <Row
                              key={x.id}
                              sub
                              label={`Includes ${x.name.toLowerCase()}`}
                              amount={`−${formatNumber(rr.applied)}`}
                              selected={x.id === selectedId}
                              onClick={() => onSelect(x.id)}
                            />
                          );
                        })}
                    </div>
                  );
                })}
              <Row label="Total deductions" amount={f(result.totalDeductions)} total />
            </>
          )}

          {enabled.some((c) => c.kind === 'deduction' && !isDeductedFromPay(c)) && (
            <>
              <Heading>Lowers taxable income only</Heading>
              {enabled
                .filter((c) => c.kind === 'deduction' && !isDeductedFromPay(c))
                .map((c) => (
                  <Row
                    key={c.id}
                    label={c.name}
                    amount={f(result.byId.get(c.id)?.amount ?? 0)}
                    selected={c.id === selectedId}
                    onClick={() => onSelect(c.id)}
                  />
                ))}
            </>
          )}

          <div className="mx-2 mt-4 border-y border-gray-200 py-3">
            <span className="block text-xs text-gray-500">Net pay</span>
            <div className="text-3xl font-bold tabular-nums text-(--module-btn-bg,var(--color-brand))">
              {f(result.net)}
            </div>
          </div>

          {result.shortfall > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Deductions are {f(result.shortfall)} more than pay, so net pay is held at zero.
            </p>
          )}

          {enabled.some((c) => c.kind === 'employer') && (
            <>
              <Heading>Paid by the employer</Heading>
              {enabled
                .filter((c) => c.kind === 'employer')
                .map((c) => (
                  <Row
                    key={c.id}
                    label={c.name}
                    amount={f(result.byId.get(c.id)?.amount ?? 0)}
                    selected={c.id === selectedId}
                    onClick={() => onSelect(c.id)}
                  />
                ))}
              <Row label="Total employer cost" amount={f(result.employerCost)} total />
            </>
          )}

          {selected &&
            (result.byId.get(selected.id) ? (
              <Working result={result.byId.get(selected.id)!} currency={currency} />
            ) : (
              <p className="mt-4 border-t border-dashed border-gray-300 pt-3 text-sm text-gray-500">
                {selected.name} is switched off, so it isn&apos;t part of this payslip.
              </p>
            ))}
        </>
      )}
    </aside>
  );
}
