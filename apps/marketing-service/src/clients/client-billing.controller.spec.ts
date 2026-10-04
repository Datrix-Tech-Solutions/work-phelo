/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedInternalRequest } from '@work-phelo/internal-auth';
import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { FEATURE_KEY } from '../auth/guards/feature.guard';
import { MODULE_KEY } from '../auth/guards/module.guard';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
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

  it('lets anyone who can view clients ask whether billing is available', () => {
    expect(anyPermissions(ClientBillingController.prototype.options)).toEqual([
      P.CLIENTS_VIEW,
    ]);
  });

  it('requires billing view to read transactions and revenue', () => {
    expect(
      anyPermissions(ClientBillingController.prototype.transactions),
    ).toEqual([P.CLIENTS_BILLING_VIEW]);
    expect(anyPermissions(ClientBillingController.prototype.summary)).toEqual([
      P.CLIENTS_BILLING_VIEW,
    ]);
  });

  it('requires billing create to raise a transaction', () => {
    expect(anyPermissions(ClientBillingController.prototype.raise)).toEqual([
      P.CLIENTS_BILLING_CREATE,
    ]);
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
