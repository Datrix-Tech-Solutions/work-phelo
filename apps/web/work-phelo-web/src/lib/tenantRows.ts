import type { Company, Tenant } from '@/types/tenant';

/** Turns a tenant from the API into a row for the super admin tables. */
export function toCompany(c: Tenant): Company {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? '',
    dateCreated: c.createdAt
      ? new Date(c.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : '—',
    contact: c.phone ?? '—',
    industry: c.industry ?? '—',
    status: c.status ?? 'SUSPENDED',
    isVerified: c.isVerified === true,
  };
}
