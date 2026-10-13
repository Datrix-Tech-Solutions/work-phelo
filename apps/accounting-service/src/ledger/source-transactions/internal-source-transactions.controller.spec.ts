import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedInternalRequest } from '../../auth/guards/internal-service-auth.guard';
import { InternalSourceTransactionsController } from './internal-source-transactions.controller';
import { SourceTransactionsService } from './source-transactions.service';

describe('InternalSourceTransactionsController', () => {
  const create = {
    tenantId: 'tenant-1',
    sourceModule: 'MARKETING',
    idempotencyKey: 'k1',
    externalRef: 'client-1',
    entityName: 'Dell Computers',
    entityTypeId: 'et-1',
    transactionTypeId: 'tt-1',
    amount: 20000,
  } as never;

  let service: Record<
    'getOptions' | 'create' | 'list' | 'receiptsSummary',
    jest.Mock
  >;
  let controller: InternalSourceTransactionsController;

  const request = (serviceName: string, actingUserId?: string) =>
    ({
      internalServiceName: serviceName,
      internalActingUserId: actingUserId,
    }) as AuthenticatedInternalRequest;

  beforeEach(() => {
    service = {
      getOptions: jest.fn().mockResolvedValue({ ready: true }),
      create: jest.fn().mockResolvedValue({ transactionId: 't1' }),
      list: jest.fn().mockResolvedValue({ items: [] }),
      receiptsSummary: jest.fn().mockResolvedValue({ entities: [] }),
    };
    controller = new InternalSourceTransactionsController(
      service as unknown as SourceTransactionsService,
    );
  });

  it('serves a module only to its own service', () => {
    expect(() =>
      controller.options(request('hr-service'), {
        tenantId: 'tenant-1',
        sourceModule: 'MARKETING',
      } as never),
    ).toThrow(ForbiddenException);
    expect(service.getOptions).not.toHaveBeenCalled();
  });

  it('serves the marketing service for marketing', async () => {
    await controller.options(request('marketing-service'), {
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
    } as never);

    expect(service.getOptions).toHaveBeenCalledWith('tenant-1', 'MARKETING');
  });

  it('refuses modules that are not registered', () => {
    expect(() =>
      controller.options(request('marketing-service'), {
        tenantId: 'tenant-1',
        sourceModule: 'RECRUITMENT',
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('will not raise a transaction without a signed acting user', () => {
    expect(() =>
      controller.create(request('marketing-service'), create),
    ).toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('raises the transaction as the acting user', async () => {
    await controller.create(request('marketing-service', 'user-1'), create);

    expect(service.create).toHaveBeenCalledWith('user-1', create);
  });

  it('pins listing and receipts to the module’s own service too', () => {
    expect(() =>
      controller.list(request('hr-service'), {
        sourceModule: 'MARKETING',
      } as never),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.receiptsSummary(request('hr-service'), {
        sourceModule: 'MARKETING',
      } as never),
    ).toThrow(ForbiddenException);
  });
});
