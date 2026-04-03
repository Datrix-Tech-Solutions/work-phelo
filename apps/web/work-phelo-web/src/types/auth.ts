export interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE';
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  companyRoleId?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug?: string;
}
