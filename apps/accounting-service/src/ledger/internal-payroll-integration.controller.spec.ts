import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedInternalRequest } from '../auth/guards/internal-service-auth.guard';
import { InternalPayrollIntegrationController } from './internal-payroll-integration.controller';
import { PostPayrollAccrualDto } from './dto/payroll-integration.dto';

const request = (
  service: string,
  actingUserId?: string,
): AuthenticatedInternalRequest =>
  ({
    internalServiceName: service,
    internalActingUserId: actingUserId,
  }) as AuthenticatedInternalRequest;

describe('InternalPayrollIntegrationController', () => {
  const build = () => {
    const service = {
      postAccrual: jest.fn().mockResolvedValue({ id: 'j-1' }),
      getSettlementStatus: jest.fn().mockResolvedValue({}),
    };
    const setup = { getStatus: jest.fn().mockResolvedValue({ linked: true }) };
    const controller = new InternalPayrollIntegrationController(
      service as never,
      setup as never,
    );
    return { controller, service, setup };
  };
  const dto = { tenantId: 't1', payrollRunId: 'r1' } as PostPayrollAccrualDto;

  it('posts an accrual for hr-service, passing the acting user through', async () => {
    const { controller, service } = build();

    await controller.postAccrual(request('hr-service', 'approver-1'), dto);

    expect(service.postAccrual).toHaveBeenCalledWith(
      'hr-service',
      'approver-1',
      dto,
    );
  });

  it('needs a signed request that names the acting user', () => {
    const { controller, service } = build();

    expect(() => controller.postAccrual(request('hr-service'), dto)).toThrow(
      ForbiddenException,
    );
    expect(service.postAccrual).not.toHaveBeenCalled();
  });

  it('serves no other service, even one that is allowed in', () => {
    const { controller, service, setup } = build();

    expect(() =>
      controller.postAccrual(request('marketing-service', 'u1'), dto),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.getStatus(request('marketing-service'), { tenantId: 't1' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.getSettlementStatus(request('marketing-service'), 'r1', {
        tenantId: 't1',
      }),
    ).toThrow(ForbiddenException);
    expect(service.postAccrual).not.toHaveBeenCalled();
    expect(setup.getStatus).not.toHaveBeenCalled();
  });

  it('answers hr-service with whether payroll is linked', async () => {
    const { controller, setup } = build();

    await expect(
      controller.getStatus(request('hr-service'), { tenantId: 't1' }),
    ).resolves.toEqual({ linked: true });
    expect(setup.getStatus).toHaveBeenCalledWith('t1');
  });
});
