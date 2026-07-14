import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

/**
 * Neutral fallback for legacy preview-only documents.
 * Official note and financial document calculations use backend tenant
 * ReinsuranceChargeConfiguration snapshots, not frontend statutory constants.
 */
export const NIC_LEVY_RATE = 0;
export const WITHHOLDING_TAX_RATE = 0;
export const FOREIGN_CEDANT_DEDUCTION_RATE = NIC_LEVY_RATE + WITHHOLDING_TAX_RATE;

/** True when the cedant's primary address country is anything other than Ghana. */
export function isForeignCedant(cedant: Counterparty | null | undefined): boolean {
  const primary = cedant?.addresses.find((a) => a.isPrimary) ?? cedant?.addresses[0];
  if (!primary) return false;
  return codeToCountry(primary.country) !== 'Ghana';
}
