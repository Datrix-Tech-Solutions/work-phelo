import { SystemPermissionBackfillService } from './system-permission-backfill.service';
import { backfillSystemPermissionState } from './system-permission-sets';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('./system-permission-sets', () => ({
  backfillSystemPermissionState: jest.fn(),
}));

describe('startup permission backfill policy', () => {
  const original = process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED;
  afterEach(() => {
    if (original === undefined)
      delete process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED;
    else process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED = original;
    jest.resetAllMocks();
  });
  it('does not mutate permissions when explicitly disabled for DEV rollout', async () => {
    process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED = 'false';
    await new SystemPermissionBackfillService(
      {} as PrismaService,
    ).onModuleInit();
    expect(backfillSystemPermissionState).not.toHaveBeenCalled();
  });
  it('preserves existing behavior in environments without the explicit off-switch', async () => {
    delete process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED;
    await new SystemPermissionBackfillService(
      {} as PrismaService,
    ).onModuleInit();
    expect(backfillSystemPermissionState).toHaveBeenCalledTimes(1);
  });
  it('still fails startup if an enabled backfill fails', async () => {
    process.env.AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED = 'true';
    jest
      .mocked(backfillSystemPermissionState)
      .mockRejectedValueOnce(new Error('fixture failure'));
    await expect(
      new SystemPermissionBackfillService({} as PrismaService).onModuleInit(),
    ).rejects.toThrow('fixture failure');
  });
});
