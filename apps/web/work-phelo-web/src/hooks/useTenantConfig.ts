import { useAuthStore } from '@/store/auth.store';
import { useTenant } from '@/hooks/useTenants';
import { COUNTRY_CONFIG } from '@/lib/CompanyOptions';

export function useTenantConfig() {
  const user = useAuthStore((s) => s.user);
  const { data: tenant } = useTenant(user?.tenantId ?? '');

  const countryConfig = tenant?.country ? COUNTRY_CONFIG[tenant.country] : null;

  return {
    currency: tenant?.currency ?? countryConfig?.currency ?? 'GHS',
    dialCode: countryConfig?.dialCode ?? '+233',
  };
}
