import {
  ALLOWANCE_TYPES,
  BAND_PERIODS,
  CALC_METHODS,
  COMPONENT_KINDS,
  MAX_BANDS,
  MAX_COMPONENTS,
  METHODS_BY_KIND,
  PAY_BASES,
  PAY_ROLES,
  ROLES_BY_KIND,
  ROUNDING_MODES,
  VARIABLE_SOURCES,
  VARIABLE_SOURCES_BY_KIND,
  type CalcMethod,
  type ComponentKind,
  type PayBase,
  type PayComponentData,
  type PayRole,
  type RoundingMode,
  type VariableSource,
} from './payroll-configuration.constants';

export interface ValidationOptions {
  /**
   * A component saved for reuse on its own: links to other components in a configuration have no
   * meaning there, so they are dropped instead of checked.
   */
  standalone?: boolean;
}

export interface ValidationResult {
  components: PayComponentData[];
  errors: string[];
}

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');
const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);
const isAmount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
const isRate = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** Reads an optional amount: missing and null both mean "not set". */
function optionalAmount(
  raw: Raw,
  key: string,
  label: string,
  errors: string[],
): number | null | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isAmount(value)) {
    errors.push(`${label}: ${key} must be a number from 0 up.`);
    return undefined;
  }
  return value;
}

function optionalRate(
  raw: Raw,
  key: string,
  label: string,
  errors: string[],
): number | null | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRate(value)) {
    errors.push(`${label}: ${key} must be a rate from 0 to 100.`);
    return undefined;
  }
  return value;
}

function sanitizeOne(
  input: unknown,
  index: number,
  errors: string[],
): PayComponentData | null {
  if (!isObject(input)) {
    errors.push(`Component ${index + 1} must be an object.`);
    return null;
  }
  const label =
    typeof input.name === 'string' && input.name.trim()
      ? `"${input.name.trim()}"`
      : `Component ${index + 1}`;
  const before = errors.length;

  const id = input.id;
  if (typeof id !== 'string' || !id.trim() || id.length > 64) {
    errors.push(`${label}: id must be text up to 64 characters.`);
  }
  const code = input.code;
  if (typeof code !== 'string' || !/^[A-Z0-9_]{1,40}$/.test(code)) {
    errors.push(
      `${label}: code must be 1 to 40 capital letters, numbers or underscores.`,
    );
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 120) {
    errors.push(`${label}: name must be 1 to 120 characters.`);
  }
  if (!isOneOf(COMPONENT_KINDS, input.kind)) {
    errors.push(`${label}: kind must be one of ${COMPONENT_KINDS.join(', ')}.`);
  }
  if (!isOneOf(CALC_METHODS, input.method)) {
    errors.push(`${label}: method must be one of ${CALC_METHODS.join(', ')}.`);
  }
  if (typeof input.enabled !== 'boolean') {
    errors.push(`${label}: enabled must be true or false.`);
  }
  if (!isOneOf(PAY_BASES, input.base)) {
    errors.push(`${label}: base must be one of ${PAY_BASES.join(', ')}.`);
  }
  if (!isOneOf(ROUNDING_MODES, input.rounding)) {
    errors.push(
      `${label}: rounding must be one of ${ROUNDING_MODES.join(', ')}.`,
    );
  }
  if (!isObject(input.params)) errors.push(`${label}: params are missing.`);
  if (!isObject(input.tags)) errors.push(`${label}: tags are missing.`);
  if (errors.length > before) return null;

  // Past this point the basic fields are known to be valid.
  const kind = input.kind as ComponentKind;
  const method = input.method as CalcMethod;
  const base = input.base as PayBase;
  const rounding = input.rounding as RoundingMode;
  const rawParams = input.params as Raw;
  const rawTags = input.tags as Raw;

  if (!METHODS_BY_KIND[kind].includes(method)) {
    errors.push(
      `${label}: ${article(kind)} ${kind} can't use the ${method} method.`,
    );
  }

  let role: PayRole | undefined;
  if (input.role !== undefined && input.role !== null) {
    if (!isOneOf(PAY_ROLES, input.role)) {
      errors.push(`${label}: role must be one of ${PAY_ROLES.join(', ')}.`);
    } else if (!ROLES_BY_KIND[kind].includes(input.role)) {
      errors.push(
        `${label}: ${article(kind)} ${kind} can't have the ${input.role} role.`,
      );
    } else {
      role = input.role;
    }
  }

  const tags: PayComponentData['tags'] = {
    taxable: rawTags.taxable === true,
    pensionable: rawTags.pensionable === true,
    reducesTaxable: rawTags.reducesTaxable === true,
  };
  for (const key of ['taxable', 'pensionable', 'reducesTaxable'] as const) {
    if (typeof rawTags[key] !== 'boolean') {
      errors.push(`${label}: tags.${key} must be true or false.`);
    }
  }
  if (rawTags.deductedFromPay !== undefined) {
    if (typeof rawTags.deductedFromPay !== 'boolean') {
      errors.push(`${label}: tags.deductedFromPay must be true or false.`);
    } else {
      tags.deductedFromPay = rawTags.deductedFromPay;
    }
  }

  const params: PayComponentData['params'] = {};
  const amount = optionalAmount(rawParams, 'amount', label, errors);
  if (amount !== undefined) params.amount = amount;
  const rate = optionalRate(rawParams, 'rate', label, errors);
  if (rate !== undefined) params.rate = rate;
  for (const key of ['baseCap', 'min', 'max'] as const) {
    const value = optionalAmount(rawParams, key, label, errors);
    if (value !== undefined) params[key] = value;
  }

  if (method === 'bands') {
    if (!isOneOf(BAND_PERIODS, rawParams.period)) {
      errors.push(`${label}: band period must be monthly or annual.`);
    } else {
      params.period = rawParams.period;
    }
    const bands = rawParams.bands;
    if (!Array.isArray(bands) || bands.length < 1 || bands.length > MAX_BANDS) {
      errors.push(`${label}: bands must list 1 to ${MAX_BANDS} bands.`);
    } else {
      const clean: { upTo: number | null; rate: number | null }[] = [];
      let previous = -1;
      bands.forEach((band: unknown, i) => {
        if (!isObject(band)) {
          errors.push(`${label}: band ${i + 1} must be an object.`);
          return;
        }
        const last = i === bands.length - 1;
        let upTo: number | null = null;
        if (last) {
          if (band.upTo !== null && band.upTo !== undefined) {
            errors.push(`${label}: the last band must have no upper limit.`);
          }
        } else if (!isAmount(band.upTo)) {
          errors.push(`${label}: band ${i + 1} needs an upper limit.`);
        } else if (band.upTo <= previous) {
          errors.push(
            `${label}: band limits must go up from top to bottom (band ${i + 1}).`,
          );
        } else {
          upTo = band.upTo;
          previous = band.upTo;
        }
        const bandRate = optionalRate(
          band,
          'rate',
          `${label} band ${i + 1}`,
          errors,
        );
        clean.push({ upTo, rate: bandRate ?? null });
      });
      params.bands = clean;
    }
  }

  if (method === 'formula') {
    const expr = rawParams.expr;
    if (
      typeof expr !== 'string' ||
      !expr.trim() ||
      expr.length > 500 ||
      !/^[A-Za-z0-9_+\-*/(),.\s]+$/.test(expr)
    ) {
      errors.push(
        `${label}: the formula must be 1 to 500 characters of names, numbers and + - * / ( ) ,.`,
      );
    } else {
      params.expr = expr;
    }
  }

  if (method === 'variable') {
    const source: VariableSource = isOneOf(VARIABLE_SOURCES, rawParams.source)
      ? rawParams.source
      : 'run';
    if (rawParams.source !== undefined && source !== rawParams.source) {
      errors.push(`${label}: unknown source for a variable amount.`);
    } else if (!VARIABLE_SOURCES_BY_KIND[kind].includes(source)) {
      errors.push(
        `${label}: ${article(kind)} ${kind} can't take its amount from ${source}.`,
      );
    } else {
      params.source = source;
      if (source === 'allowance') {
        if (!isOneOf(ALLOWANCE_TYPES, rawParams.allowanceType)) {
          errors.push(`${label}: choose which allowance type it takes.`);
        } else {
          params.allowanceType = rawParams.allowanceType;
        }
      }
    }
  }

  // An earning can only be worked out from what was typed in, never from pay that includes itself.
  if (
    kind === 'earning' &&
    (method === 'percent' || method === 'bands') &&
    base !== 'basic' &&
    base !== 'commission'
  ) {
    errors.push(
      `${label}: an earning can only be calculated on the basic salary or the commission figure.`,
    );
  }
  if (
    kind === 'deduction' &&
    tags.reducesTaxable &&
    base === 'taxable_income' &&
    (method === 'percent' || method === 'bands')
  ) {
    errors.push(
      `${label}: it reduces taxable income, so it can't also be calculated on taxable income.`,
    );
  }

  const data: PayComponentData = {
    id: id as string,
    code: code as string,
    name,
    kind,
    method,
    enabled: input.enabled as boolean,
    base,
    rounding,
    params,
    tags,
  };
  if (role) data.role = role;
  for (const key of [
    'reduces',
    'baseComponentId',
    'sourceTemplateId',
  ] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !value || value.length > 64) {
      errors.push(`${label}: ${key} must be text up to 64 characters.`);
    } else if (key === 'sourceTemplateId' || kind === 'credit') {
      data[key] = value;
    }
  }
  return data;
}

/**
 * Checks and cleans a list of pay components before they are stored. Unknown fields are dropped.
 * The calculation itself is the engine's job; this only makes sure what is stored is well formed
 * and that the links between components point at something that exists.
 */
export function validateComponents(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(input)) {
    return { components: [], errors: ['Components must be a list.'] };
  }
  if (input.length > MAX_COMPONENTS) {
    return {
      components: [],
      errors: [`A configuration can hold up to ${MAX_COMPONENTS} components.`],
    };
  }

  const components: PayComponentData[] = [];
  input.forEach((item, index) => {
    const clean = sanitizeOne(item, index, errors);
    if (clean) components.push(clean);
  });
  if (errors.length) return { components: [], errors };

  if (options.standalone) {
    components.forEach((c) => {
      delete c.reduces;
      delete c.baseComponentId;
    });
    return { components, errors };
  }

  const ids = new Set<string>();
  const codes = new Set<string>();
  components.forEach((c) => {
    if (ids.has(c.id))
      errors.push(`"${c.name}": the id ${c.id} is used twice.`);
    ids.add(c.id);
    const code = c.code.toLowerCase();
    if (codes.has(code)) {
      errors.push(`"${c.name}": the code ${c.code} is used twice.`);
    }
    codes.add(code);
  });

  const byId = new Map(components.map((c) => [c.id, c]));
  const deduction = (id: string | undefined) => {
    const found = id ? byId.get(id) : undefined;
    return found && found.kind === 'deduction' ? found : undefined;
  };
  components
    .filter((c) => c.kind === 'credit' && c.enabled)
    .forEach((c) => {
      const target = deduction(c.reduces);
      if (!target) {
        errors.push(`"${c.name}": choose which deduction it reduces.`);
      } else if (target.tags.deductedFromPay === false) {
        errors.push(
          `"${c.name}": it reduces "${target.name}", which isn't deducted from pay.`,
        );
      }
      if (
        (c.method === 'percent' || c.method === 'bands') &&
        c.base === 'component' &&
        !deduction(c.baseComponentId)
      ) {
        errors.push(`"${c.name}": choose which deduction it is calculated on.`);
      }
    });
  components
    .filter((c) => c.kind !== 'credit' && c.base === 'component')
    .forEach((c) => {
      if (c.method === 'percent' || c.method === 'bands') {
        errors.push(
          `"${c.name}": only a tax credit can be calculated on another component.`,
        );
      }
    });

  return { components: errors.length ? [] : components, errors };
}
