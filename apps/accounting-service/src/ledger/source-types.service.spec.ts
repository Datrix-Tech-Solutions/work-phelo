import { BadRequestException } from '@nestjs/common';
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
      {} as never,
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

describe('SourceTypesService link / unlink', () => {
  const user = { tenantId: 'tenant-1' } as unknown as RequestUser;

  function build(module: string) {
    const prisma = {
      sourceType: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 's1', module, name: 'Source' }),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ id: 's1', module, name: 'Source', ...data }),
          ),
      },
    };
    const payrollSetup = {
      assertReadyToLink: jest.fn().mockResolvedValue(undefined),
      assertCanUnlink: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SourceTypesService(
      prisma as never,
      {} as never,
      {} as never,
      payrollSetup as never,
    );
    return { service, prisma, payrollSetup };
  }

  it('links payroll only once its accounts are chosen', async () => {
    const { service, prisma, payrollSetup } = build('HR');
    payrollSetup.assertReadyToLink.mockRejectedValue(
      new BadRequestException('Choose an account for Net Pay Payable'),
    );

    await expect(service.link(user, 's1')).rejects.toThrow(
      'Choose an account for Net Pay Payable',
    );
    expect(prisma.sourceType.update).not.toHaveBeenCalled();
  });

  it('links payroll when it is ready', async () => {
    const { service, prisma, payrollSetup } = build('HR');

    const result = await service.link(user, 's1');

    expect(payrollSetup.assertReadyToLink).toHaveBeenCalledWith('tenant-1');
    expect(prisma.sourceType.update).toHaveBeenCalled();
    expect(result.isActive).toBe(true);
  });

  it('does not unlink payroll while liabilities are still unpaid', async () => {
    const { service, prisma, payrollSetup } = build('HR');
    payrollSetup.assertCanUnlink.mockRejectedValue(
      new BadRequestException('2 payroll liabilities are still unpaid'),
    );

    await expect(service.unlink(user, 's1')).rejects.toThrow('still unpaid');
    expect(payrollSetup.assertCanUnlink).toHaveBeenCalledWith('tenant-1', 's1');
    expect(prisma.sourceType.update).not.toHaveBeenCalled();
  });

  it('leaves other modules’ sources alone', async () => {
    const { service, payrollSetup } = build('MARKETING');

    await service.link(user, 's1');
    await service.unlink(user, 's1');

    expect(payrollSetup.assertReadyToLink).not.toHaveBeenCalled();
    expect(payrollSetup.assertCanUnlink).not.toHaveBeenCalled();
  });
});
