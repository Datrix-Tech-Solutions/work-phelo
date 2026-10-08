import {
  ALLOWANCE_TYPES as ENGINE_ALLOWANCE_TYPES,
  BASE_LABELS,
  KIND_ORDER,
  METHODS,
  PAYSLIP_TYPES,
  ROLES_BY_KIND as ENGINE_ROLES_BY_KIND,
  ROLE_LABELS,
  ROUNDING_OPTIONS,
  VARIABLE_SOURCES_BY_KIND as ENGINE_SOURCES_BY_KIND,
  VARIABLE_SOURCE_LABELS,
} from '@work-phelo/payroll-engine';
import {
  ALLOWANCE_TYPES,
  CALC_METHODS,
  COMPONENT_KINDS,
  METHODS_BY_KIND,
  PAYSLIP_TYPE_KEYS,
  PAY_BASES,
  PAY_ROLES,
  ROLES_BY_KIND,
  ROUNDING_MODES,
  VARIABLE_SOURCES,
  VARIABLE_SOURCES_BY_KIND,
} from './payroll-configuration.constants';

/**
 * The server keeps its own lists of what a component can be (it checks untyped input). These tests
 * fail the moment they drift from the payroll engine, which is the one source of truth.
 */
describe('server constants match the payroll engine', () => {
  const sorted = (list: readonly string[]) => [...list].sort();

  it('component kinds, methods, bases, roles, sources and payslip types', () => {
    expect(sorted(COMPONENT_KINDS)).toEqual(sorted(KIND_ORDER));
    expect(sorted(CALC_METHODS)).toEqual(sorted(Object.keys(METHODS)));
    expect(sorted(PAY_BASES)).toEqual(sorted(Object.keys(BASE_LABELS)));
    expect(sorted(PAY_ROLES)).toEqual(sorted(Object.keys(ROLE_LABELS)));
    expect(sorted(VARIABLE_SOURCES)).toEqual(
      sorted(Object.keys(VARIABLE_SOURCE_LABELS)),
    );
    expect(sorted(PAYSLIP_TYPE_KEYS)).toEqual(
      sorted(Object.keys(PAYSLIP_TYPES)),
    );
    expect(sorted(ROUNDING_MODES)).toEqual(
      sorted(ROUNDING_OPTIONS.map((o) => o.value)),
    );
    expect(sorted(ALLOWANCE_TYPES)).toEqual(
      sorted(ENGINE_ALLOWANCE_TYPES.map((a) => a.value)),
    );
  });

  it('which methods, roles and sources each kind can use', () => {
    for (const kind of KIND_ORDER) {
      const methodsForKind = Object.entries(METHODS)
        .filter(([, m]) => m.kinds.includes(kind))
        .map(([key]) => key);
      expect(sorted(METHODS_BY_KIND[kind])).toEqual(sorted(methodsForKind));
      expect(sorted(ROLES_BY_KIND[kind])).toEqual(
        sorted(ENGINE_ROLES_BY_KIND[kind]),
      );
      expect(sorted(VARIABLE_SOURCES_BY_KIND[kind])).toEqual(
        sorted(ENGINE_SOURCES_BY_KIND[kind]),
      );
    }
  });
});
