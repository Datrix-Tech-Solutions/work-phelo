/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SourceProvisioningService } from './source-provisioning.service';
import { SOURCE_REGISTRY } from './source-registry';

describe('SourceProvisioningService', () => {
  const marketing = SOURCE_REGISTRY.MARKETING!;
  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const makePrisma = () => ({
    sourceType: { findFirst: jest.fn(), create: jest.fn() },
    entityType: { findFirst: jest.fn(), create: jest.fn() },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let service: SourceProvisioningService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.sourceType.findFirst.mockResolvedValue(null);
    prisma.sourceType.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 'source-1', ...data }),
    );
    prisma.entityType.findFirst.mockResolvedValue(null);
    prisma.entityType.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 'entity-type-1', ...data }),
    );
    service = new SourceProvisioningService(prisma as unknown as PrismaService);
  });

  it('creates the source unlinked, so the accountant links it deliberately', async () => {
    const source = await service.ensure('tenant-1', marketing);

    expect(prisma.sourceType.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        module: 'MARKETING',
        name: 'Client Billing',
        isActive: false,
      },
    });
    expect(source.isActive).toBe(false);
  });

  it('leaves an existing source exactly as the tenant set it', async () => {
    prisma.sourceType.findFirst.mockResolvedValue({
      id: 'source-1',
      isActive: true,
    });

    const source = await service.ensure('tenant-1', marketing);

    expect(prisma.sourceType.create).not.toHaveBeenCalled();
    expect(source.isActive).toBe(true);
  });

  it('never creates an entity type - those belong to the tenant', async () => {
    await service.ensure('tenant-1', marketing);

    expect(prisma.entityType.create).not.toHaveBeenCalled();
    expect(prisma.entityType.findFirst).not.toHaveBeenCalled();
  });

  it('copes with another request creating the source at the same moment', async () => {
    prisma.sourceType.create.mockRejectedValue(uniqueError());
    prisma.sourceType.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'source-raced', isActive: false });

    const source = await service.ensure('tenant-1', marketing);

    expect(source.id).toBe('source-raced');
  });

  describe('ensureForUser', () => {
    const user = (moduleConfig: Record<string, unknown>) =>
      ({ tenantId: 'tenant-1', moduleConfig }) as unknown as RequestUser;

    it('provisions the modules the tenant has', async () => {
      await service.ensureForUser(user({ marketing: { enabled: true } }));

      expect(prisma.sourceType.create).toHaveBeenCalledTimes(1);
    });

    it('does nothing for modules the tenant does not have', async () => {
      await service.ensureForUser(user({ hr: true }));

      expect(prisma.sourceType.findFirst).not.toHaveBeenCalled();
      expect(prisma.sourceType.create).not.toHaveBeenCalled();
    });
  });
});
