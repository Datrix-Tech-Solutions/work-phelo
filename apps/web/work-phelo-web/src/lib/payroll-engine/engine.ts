import { evaluateFormula, formulaRefs } from './formula';
import { roundAmount } from './rounding';
import {
  PayrollEngineError,
  type ComponentResult,
  type ComponentTrace,
  type PayBase,
  type PayInputs,
  type VariableAmounts,
  type PayComponent,
  type PayslipResult,
  type TraceSlice,
} from './types';

/** A deduction takes money from the employee unless it is switched to only lower taxable income. */
export const isDeductedFromPay = (c: PayComponent) => c.tags.deductedFromPay !== false;

const isSet = (v: number | null | undefined): v is number => v !== null && v !== undefined;
const num = (v: number | null | undefined) => (isSet(v) ? v : 0);

/** Components that must be calculated before `c`, so the order is worked out for the user. */
export function dependenciesOf(c: PayComponent, comps: PayComponent[]): PayComponent[] {
  const byCode = new Map(comps.map((x) => [x.code.toLowerCase(), x]));
  const out = new Set<PayComponent>();
  let needEarnings = false;
  let needReducers = false;

  const addBase = (b: PayBase) => {
    if (b === 'gross' || b === 'pensionable') needEarnings = true;
    if (b === 'taxable_income') {
      needEarnings = true;
      needReducers = true;
    }
  };

  if (c.method === 'percent' || c.method === 'bands') addBase(c.base);
  if (c.method === 'formula') {
    formulaRefs(c.params.expr).forEach((id) => {
      if (id === 'gross' || id === 'pensionable') needEarnings = true;
      else if (id === 'taxable') {
        needEarnings = true;
        needReducers = true;
      } else if (id !== 'basic' && id !== 'commission') {
        const target = byCode.get(id);
        if (target && target !== c) out.add(target);
      }
    });
  }
  if (c.kind === 'credit') {
    const byId = new Map(comps.map((x) => [x.id, x]));
    const target = c.reduces ? byId.get(c.reduces) : undefined;
    if (target && target !== c) out.add(target);
    const base = c.baseComponentId ? byId.get(c.baseComponentId) : undefined;
    if (base && base !== c) out.add(base);
  }
  if (needEarnings) {
    if (c.kind === 'earning') {
      throw new PayrollEngineError(
        `"${c.name}" is an earning, so it can't be based on gross, pensionable or taxable pay.`,
      );
    }
    comps.forEach((x) => {
      if (x.kind === 'earning' && x !== c) out.add(x);
    });
  }
  if (needReducers) {
    if (c.kind === 'deduction' && c.tags.reducesTaxable) {
      throw new PayrollEngineError(
        `"${c.name}" reduces taxable income, so it can't also be calculated on taxable income.`,
      );
    }
    comps.forEach((x) => {
      if (x.kind === 'deduction' && x.tags.reducesTaxable && x !== c) out.add(x);
    });
  }
  return [...out];
}

interface Context {
  basic: number;
  commission: number;
  readonly gross: number;
  readonly pensionable: number;
  readonly taxable: number;
}

function calculateOne(
  c: PayComponent,
  ctx: Context,
  results: Map<string, ComponentResult>,
  byCode: Map<string, PayComponent>,
  byId: Map<string, PayComponent>,
  variables: VariableAmounts,
): ComponentResult {
  const p = c.params;
  const baseComponent = c.baseComponentId ? byId.get(c.baseComponentId) : undefined;
  const baseName = c.base === 'component' ? baseComponent?.name : undefined;
  const baseValue = (b: PayBase): number => {
    if (b === 'taxable_income') return ctx.taxable;
    if (b === 'component') {
      // The amount before any tax credit is taken off it.
      return baseComponent ? (results.get(baseComponent.id)?.amount ?? 0) : 0;
    }
    return ctx[b];
  };
  let raw = 0;
  let trace: ComponentTrace;

  if (c.method === 'fixed') {
    raw = num(p.amount);
    trace = { type: 'fixed', amount: raw };
  } else if (c.method === 'variable') {
    raw = Math.max(0, variables[c.id] ?? 0);
    trace = { type: 'variable', amount: raw };
  } else if (c.method === 'percent') {
    const full = baseValue(c.base);
    let used = full;
    let cap: number | null = null;
    if (isSet(p.baseCap) && full > p.baseCap) {
      used = p.baseCap;
      cap = p.baseCap;
    }
    let v = (used * num(p.rate)) / 100;
    let floor: number | null = null;
    let ceil: number | null = null;
    if (isSet(p.min) && v < p.min) {
      v = p.min;
      floor = p.min;
    }
    if (isSet(p.max) && v > p.max) {
      v = p.max;
      ceil = p.max;
    }
    raw = v;
    trace = {
      type: 'percent',
      base: c.base,
      baseName,
      full,
      used,
      cap,
      rate: num(p.rate),
      floor,
      ceil,
    };
  } else if (c.method === 'bands') {
    const factor = p.period === 'annual' ? 12 : 1;
    const income = baseValue(c.base) * factor;
    let prev = 0;
    let tax = 0;
    const slices: TraceSlice[] = [];
    (p.bands ?? []).forEach((b) => {
      const upper = isSet(b.upTo) ? b.upTo : Infinity;
      const inBand = Math.max(0, Math.min(income, upper) - prev);
      const t = (inBand * num(b.rate)) / 100;
      slices.push({ from: prev, to: upper, amount: inBand, rate: num(b.rate), tax: t });
      tax += t;
      if (upper > prev) prev = upper;
    });
    raw = tax / factor;
    trace = { type: 'bands', base: c.base, baseName, factor, income, tax, slices };
  } else if (c.method === 'formula') {
    const lookup = (id: string): number => {
      const k = id.toLowerCase();
      if (k === 'basic') return ctx.basic;
      if (k === 'commission') return ctx.commission;
      if (k === 'gross') return ctx.gross;
      if (k === 'pensionable') return ctx.pensionable;
      if (k === 'taxable') return ctx.taxable;
      const t = byCode.get(k);
      const done = t && t !== c ? results.get(t.id) : undefined;
      if (done) return done.amount;
      throw new PayrollEngineError(`Unknown name "${id}"`);
    };
    try {
      raw = evaluateFormula(p.expr, lookup);
    } catch (e) {
      throw new PayrollEngineError(`${c.name}: ${(e as Error).message}.`);
    }
    trace = { type: 'formula', expr: p.expr ?? '', value: raw };
  } else {
    throw new PayrollEngineError(`${c.name}: unknown calculation method.`);
  }

  return { component: c, amount: roundAmount(raw, c.rounding), relief: 0, applied: 0, trace };
}

export function calculatePayslip(
  components: PayComponent[],
  inputs: PayInputs,
  /** What was typed in for each variable component; missing ones count as 0. */
  variables: VariableAmounts = {},
): PayslipResult {
  const { basic, commission } = inputs;
  const comps = components.filter((c) => c.enabled);
  const results = new Map<string, ComponentResult>();
  const byCode = new Map(comps.map((c) => [c.code.toLowerCase(), c]));
  const byId = new Map(comps.map((c) => [c.id, c]));
  const earnings = comps.filter((c) => c.kind === 'earning');
  const reducers = comps.filter((c) => c.kind === 'deduction' && c.tags.reducesTaxable);
  const amountOf = (c: PayComponent) => results.get(c.id)?.amount ?? 0;
  const sum = (list: PayComponent[]) => list.reduce((s, c) => s + amountOf(c), 0);

  const ctx: Context = {
    basic,
    commission,
    get gross() {
      return basic + sum(earnings);
    },
    get pensionable() {
      return basic + sum(earnings.filter((c) => c.tags.pensionable));
    },
    get taxable() {
      return Math.max(0, basic + sum(earnings.filter((c) => c.tags.taxable)) - sum(reducers));
    },
  };

  const deps = new Map(comps.map((c) => [c.id, dependenciesOf(c, comps)]));
  const pending = [...comps];
  while (pending.length) {
    let progressed = false;
    for (let i = 0; i < pending.length; i++) {
      const c = pending[i];
      if ((deps.get(c.id) ?? []).every((d) => results.has(d.id))) {
        results.set(c.id, calculateOne(c, ctx, results, byCode, byId, variables));
        pending.splice(i, 1);
        i--;
        progressed = true;
      }
    }
    if (!progressed) {
      throw new PayrollEngineError(
        `These components depend on each other in a loop: ${pending.map((c) => c.name).join(', ')}.`,
      );
    }
  }

  comps
    .filter((c) => c.kind === 'credit')
    .forEach((c) => {
      const r = results.get(c.id);
      const target = c.reduces ? byId.get(c.reduces) : undefined;
      const targetResult = target ? results.get(target.id) : undefined;
      if (!r || !target || !targetResult || target.kind !== 'deduction') return;
      // A credit can bring its deduction down to zero, never below.
      r.applied = Math.max(0, Math.min(r.amount, targetResult.amount - targetResult.relief));
      targetResult.relief += r.applied;
      r.targetName = target.name;
    });

  const gross = ctx.gross;
  const totalDeductions = comps
    .filter((c) => c.kind === 'deduction' && isDeductedFromPay(c))
    .reduce((s, c) => {
      const r = results.get(c.id);
      return r ? s + r.amount - r.relief : s;
    }, 0);
  const totalEmployer = sum(comps.filter((c) => c.kind === 'employer'));

  return {
    byId: results,
    gross,
    taxable: ctx.taxable,
    pensionable: ctx.pensionable,
    totalDeductions,
    net: Math.max(0, gross - totalDeductions),
    shortfall: Math.max(0, totalDeductions - gross),
    totalEmployer,
    employerCost: gross + totalEmployer,
  };
}
