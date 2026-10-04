import { RequestUser } from '@work-phelo/types';
import { SourceTypesService } from './source-types.service';

describe('SourceTypesService.list', () => {
  const user = {
    tenantId: 'tenant-1',
    moduleConfig: { marketing: true },
  } as unknown as RequestUser;

  it('makes sure the modules the tenant has are there to link, then lists them', async () => {
    const order: string[] = [];
    const prisma = {
      sourceType: {
        findMany: jest.fn().mockImplementation(() => {
          order.push('list');
          return Promise.resolve([
            {
              id: 's1',
              module: 'MARKETING',
              name: 'Client Billing',
              isActive: false,
            },
          ]);
        }),
      },
    };
    const provisioning = {
      ensureForUser: jest.fn().mockImplementation(() => {
        order.push('provision');
        return Promise.resolve();
      }),
    };
    const sourceLedger = {
      getSettlementSummary: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new SourceTypesService(
      prisma as never,
      sourceLedger as never,
      provisioning as never,
    );

    const result = await service.list(user);

    expect(provisioning.ensureForUser).toHaveBeenCalledWith(user);
    expect(order).toEqual(['provision', 'list']);
    expect(result).toEqual([
      {
        id: 's1',
        module: 'MARKETING',
        name: 'Client Billing',
        isActive: false,
        entryCount: 0,
        paidCount: 0,
      },
    ]);
  });
});
