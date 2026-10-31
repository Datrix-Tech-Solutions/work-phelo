import { Request, Response } from 'express';
import { RequestUser } from '@work-phelo/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TenantAssetStorageService } from '../tenants/tenant-asset-storage.service';

describe('Auth current integration state for downstream verification', () => {
  it.each([
    undefined,
    { reinsuranceAccounting: false },
    { reinsuranceAccounting: true },
  ])(
    'returns only the authenticated current integration state: %p',
    async (integrationConfig) => {
      const user: RequestUser = {
        id: 'user',
        tenantId: 'tenant',
        role: 'EMPLOYEE',
        email: 'user@example.test',
        tenantSlug: 'acme',
        tenantName: 'Acme',
        firstName: 'User',
        permissions: [],
        moduleConfig: {},
        featureConfig: {},
        integrationConfig,
      };
      const auth = {
        signAccessToken: jest.fn().mockReturnValue('test-access-token'),
      };
      const storage = {
        resolveAvatarReadUrl: jest.fn().mockResolvedValue(null),
      };
      const controller = new AuthController(
        auth as unknown as AuthService,
        storage as unknown as TenantAssetStorageService,
      );
      const result = await controller.me(
        { user } as Request & { user: RequestUser },
        { cookie: jest.fn() } as unknown as Response,
      );
      expect(result.user.integrationConfig).toEqual(integrationConfig ?? {});
      expect(result.permissions).toEqual([]);
    },
  );
});
