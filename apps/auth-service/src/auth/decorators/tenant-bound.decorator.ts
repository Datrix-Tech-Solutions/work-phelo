import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as tenant-bound, meaning the route has a :tenantId param
 * and the user must match that tenant (unless SUPER_ADMIN).
 *
 * Usage:
 * @Get(':tenantId/users')
 * @TenantBound()
 * async getTenantUsers(@Param('tenantId') tenantId: string) { ... }
 */
export const TenantBound = () => SetMetadata('tenantBound', true);

/**
 * Marks a route as platform-admin-only.
 * No tenant scoping — SUPER_ADMIN access only.
 *
 * Usage:
 * @Post('register')
 * @PlatformAdminOnly()
 * async register(@Body() dto: CreateTenantDto) { ... }
 */
export const PlatformAdminOnly = () => SetMetadata('platformAdminOnly', true);

/**
 * Marks a route as tenant-admin-allowed, but only within their own tenant.
 * If a :tenantId param exists and doesn't match user.tenantId, access is denied
 * (unless SUPER_ADMIN).
 *
 * Usage:
 * @Patch(':tenantId/features')
 * @TenantAdminSelfOnly()
 * async updateFeatures(@Param('tenantId') tenantId: string) { ... }
 */
export const TenantAdminSelfOnly = () =>
  SetMetadata('tenantAdminSelfOnly', true);
