import type { TypeChipColor } from '@/components/atoms/TypeChip';
import type { PayRole } from '@/lib/payroll-engine';

/** The chip colour for each accounting role, so a role looks the same everywhere it is shown. */
export const ROLE_COLORS: Record<PayRole, TypeChipColor> = {
  salary_wages: 'green',
  income_tax: 'red',
  employee_social_security: 'blue',
  employer_social_security: 'purple',
  pension: 'teal',
  other_deductions: 'gray',
  tax_credit: 'amber',
};
