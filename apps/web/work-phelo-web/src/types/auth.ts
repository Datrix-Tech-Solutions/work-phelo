export interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE' | 'MANAGER';
  isManager?: boolean; // true when the user manages direct reports (any role can be a manager)
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  lastName?: string;
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
