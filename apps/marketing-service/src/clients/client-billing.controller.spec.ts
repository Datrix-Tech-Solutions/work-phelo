/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedInternalRequest } from '@work-phelo/internal-auth';
import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { ClientBillingController } from './client-billing.controller';
import { ClientBillingService } from './client-billing.service';
import { AccountingEvent } from './dto/billing.dto';
import { InternalAccountingEventsController } from './internal-accounting-events.controller';

const anyPermissions = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[];

describe('ClientBillingController authorization contract', () => {
  it('requires the marketing module and leads feature', () => {
    expect(Reflect.getMetadata(MODULE_KEY, ClientBillingController)).toBe(
      'marketing',
    );
    expect(Reflect.getMetadata(FEATURE_KEY, ClientBillingController)).toEqual({
      module: 'marketing',
      feature: 'leads',
    });
  });

  it('needs no permission on any billing route: the service limits it to the caller’s own clients unless they hold the billing permission', () => {
    for (const handler of [
      ClientBillingController.prototype.options,
      ClientBillingController.prototype.transactions,
      ClientBillingController.prototype.summary,
      ClientBillingController.prototype.requestPayment,
      ClientBillingController.prototype.cancelPayment,
      ClientBillingController.prototype.raise,
    ]) {
      expect(anyPermissions(handler)).toBeUndefined();
    }
  });
});

describe('InternalAccountingEventsController', () => {
  const event = {
    tenantId: 'tenant-1',
    sourceModule: 'MARKETING',
    transactionId: 'txn-1',
    event: AccountingEvent.POSTED,
  };
  const requestFrom = (service: string) =>
    ({ internalServiceName: service }) as AuthenticatedInternalRequest;

  let billing: { handleAccountingEvent: jest.Mock };
  let controller: InternalAccountingEventsController;

  beforeEach(() => {
    billing = {
      handleAccountingEvent: jest.fn().mockResolvedValue({ handled: true }),
    };
    controller = new InternalAccountingEventsController(
      billing as unknown as ClientBillingService,
    );
  });

  it('accepts the event from accounting-service', async () => {
    await expect(
      controller.handle(requestFrom('accounting-service'), event),
    ).resolves.toEqual({ handled: true });
    expect(billing.handleAccountingEvent).toHaveBeenCalledWith(event);
  });

  it.each(['hr-service', 'marketing-service', 'subscription-service'])(
    'refuses the event from %s even though it is an allowed service',
    (service) => {
      expect(() => controller.handle(requestFrom(service), event)).toThrow(
        ForbiddenException,
      );
      expect(billing.handleAccountingEvent).not.toHaveBeenCalled();
    },
  );
});
