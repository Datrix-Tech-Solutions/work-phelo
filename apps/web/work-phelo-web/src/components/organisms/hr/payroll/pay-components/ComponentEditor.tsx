'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { FormSection } from '@/components/atoms/FormSection';
import { ConfirmModal } from './ConfirmModal';
import { cn } from '@/lib/utils';
import {
  BASE_LABELS,
  KIND_LABELS,
  DEFAULT_PARAMS,
  METHODS,
  ROUNDING_OPTIONS,
  dependenciesOf,
  isDeductedFromPay,
  ALLOWANCE_TYPES,
  ROLES_BY_KIND,
  VARIABLE_SOURCES_BY_KIND,
  VARIABLE_SOURCE_LABELS,
  type VariableSource,
  ROLE_LABELS,
  roleOf,
  roundAmount,
  PayrollEngineError,
  type CalcMethod,
  type ComponentParams,
  type PayBase,
  type PayInput,
  type PayRole,
  type PayComponent,
  type RoundingMode,
  type SavedPayComponent,
} from '@/lib/payroll-engine';

interface ComponentEditorProps {
  component: PayComponent;
  all: PayComponent[];
  currency: string;
  onChange: (next: PayComponent) => void;
  onDelete: () => void;
  /** The figures the previewed payslip type has; "Calculated on" offers these. */
  inputs: PayInput[];
  saved: SavedPayComponent[];
  onSaveAsNew: () => void;
  onReplaceSaved: () => void;
}

const EXAMPLE_AMOUNT = 1234.567;
const exampleFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/** A worked example of a rounding setting, shown under the dropdown. */
function roundingExample(mode: RoundingMode): string {
  const from = exampleFormat.format(EXAMPLE_AMOUNT);
  const to = exampleFormat.format(roundAmount(EXAMPLE_AMOUNT, mode));
  return mode === 'none'
    ? `Example: ${from} is kept as it is, with every decimal.`
    : `Example: ${from} becomes ${to}.`;
}

const parseNumber = (v: string): number | null => (v === '' ? null : parseFloat(v));
const show = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

function Note({ tone, children }: { tone: 'warn' | 'err' | 'info'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-lg px-3 py-2 text-xs',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'err' && 'bg-red-50 text-red-700',
        tone === 'info' && 'bg-gray-100 text-gray-600',
      )}
    >
      {children}
    </p>
  );
}

function Notes({ component: c, all }: { component: PayComponent; all: PayComponent[] }) {
  const notes: React.ReactNode[] = [];
  const duplicate = all.filter((x) => x.code === c.code).length > 1;
  if (duplicate) {
    notes.push(
      <Note key="dup" tone="warn">
        Another component already uses the code {c.code}. Codes must be unique so formulas point at
        the right component.
      </Note>,
    );
  }
  if (c.kind === 'credit') {
    const deductionExists = (id: string | undefined) =>
      all.some((x) => x.id === id && x.kind === 'deduction');
    if (!deductionExists(c.reduces)) {
      notes.push(
        <Note key="target" tone="warn">
          Choose which deduction this tax credit reduces.
        </Note>,
      );
    }
    if ((c.method === 'percent' || c.method === 'bands') && !deductionExists(c.baseComponentId)) {
      notes.push(
        <Note key="base" tone="warn">
          Choose which deduction this tax credit is calculated on.
        </Note>,
      );
    }
  }
  if (c.method === 'bands') {
    const b = c.params.bands ?? [];
    const outOfOrder = b.some(
      (band, i) =>
        i > 0 && band.upTo !== null && b[i - 1].upTo !== null && band.upTo <= (b[i - 1].upTo ?? 0),
    );
    if (outOfOrder) {
      notes.push(
        <Note key="order" tone="warn">
          Band limits should go up from top to bottom. A band with a lower limit than the one above
          it is ignored.
        </Note>,
      );
    }
  }
  let deps: PayComponent[] | null = null;
  let depsError: string | null = null;
  try {
    deps = dependenciesOf(
      c,
      all.filter((x) => x.enabled),
    );
  } catch (e) {
    depsError =
      e instanceof PayrollEngineError ? e.message : 'This component cannot be calculated.';
  }
  if (deps) {
    notes.push(
      <Note key="deps" tone="info">
        {deps.length
          ? `Calculated after: ${deps.map((d) => d.name).join(', ')}. The engine works out this order for you.`
          : "Calculated first. It doesn't depend on any other component."}
      </Note>,
    );
  } else {
    notes.push(
      <Note key="err" tone="err">
        {depsError}
      </Note>,
    );
  }
  return <div className="flex flex-col gap-2">{notes}</div>;
}

export function ComponentEditor({
  component: c,
  all,
  currency,
  onChange,
  onDelete,
  inputs,
  saved,
  onSaveAsNew,
  onReplaceSaved,
}: ComponentEditorProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dependentCredits = all.filter(
    (x) => x.kind === 'credit' && (x.reduces === c.id || x.baseComponentId === c.id),
  );
  const linkedSaved = saved.find((x) => x.id === c.sourceTemplateId);
  const p = c.params;

  const patch = (next: Partial<PayComponent>) => onChange({ ...c, ...next });
  const patchParams = (next: Partial<ComponentParams>) => patch({ params: { ...p, ...next } });

  // Only the figures this payslip type has are offered, but a component that already points at
  // another one keeps showing it so the mismatch is visible rather than silently changed.
  const baseChoices: PayBase[] =
    c.kind === 'earning' ? [...inputs] : [...inputs, 'gross', 'pensionable', 'taxable_income'];
  if (!baseChoices.includes(c.base)) baseChoices.push(c.base);
  const baseOptions = baseChoices.map((b) => ({ value: b, label: BASE_LABELS[b] }));
  const deductionOptions = all
    .filter((x) => x.kind === 'deduction')
    .map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));
  // A credit comes off what the employee is charged, so it can only reduce a deduction taken from pay.
  const reducibleOptions = all
    .filter((x) => x.kind === 'deduction' && isDeductedFromPay(x))
    .map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));
  // A tax credit is calculated on one of the employee deductions; everything else on pay.
  const calculatedOn =
    c.kind === 'credit' ? (
      <SearchSelect
        label="Calculated on"
        placeholder="Choose a deduction"
        options={deductionOptions}
        value={c.baseComponentId ?? ''}
        onChange={(v) => patch({ base: 'component', baseComponentId: v || undefined })}
      />
    ) : (
      <SearchSelect
        label="Calculated on"
        clearable={false}
        options={baseOptions}
        value={c.base}
        onChange={(v) => v && patch({ base: v as PayBase })}
      />
    );

  const changeMethod = (method: CalcMethod) => {
    if (method === c.method) return;
    const defaults = DEFAULT_PARAMS[method]();
    const kept = Object.fromEntries(Object.entries(p).filter(([k]) => k in defaults));
    const params: ComponentParams = { ...defaults, ...kept };
    let base = c.base;
    if (method === 'bands') {
      base = c.kind === 'credit' ? 'component' : 'taxable_income';
      if (!(params.bands && params.bands.length > 1)) params.bands = DEFAULT_PARAMS.bands().bands;
    } else if (base === 'taxable_income' && c.kind === 'earning') {
      base = inputs[0] ?? 'basic';
    }
    if (method === 'formula' && !kept.expr) params.expr = `${inputs[0] ?? 'basic'} * 0.05`;
    let baseComponentId = c.baseComponentId;
    if (c.kind === 'credit') {
      // A tax credit is calculated on a deduction, starting with the one it reduces.
      base = 'component';
      baseComponentId = baseComponentId ?? c.reduces;
    }
    patch({ method, params, base, baseComponentId });
  };

  const bands = p.bands ?? [];
  const setBand = (i: number, field: 'upTo' | 'rate', value: number | null) =>
    patchParams({ bands: bands.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)) });
  const addBand = () => {
    const prev =
      bands.length > 1 && bands[bands.length - 2].upTo !== null ? bands[bands.length - 2].upTo! : 0;
    const next = [...bands];
    next.splice(bands.length - 1, 0, { upTo: prev + 1000, rate: 0 });
    patchParams({ bands: next });
  };

  const allowedMethods = (
    Object.entries(METHODS) as [CalcMethod, (typeof METHODS)[CalcMethod]][]
  ).filter(([, m]) => m.kinds.includes(c.kind));

  const formulaNames = [
    ...inputs,
    'gross',
    'pensionable',
    'taxable',
    ...all.filter((x) => x.id !== c.id).map((x) => x.code),
  ];
  const insertVariable = (name: string) => {
    const current = p.expr ?? '';
    const sep = current && !/[\s(+\-*/,]$/.test(current) ? ' ' : '';
    patchParams({ expr: current + sep + name });
  };

  const symbol = currency;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_150px] gap-3">
        <Input
          label="Name on the payslip"
          value={c.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <Input
          label="Code"
          value={c.code}
          onChange={(e) => patch({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
        />
      </div>

      <ToggleRow
        label="Include in payroll"
        description="Switch off to keep the setup without using it."
        enabled={c.enabled}
        onChange={(enabled) => patch({ enabled })}
      />

      <Notes component={c} all={all} />

      <FormSection title="Purpose">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-gray-900">Type</span>
            <span className="py-2 text-sm text-gray-900">{KIND_LABELS[c.kind]}</span>
          </div>
          <SearchSelect
            label="Role"
            placeholder={
              c.kind === 'deduction' && !isDeductedFromPay(c) ? 'None' : 'What does it represent?'
            }
            clearable={false}
            // Only a deduction taken from pay posts to accounting; the other types have one possible role.
            disabled={c.kind !== 'deduction' || !isDeductedFromPay(c)}
            options={ROLES_BY_KIND[c.kind].map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={roleOf(c) ?? ''}
            onChange={(v) => v && patch({ role: v as PayRole })}
          />
        </div>
      </FormSection>

      {c.kind === 'credit' && (
        <FormSection title="What does it reduce?">
          <SearchSelect
            label="Reduces which deduction"
            placeholder="Choose a deduction"
            options={reducibleOptions}
            value={c.reduces ?? ''}
            onChange={(v) => patch({ reduces: v || undefined })}
          />
        </FormSection>
      )}

      <FormSection title="How is it calculated?">
        <div
          className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2"
          role="group"
        >
          {allowedMethods.map(([key, m]) => (
            <button
              key={key}
              type="button"
              aria-pressed={c.method === key}
              onClick={() => changeMethod(key)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                c.method === key
                  ? 'border-(--module-btn-bg,var(--color-brand)) bg-[color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_10%,transparent)]'
                  : 'border-gray-200 hover:bg-(--surface-hover,var(--color-gray-100))',
              )}
            >
              <span className="block text-sm font-semibold text-gray-900">{m.label}</span>
              <span className="block text-xs text-gray-500">{m.description}</span>
            </button>
          ))}
        </div>

        {c.method === 'fixed' && (
          <Input
            label={`Amount each period (${symbol})`}
            type="number"
            step="any"
            value={show(p.amount)}
            onChange={(e) => patchParams({ amount: parseNumber(e.target.value) })}
          />
        )}

        {c.method === 'percent' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Rate (%)"
              type="number"
              step="any"
              value={show(p.rate)}
              onChange={(e) => patchParams({ rate: parseNumber(e.target.value) })}
            />
            {calculatedOn}
            <Input
              label="Pay limit (optional)"
              type="number"
              step="any"
              value={show(p.baseCap)}
              onChange={(e) => patchParams({ baseCap: parseNumber(e.target.value) })}
            />
            <Input
              label="Minimum amount (optional)"
              type="number"
              step="any"
              value={show(p.min)}
              onChange={(e) => patchParams({ min: parseNumber(e.target.value) })}
            />
            <Input
              label="Maximum amount (optional)"
              type="number"
              step="any"
              value={show(p.max)}
              onChange={(e) => patchParams({ max: parseNumber(e.target.value) })}
            />
            <p className="self-end pb-2 text-xs text-gray-500">
              Pay above the limit is ignored, like a contribution ceiling.
            </p>
          </div>
        )}

        {c.method === 'bands' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {calculatedOn}
              <SearchSelect
                label="Band limits are per"
                clearable={false}
                options={[
                  { value: 'monthly', label: 'Month' },
                  { value: 'annual', label: 'Year (income is annualised)' },
                ]}
                value={p.period === 'annual' ? 'annual' : 'monthly'}
                onChange={(v) => v && patchParams({ period: v as 'monthly' | 'annual' })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1fr_36px] gap-2 text-xs text-gray-500">
                <span>Income up to ({symbol})</span>
                <span>Rate (%)</span>
                <span />
              </div>
              {bands.map((b, i) => {
                const last = i === bands.length - 1;
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr_36px] items-center gap-2">
                    {last ? (
                      <span className="px-2 text-sm text-gray-500">and above</span>
                    ) : (
                      <NumberField
                        ariaLabel={`Band ${i + 1} upper limit`}
                        className="w-full"
                        value={b.upTo ?? 0}
                        onChange={(value) => setBand(i, 'upTo', value)}
                      />
                    )}
                    <Input
                      aria-label={`Band ${i + 1} rate`}
                      type="number"
                      step="any"
                      value={show(b.rate)}
                      onChange={(e) => setBand(i, 'rate', parseNumber(e.target.value))}
                    />
                    {bands.length > 2 && !last ? (
                      <button
                        type="button"
                        aria-label={`Remove band ${i + 1}`}
                        title="Remove band"
                        onClick={() => patchParams({ bands: bands.filter((_, idx) => idx !== i) })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              <div>
                <Button variant="outline" size="sm" onClick={addBand}>
                  Add band
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Each slice of income is taxed at its own rate. Only the part of income inside a band
                is charged that band&apos;s rate.
              </p>
            </div>
          </div>
        )}

        {c.method === 'variable' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SearchSelect
                label="Where does the amount come from?"
                clearable={false}
                options={VARIABLE_SOURCES_BY_KIND[c.kind].map((source) => ({
                  value: source,
                  label: VARIABLE_SOURCE_LABELS[source],
                }))}
                value={p.source ?? 'run'}
                onChange={(v) => v && patchParams({ source: v as VariableSource })}
              />
              {p.source === 'allowance' && (
                <SearchSelect
                  label="Allowance type"
                  placeholder="Choose an allowance type"
                  clearable={false}
                  options={ALLOWANCE_TYPES}
                  value={p.allowanceType ?? ''}
                  onChange={(v) => patchParams({ allowanceType: v || undefined })}
                />
              )}
            </div>
            <Note tone="info">
              {p.source === 'allowance'
                ? "Each employee's own allowance of this type is filled in when payroll is run, and can still be changed for that run. Whether it is taxed is set in Tax treatment below."
                : p.source === 'loans'
                  ? "Each employee's repayment from their loans and deductions is filled in when payroll is run, until the balance reaches zero. A paused loan deducts nothing."
                  : 'The amount is typed in for each employee when payroll is run. The name above is the column heading in the payroll table.'}{' '}
              Try an amount in the sample payslip.
            </Note>
          </div>
        )}

        {c.method === 'formula' && (
          <div className="flex flex-col gap-2">
            <Input
              label="Formula"
              spellCheck={false}
              autoComplete="off"
              value={p.expr ?? ''}
              onChange={(e) => patchParams({ expr: e.target.value })}
            />
            <span className="text-xs text-gray-500">
              Use + - * /, brackets, and min(), max(), round(), floor(), ceil(). Click a name to add
              it.
            </span>
            <div className="flex flex-wrap gap-1.5">
              {formulaNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => insertVariable(name)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Tax treatment">
        <div className="flex flex-col gap-3">
          {c.kind === 'earning' && (
            <>
              <ToggleRow
                label="Counts as taxable pay"
                description="Included when working out income tax."
                enabled={c.tags.taxable}
                onChange={(taxable) => patch({ tags: { ...c.tags, taxable } })}
              />
              <ToggleRow
                label="Counts as pensionable pay"
                description="Included in anything calculated on pensionable pay."
                enabled={c.tags.pensionable}
                onChange={(pensionable) => patch({ tags: { ...c.tags, pensionable } })}
              />
            </>
          )}
          {c.kind === 'deduction' && (
            <ToggleRow
              label="Deducted from pay"
              description="Taken from the employee's pay. Switch off for a relief that only lowers taxable income and isn't taken from pay."
              enabled={c.tags.deductedFromPay !== false}
              onChange={(deductedFromPay) => patch({ tags: { ...c.tags, deductedFromPay } })}
            />
          )}
          {c.kind === 'deduction' && (
            <ToggleRow
              label="Reduces taxable income"
              description="Taken off before tax is worked out, as pension contributions often are."
              enabled={c.tags.reducesTaxable}
              onChange={(reducesTaxable) => patch({ tags: { ...c.tags, reducesTaxable } })}
            />
          )}
          {c.kind === 'employer' && (
            <Note tone="info">
              Employer contributions are paid on top of pay. They don&apos;t change the
              employee&apos;s net pay or tax.
            </Note>
          )}
          {c.kind === 'credit' && (
            <Note tone="info">
              A tax credit comes off the deduction it reduces, after that deduction is calculated.
              It can bring the deduction to zero, never below, and it doesn&apos;t change taxable
              income.
            </Note>
          )}
          <div className="sm:w-1/2">
            <SearchSelect
              label="Rounding"
              clearable={false}
              options={ROUNDING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={c.rounding}
              onChange={(v) => v && patch({ rounding: v as RoundingMode })}
            />
            <p className="mt-1 text-xs text-gray-500">{roundingExample(c.rounding)}</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Reuse">
        <p className="mb-2 text-xs text-gray-500">
          {linkedSaved
            ? `Added from the saved component \u201c${linkedSaved.component.name}\u201d. Replace it to update the saved copy, or save this as a new one.`
            : 'Save this component to add it again whenever you build a set-up.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onSaveAsNew}>
            Save as new
          </Button>
          {linkedSaved && (
            <Button variant="outline" size="sm" onClick={onReplaceSaved}>
              Replace current
            </Button>
          )}
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
        <span className="text-xs text-gray-500">
          Changes apply to the sample payslip straight away.
        </span>
        <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
          Delete component
        </Button>
      </div>

      <ConfirmModal
        isOpen={confirmingDelete}
        title="Delete component"
        description={`Delete "${c.name}" from this configuration? This can't be undone, but earlier saved versions keep it.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
      >
        {dependentCredits.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Used by {dependentCredits.map((x) => x.name).join(', ')}, which will need a new
            deduction.
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
