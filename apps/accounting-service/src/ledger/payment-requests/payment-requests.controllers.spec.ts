/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { AuthenticatedInternalRequest } from '../../auth/guards/internal-service-auth.guard';
import { AccountingPermission } from '../accounting.permissions';
import { InternalPaymentRequestsController } from './internal-payment-requests.controller';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';

const permissionsOf = (handler: object) =>
  Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];

describe('InternalPaymentRequestsController', () => {
  const create = { tenantId: 't', sourceModule: 'MARKETING' } as never;
  const cancel = {
    tenantId: 't',
    sourceModule: 'MARKETING',
    externalRef: 'c1',
  } as never;
  const requestFrom = (service: string, actingUserId?: string) =>
    ({
      internalServiceName: service,
      internalActingUserId: actingUserId,
    }) as AuthenticatedInternalRequest;

  let service: { createFromSource: jest.Mock; cancelFromSource: jest.Mock };
  let controller: InternalPaymentRequestsController;

  beforeEach(() => {
    service = {
      createFromSource: jest.fn().mockResolvedValue({ id: 'req-1' }),
      cancelFromSource: jest.fn().mockResolvedValue({ id: 'req-1' }),
    };
    controller = new InternalPaymentRequestsController(
      service as unknown as PaymentRequestsService,
    );
  });

  it('serves a module only to its own service', () => {
    expect(() =>
      controller.create(requestFrom('hr-service', 'u1'), create),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.cancel(requestFrom('hr-service', 'u1'), 'id', cancel),
    ).toThrow(ForbiddenException);
  });

  it('refuses modules that are not registered', () => {
    expect(() =>
      controller.create(requestFrom('marketing-service', 'u1'), {
        tenantId: 't',
        sourceModule: 'RECRUITMENT',
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('needs a signed acting user to raise or cancel a request', () => {
    expect(() =>
      controller.create(requestFrom('marketing-service'), create),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.cancel(requestFrom('marketing-service'), 'id', cancel),
    ).toThrow(ForbiddenException);
    expect(service.createFromSource).not.toHaveBeenCalled();
  });

  it('raises and cancels as the acting user', async () => {
    await controller.create(requestFrom('marketing-service', 'user-1'), create);
    await controller.cancel(
      requestFrom('marketing-service', 'user-1'),
      'req-1',
      cancel,
    );

    expect(service.createFromSource).toHaveBeenCalledWith('user-1', create);
    expect(service.cancelFromSource).toHaveBeenCalledWith(
      'user-1',
      'req-1',
      cancel,
    );
  });
});

describe('PaymentRequestsController authorization', () => {
  it('viewing needs the receivables view permission', () => {
    expect(permissionsOf(PaymentRequestsController.prototype.list)).toEqual([
      AccountingPermission.RECEIVABLES_VIEW,
    ]);
    expect(
      permissionsOf(PaymentRequestsController.prototype.listForInvoice),
    ).toEqual([AccountingPermission.RECEIVABLES_VIEW]);
  });

  it('completing needs every permission Receive Payment uses: create, post and allocate', () => {
    expect(permissionsOf(PaymentRequestsController.prototype.complete)).toEqual(
      [
        AccountingPermission.RECEIVABLES_CREATE,
        AccountingPermission.RECEIVABLES_POST,
        AccountingPermission.RECEIVABLES_ALLOCATE,
      ],
    );
  });

  it('rejecting is an approval decision, so it needs the post permission', () => {
    expect(permissionsOf(PaymentRequestsController.prototype.reject)).toEqual([
      AccountingPermission.RECEIVABLES_POST,
    ]);
  });
});
