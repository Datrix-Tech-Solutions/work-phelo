import { TenantConfigService } from './tenant-config.service';
import { TenantModulesInternalController } from './tenant-modules-internal.controller';

describe('TenantModulesInternalController', () => {
  it('returns the module config of the tenant named in the path', async () => {
    const response = { moduleConfig: { marketing: true } };
    const config = { getModuleConfig: jest.fn().mockResolvedValue(response) };
    const controller = new TenantModulesInternalController(
      config as unknown as TenantConfigService,
    );

    await expect(controller.get('tenant-1')).resolves.toBe(response);
    expect(config.getModuleConfig).toHaveBeenCalledWith('tenant-1');
  });
});
