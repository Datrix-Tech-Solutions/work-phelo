import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { HrAccountingClient } from '../accounting-integration/client/accounting.client';
import { PayrollService } from './payroll.service';

const ACTOR = {
  id: 'approver-1',
  tenantId: 'tenant-1',
} as unknown as RequestUser;

const RUN = { id: 'run-1', tenantId: 'tenant-1', month: 3, year: 2026 };

type Mocked = {
  prisma: {
    payrollRun: {
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    payrollItem: { aggregate: jest.Mock };
  };
  accounting: {
    isConfigured: jest.Mock;
    getPayrollAccountingStatus: jest.Mock;
    postPayrollAccrual: jest.Mock;
    getPayrollSettlementStatus: jest.Mock;
  };
};

function build() {
  const prisma: Mocked['prisma'] = {
    payrollRun: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        totalGross: 1000,
        totalNet: 800,
        totalPAYE: 100,
        totalTier1: 55,
        totalTier2: 0,
        totalTier3: 0,
        totalEmployerCost: 1130,
      }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...RUN, ...data }),
        ),
    },
    payrollItem: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { otherDeductions: 0 } }),
    },
  };
  const accounting: Mocked['accounting'] = {
    isConfigured: jest.fn().mockReturnValue(true),
    getPayrollAccountingStatus: jest.fn(),
    postPayrollAccrual: jest.fn().mockResolvedValue({}),
    getPayrollSettlementStatus: jest.fn(),
  };
  const service = new PayrollService(
    prisma as never,
    { createMany: jest.fn() } as never,
    { emit: jest.fn() } as never,
    {} as never,
    accounting as unknown as HrAccountingClient,
  );
  jest
    .spyOn(
      service as unknown as { notifyPayrollDecision: () => Promise<unknown> },
      'notifyPayrollDecision',
    )
    .mockResolvedValue(undefined);
  return { service, prisma, accounting };
}

describe('PayrollService accounting link', () => {
  const pending = { ...RUN, status: 'PENDING_APPROVAL' };

  describe('approvePayroll', () => {
    it('runs on its own when payroll is not linked in Accounting', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: false,
        ready: false,
        missingRoles: [],
      });

      const result = await service.approvePayroll('tenant-1', 'run-1', ACTOR, {
        note: 'ok',
      });

      expect(accounting.postPayrollAccrual).not.toHaveBeenCalled();
      expect(prisma.payrollRun.update.mock.calls[0][0].data).toMatchObject({
        status: 'APPROVED',
        postedToAccounting: false,
      });
      expect(result.accountingPosting).toEqual({
        posted: false,
        reason: 'not_linked',
      });
    });

    it('runs on its own, without asking, when there is no accounting service', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.isConfigured.mockReturnValue(false);

      await service.approvePayroll('tenant-1', 'run-1', ACTOR, { note: 'ok' });

      expect(accounting.getPayrollAccountingStatus).not.toHaveBeenCalled();
      expect(prisma.payrollRun.update.mock.calls[0][0].data).toMatchObject({
        postedToAccounting: false,
      });
    });

    it('posts the accrual for the approver and records that the run was posted', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: true,
        ready: true,
        missingRoles: [],
      });

      const result = await service.approvePayroll('tenant-1', 'run-1', ACTOR, {
        note: 'ok',
      });

      expect(accounting.postPayrollAccrual).toHaveBeenCalledTimes(1);
      const [payload, actingUserId] =
        accounting.postPayrollAccrual.mock.calls[0];
      expect(payload).toMatchObject({
        tenantId: 'tenant-1',
        payrollRunId: 'run-1',
      });
      expect(payload).not.toHaveProperty('autoPost');
      expect(actingUserId).toBe('approver-1');
      expect(prisma.payrollRun.update.mock.calls[0][0].data).toMatchObject({
        postedToAccounting: true,
      });
      expect(result.accountingPosting).toEqual({ posted: true });
    });

    it('stops and names the missing accounts when linked but not ready', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: true,
        ready: false,
        missingRoles: [{ key: 'netPayPayable', label: 'Net Pay Payable' }],
      });

      const error = await service
        .approvePayroll('tenant-1', 'run-1', ACTOR, { note: 'ok' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(
        (error as UnprocessableEntityException).getResponse(),
      ).toMatchObject({
        code: 'ACCOUNTING_NOT_READY',
        message: expect.stringContaining('Net Pay Payable') as string,
      });
      expect(accounting.postPayrollAccrual).not.toHaveBeenCalled();
      expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    });

    it('never falls back to running on its own when Accounting cannot be asked', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.getPayrollAccountingStatus.mockRejectedValue(
        new Error('timeout'),
      );

      const error = await service
        .approvePayroll('tenant-1', 'run-1', ACTOR, { note: 'ok' })
        .catch((e: unknown) => e);

      expect(
        (error as UnprocessableEntityException).getResponse(),
      ).toMatchObject({ code: 'ACCOUNTING_STATUS_UNAVAILABLE' });
      expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    });

    it('leaves the run pending when the accrual itself fails', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue(pending);
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: true,
        ready: true,
        missingRoles: [],
      });
      accounting.postPayrollAccrual.mockRejectedValue(new Error('no period'));

      const error = await service
        .approvePayroll('tenant-1', 'run-1', ACTOR, { note: 'ok' })
        .catch((e: unknown) => e);

      expect(
        (error as UnprocessableEntityException).getResponse(),
      ).toMatchObject({ code: 'ACCOUNTING_POSTING_FAILED' });
      expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    });
  });

  describe('getAccountingStatus', () => {
    it('reports UNKNOWN rather than throwing when Accounting cannot be reached', async () => {
      const { service, accounting } = build();
      accounting.getPayrollAccountingStatus.mockRejectedValue(
        new Error('down'),
      );

      await expect(service.getAccountingStatus('tenant-1')).resolves.toEqual({
        mode: 'UNKNOWN',
        ready: false,
        missingRoles: [],
      });
    });

    it('lists the missing account labels when linked but not ready', async () => {
      const { service, accounting } = build();
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: true,
        ready: false,
        missingRoles: [
          { key: 'incomeTaxPayable', label: 'Income Tax Payable' },
        ],
      });

      await expect(service.getAccountingStatus('tenant-1')).resolves.toEqual({
        mode: 'ACCOUNTING',
        ready: false,
        missingRoles: ['Income Tax Payable'],
      });
    });

    it('is STANDALONE when payroll is not linked', async () => {
      const { service, accounting } = build();
      accounting.getPayrollAccountingStatus.mockResolvedValue({
        linked: false,
        ready: false,
        missingRoles: [],
      });

      await expect(service.getAccountingStatus('tenant-1')).resolves.toEqual({
        mode: 'STANDALONE',
        ready: true,
        missingRoles: [],
      });
    });
  });

  describe('a run keeps how it was approved', () => {
    it('blocks Mark as Paid for a run that was posted to Accounting', async () => {
      const { service, prisma } = build();
      prisma.payrollRun.findFirst.mockResolvedValue({
        ...RUN,
        status: 'APPROVED',
        postedToAccounting: true,
        items: [],
      });

      await expect(service.markAsPaid('tenant-1', 'run-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('shows no settlement progress for a run that ran on its own', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue({
        postedToAccounting: false,
      });

      await expect(
        service.getSettlementStatusForRun('tenant-1', 'run-1'),
      ).resolves.toBeNull();
      expect(accounting.getPayrollSettlementStatus).not.toHaveBeenCalled();
    });

    it('reads settlement progress for a run that was posted', async () => {
      const { service, prisma, accounting } = build();
      prisma.payrollRun.findFirst.mockResolvedValue({
        postedToAccounting: true,
      });
      accounting.getPayrollSettlementStatus.mockResolvedValue({ netPay: null });

      await service.getSettlementStatusForRun('tenant-1', 'run-1');

      expect(accounting.getPayrollSettlementStatus).toHaveBeenCalledWith(
        'tenant-1',
        'run-1',
      );
    });
  });
});
