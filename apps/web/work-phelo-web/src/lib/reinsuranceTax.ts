import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

/** Non-resident cedant premiums remitted to reinsurers attract NIC Levy + Withholding Tax. */
export const NIC_LEVY_RATE = 0.01;
export const WITHHOLDING_TAX_RATE = 0.05;
export const FOREIGN_CEDANT_DEDUCTION_RATE = NIC_LEVY_RATE + WITHHOLDING_TAX_RATE;

/** True when the cedant's primary address country is anything other than Ghana. */
export function isForeignCedant(cedant: Counterparty | null | undefined): boolean {
  const primary = cedant?.addresses.find((a) => a.isPrimary) ?? cedant?.addresses[0];
  if (!primary) return false;
  return codeToCountry(primary.country) !== 'Ghana';
}
