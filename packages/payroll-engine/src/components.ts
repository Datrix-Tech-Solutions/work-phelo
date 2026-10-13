import { DEFAULT_PARAMS, DEFAULT_ROLE, type ComponentTemplate } from './constants';
import type { PayBase, PayComponent, SavedPayComponent } from './types';

let seq = 0;
export const newComponentId = () => `pc_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function newComponent(
  tpl: ComponentTemplate,
  existing: PayComponent[],
  /** What a percentage is calculated on by default: the first figure the payslip type has. */
  defaultBase: PayBase = 'basic',
): PayComponent {
  let n = 1;
  let code: string;
  do {
    code = `NEW_${n++}`;
  } while (existing.some((c) => c.code === code));

  const names = {
    earning: 'New earning',
    deduction: 'New deduction',
    credit: 'New tax credit',
    employer: 'New employer contribution',
  } as const;

  const params = DEFAULT_PARAMS[tpl.method]();
  // A credit starts on the tax-like deduction, since that is what it usually reduces.
  const reduces =
    tpl.kind === 'credit'
      ? (
          existing.find((c) => c.kind === 'deduction' && c.method === 'bands') ??
          existing.find((c) => c.kind === 'deduction')
        )?.id
      : undefined;

  return {
    id: newComponentId(),
    code,
    name: names[tpl.kind],
    kind: tpl.kind,
    method: tpl.method,
    enabled: true,
    role: DEFAULT_ROLE[tpl.kind],
    base:
      tpl.kind === 'credit' ? 'component' : tpl.method === 'bands' ? 'taxable_income' : defaultBase,
    ...(tpl.kind === 'credit' ? { reduces, baseComponentId: reduces } : {}),
    rounding: 'cent',
    params,
    tags: {
      taxable: tpl.kind === 'earning',
      pensionable: false,
      reducesTaxable: false,
      deductedFromPay: true,
    },
  };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function newSavedId(): string {
  return `saved_${Date.now().toString(36)}_${(seq++).toString(36)}`;
}

/** Snapshot of a component for the saved list. */
export function toSaved(c: PayComponent, id: string = newSavedId()): SavedPayComponent {
  // A credit's links point at components in this configuration, so a saved copy leaves them blank.
  const {
    id: _id,
    enabled: _enabled,
    sourceTemplateId: _source,
    reduces: _reduces,
    baseComponentId: _baseComponentId,
    ...component
  } = c;
  void _id;
  void _enabled;
  void _source;
  void _reduces;
  void _baseComponentId;
  return { id, savedAt: new Date().toISOString(), component: clone(component) };
}

/** A fresh component copied from a saved one. The code gets a suffix if it is already in use. */
export function fromSaved(saved: SavedPayComponent, existing: PayComponent[]): PayComponent {
  const base = saved.component.code;
  let code = base;
  let n = 2;
  while (existing.some((c) => c.code === code)) code = `${base}_${n++}`;
  return {
    ...clone(saved.component),
    code,
    id: newComponentId(),
    enabled: true,
    sourceTemplateId: saved.id,
  };
}
