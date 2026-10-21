import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'resource-permissions';
export const ANY_PERMISSIONS_KEY = 'resource-permissions-any';

/** The caller needs every permission listed. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** The caller needs at least one of the permissions listed. */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
