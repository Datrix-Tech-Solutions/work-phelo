import { ExecutionContext, SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PERMISSION_EXEMPT_KEY = 'permission-exemption';

export type PermissionExemption = {
  policy: 'self-service' | 'module-reference' | 'service-policy';
  reason: string;
};

// This declares a reviewed policy; authentication and entitlement guards still run.
export const PermissionExempt = (
  policy: PermissionExemption['policy'],
  reason: string,
) => SetMetadata(PERMISSION_EXEMPT_KEY, { policy, reason });

// A method declaration replaces the class declaration as a whole, including ALL/ANY.
export function permissionTargets(
  handler: ReturnType<ExecutionContext['getHandler']>,
  controller: ReturnType<ExecutionContext['getClass']>,
) {
  const keys = [PERMISSIONS_KEY, PERMISSION_EXEMPT_KEY];
  return handler &&
    keys.some((key) => Reflect.getMetadata(key, handler) !== undefined)
    ? [handler]
    : [controller];
}
