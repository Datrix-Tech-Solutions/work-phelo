export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  country?: string;
  industry?: string;
  size?: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  createdAt: string;
}

export interface RegisterTenantPayload {
  name: string;
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  industry?: string;
  size?: string;
}
