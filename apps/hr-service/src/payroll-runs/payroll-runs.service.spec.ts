// The service only needs these two as injected collaborators, and loading the real ones pulls in
// the whole messaging and notification stack, so they are replaced with empty stand-ins.
jest.mock('../messaging/rabbitmq.publisher', () => ({
  RabbitMQPublisher: class {},
}));
jest.mock('../payroll/payroll.service', () => ({ PayrollService: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PayrollRunsService, monthEndIso } from './payroll-runs.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import type { PayrollService } from '../payroll/payroll.service';

const TENANT = 'tenant-1';
const ACTOR = { id: 'user-1', tenantId: TENANT } as unknown as RequestUser;

const base = { enabled: true, base: 'basic', rounding: 'cent', params: {} };
const tags = { taxable: false, pensionable: false, reducesTaxable: false };

const GHANA = [
  {
    ...base,
    id: 'transport',
    code: 'TRANSPORT',
    name: 'Transport',
    kind: 'earning',
    method: 'variable',
    role: 'salary_wages',
    params: { source: 'allowance', allowanceType: 'TRANSPORT' },
    tags,
  },
  {
    ...base,
    id: 'ssnit1',
    code: 'SSNIT_T1',
    name: 'SSNIT Tier 1',
    kind: 'deduction',
    method: 'percent',
    role: 'employee_social_security',
    params: { rate: 0.5, baseCap: 69000 },
    tags: { ...tags, reducesTaxable: true },
  },
  {
    ...base,
    id: 'ssnit2',
    code: 'SSNIT_T2',
    name: 'SSNIT Tier 2',
    kind: 'deduction',
    method: 'percent',
    role: 'employee_social_security',
    params: { rate: 5, baseCap: 69000 },
    tags: { ...tags, reducesTaxable: true },
  },
  {
    ...base,
    id: 'paye',
    code: 'PAYE',
    name: 'PAYE',
    kind: 'deduction',
    method: 'bands',
    role: 'income_tax',
    base: 'taxable_income',
    params: {
      period: 'monthly',
      bands: [
        { upTo: 490, rate: 0 },
        { upTo: 600, rate: 5 },
        { upTo: 730, rate: 10 },
        { upTo: 3896.67, rate: 17.5 },
        { upTo: 19896.67, rate: 25 },
        { upTo: 50416.67, rate: 30 },
        { upTo: null, rate: 35 },
      ],
    },
    tags,
  },
  {
    ...base,
    id: 'loans',
    code: 'LOANS',
    name: 'Loan repayment',
    kind: 'deduction',
    method: 'variable',
    role: 'other_deductions',
    params: { source: 'loans' },
    tags,
  },
  {
    ...base,
    id: 'er',
    code: 'SSNIT_ER',
    name: 'SSNIT (employer)',
    kind: 'employer',
    method: 'percent',
    role: 'employer_social_security',
    params: { rate: 13, baseCap: 69000 },
    tags,
  },
];

const configRow = (over: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  tenantId: TENANT,
  name: 'Regular employees',
  payslipType: 'MONTHLY',
  versions: [
    {
      version: 1,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      note: '',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      components: GHANA,
    },
  ],
  ...over,
});

const group = (over: Record<string, unknown> = {}) => ({
  id: 'group-1',
  tenantId: TENANT,
  name: 'Regular',
  configurationId: 'cfg-1',
  ...over,
});

const employee = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: null,
  firstName: id,
  lastName: 'Mensah',
  basicSalary: '5000',
  compensationType: 'SALARY',
  payrollGroupId: 'group-1',
  allowances: [],
  deductions: [],
  ...over,
});

const transportAllowance = {
  id: 'al-1',
  type: 'TRANSPORT',
  name: 'Transport',
  amount: '300',
};

function build(
  options: {
    employees?: ReturnType<typeof employee>[];
    runs?: { id: string; status: string; payslipKey: string }[];
    configurations?: ReturnType<typeof configRow>[];
    groups?: ReturnType<typeof group>[];
  } = {},
) {
  const prisma = {
    payrollRun: {
      findMany: jest.fn().mockResolvedValue(options.runs ?? []),
      delete: jest.fn().mockResolvedValue({}),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'run-1', ...data }),
        ),
    },
    employee: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.employees ?? [employee('kofi')]),
    },
    payrollGroup: {
      findMany: jest.fn().mockResolvedValue(options.groups ?? [group()]),
    },
    payrollConfiguration: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.configurations ?? [configRow()]),
    },
    tenantConfig: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ payrollCountry: 'GH', payrollCurrency: 'GHS' }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const rabbitmq = { authGetUserStatuses: jest.fn().mockResolvedValue([]) };
  const payroll = {
    submitPayrollForApproval: jest
      .fn()
      .mockResolvedValue({ id: 'run-1', status: 'PENDING_APPROVAL' }),
    approvePayroll: jest.fn().mockResolvedValue({}),
  };
  const service = new PayrollRunsService(
    prisma as unknown as PrismaService,
    rabbitmq as unknown as RabbitMQPublisher,
    payroll as unknown as PayrollService,
  );
  return { service, prisma, rabbitmq, payroll };
}

const dto = (over: Record<string, unknown> = {}) => ({
  payslipType: 'monthly' as const,
  month: 10,
  year: 2026,
  ...over,
});

describe('monthEndIso', () => {
  it('is the last day of the month', () => {
    expect(monthEndIso(10, 2026)).toBe('2026-10-31');
    expect(monthEndIso(2, 2028)).toBe('2028-02-29');
    expect(monthEndIso(4, 2026)).toBe('2026-04-30');
  });
});

describe('PayrollRunsService.run', () => {
  it('works out the payslips with the configuration version in force and sends them for approval', async () => {
    const { service, prisma, payroll } = build({
      employees: [employee('kofi', { allowances: [transportAllowance] })],
    });

    await service.run(TENANT, ACTOR, dto());

    const data = prisma.payrollRun.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: TENANT,
      month: 10,
      year: 2026,
      payslipKey: 'monthly',
      status: 'DRAFT',
      totalGross: '5300.00',
      totalNet: '4245.25',
      totalIncomeTax: '779.75',
      totalEmployeeSocialSecurity: '275.00',
      totalEmployerSocialSecurity: '650.00',
      totalPension: '0.00',
      totalOtherDeductions: '0.00',
      totalEmployerCost: '5950.00',
    });
    const [item] = data.items.create;
    expect(item).toMatchObject({
      employeeId: 'kofi',
      payrollGroupId: 'group-1',
      configurationId: 'cfg-1',
      configurationVersion: 1,
      grossSalary: '5300.00',
      netSalary: '4245.25',
      incomeTax: '779.75',
      employeeSocialSecurity: '275.00',
    });
    expect(
      item.lines.create.map((l: { code: string; role: string }) => [
        l.code,
        l.role,
      ]),
    ).toEqual([
      ['TRANSPORT', 'salary_wages'],
      ['SSNIT_T1', 'employee_social_security'],
      ['SSNIT_T2', 'employee_social_security'],
      ['PAYE', 'income_tax'],
      ['LOANS', 'other_deductions'],
      ['SSNIT_ER', 'employer_social_security'],
    ]);
    expect(item.allowanceItems.create).toEqual([
      {
        tenantId: TENANT,
        name: 'Transport',
        type: 'TRANSPORT',
        amount: '300.00',
      },
    ]);
    expect(payroll.submitPayrollForApproval).toHaveBeenCalledWith(
      TENANT,
      'run-1',
      ACTOR,
    );
  });

  it('records each loan, so paying the run can bring its balance down', async () => {
    const { service, prisma } = build({
      employees: [
        employee('ama', {
          deductions: [
            {
              id: 'loan-1',
              name: 'Staff loan',
              totalAmount: '4800',
              monthlyRate: '400',
              amountPaid: '1600',
              startDate: new Date('2026-06-01T00:00:00.000Z'),
            },
          ],
        }),
      ],
    });

    await service.run(TENANT, ACTOR, dto());

    const [item] = prisma.payrollRun.create.mock.calls[0][0].data.items.create;
    expect(item.deductionItems.create).toEqual([
      {
        tenantId: TENANT,
        employeeDeductionId: 'loan-1',
        name: 'Staff loan',
        amount: '400.00',
      },
    ]);
    expect(item.otherDeductions).toBe('400.00');
  });

  it("only includes people paid this way, and uses each group's own configuration", async () => {
    const commissionConfig = configRow({
      id: 'cfg-2',
      name: 'Agents',
      payslipType: 'COMMISSION',
    });
    const { service, prisma } = build({
      employees: [
        employee('kofi'),
        employee('agent', {
          compensationType: 'COMMISSION',
          payrollGroupId: 'group-2',
        }),
      ],
      groups: [group(), group({ id: 'group-2', configurationId: 'cfg-2' })],
      configurations: [configRow(), commissionConfig],
    });

    await service.run(TENANT, ACTOR, dto());

    const items = prisma.payrollRun.create.mock.calls[0][0].data.items.create;
    expect(items.map((i: { employeeId: string }) => i.employeeId)).toEqual([
      'kofi',
    ]);
  });

  it('refuses to run while anyone on payroll has no group', async () => {
    const { service, prisma } = build({
      employees: [employee('kofi'), employee('lone', { payrollGroupId: null })],
    });

    await expect(service.run(TENANT, ACTOR, dto())).rejects.toThrow(
      /1 employee has no payroll group \(lone Mensah\)/,
    );
    expect(prisma.payrollRun.create).not.toHaveBeenCalled();
  });

  it('leaves out people whose account is still waiting to be verified', async () => {
    const { service, prisma, rabbitmq } = build({
      employees: [
        employee('kofi', { userId: 'u-1' }),
        employee('new', { userId: 'u-2' }),
      ],
    });
    rabbitmq.authGetUserStatuses.mockResolvedValue([
      { userId: 'u-1', status: 'ACTIVE' },
      { userId: 'u-2', status: 'PENDING_VERIFICATION' },
    ]);

    await service.run(TENANT, ACTOR, dto());

    const items = prisma.payrollRun.create.mock.calls[0][0].data.items.create;
    expect(items.map((i: { employeeId: string }) => i.employeeId)).toEqual([
      'kofi',
    ]);
  });

  describe('a month that has already been run', () => {
    it('is blocked once the old system ran it', async () => {
      const { service, prisma } = build({
        runs: [{ id: 'old', status: 'PAID', payslipKey: 'legacy' }],
      });
      await expect(service.run(TENANT, ACTOR, dto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.payrollRun.create).not.toHaveBeenCalled();
    });

    it('is blocked for a type that is already with approval or approved', async () => {
      const { service } = build({
        runs: [{ id: 'r', status: 'PENDING_APPROVAL', payslipKey: 'monthly' }],
      });
      await expect(service.run(TENANT, ACTOR, dto())).rejects.toThrow(
        /already been run/,
      );
    });

    it('lets another type run in the same month', async () => {
      const { service, prisma } = build({
        runs: [{ id: 'r', status: 'APPROVED', payslipKey: 'commission' }],
      });
      await service.run(TENANT, ACTOR, dto());
      expect(prisma.payrollRun.create).toHaveBeenCalled();
    });

    it('replaces a run that was returned to draft', async () => {
      const { service, prisma } = build({
        runs: [{ id: 'draft-1', status: 'DRAFT', payslipKey: 'monthly' }],
      });
      await service.run(TENANT, ACTOR, dto());
      expect(prisma.payrollRun.delete).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
      });
      expect(prisma.payrollRun.create).toHaveBeenCalled();
    });
  });

  describe('configurations that cannot be used', () => {
    it('refuses one with no version in force yet', async () => {
      const early = configRow({
        versions: [
          {
            version: 1,
            effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
            note: '',
            createdAt: new Date(),
            components: GHANA,
          },
        ],
      });
      const { service } = build({ configurations: [early] });
      await expect(service.run(TENANT, ACTOR, dto())).rejects.toThrow(
        /Regular employees has no version in force/,
      );
    });

    it("refuses one the engine's own checks reject", async () => {
      const loop = configRow({
        versions: [
          {
            version: 1,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            note: '',
            createdAt: new Date(),
            components: [
              {
                ...base,
                id: 'a',
                code: 'A',
                name: 'A',
                kind: 'deduction',
                method: 'formula',
                params: { expr: 'B' },
                tags,
              },
              {
                ...base,
                id: 'b',
                code: 'B',
                name: 'B',
                kind: 'deduction',
                method: 'formula',
                params: { expr: 'A' },
                tags,
              },
            ],
          },
        ],
      });
      const { service } = build({ configurations: [loop] });
      await expect(service.run(TENANT, ACTOR, dto())).rejects.toThrow(/loop/);
    });
  });

  it("refuses when someone's deductions are more than their pay", async () => {
    const { service, prisma } = build({
      employees: [
        employee('ama', {
          basicSalary: '1000',
          deductions: [
            {
              id: 'l',
              name: 'Big loan',
              totalAmount: '9000',
              monthlyRate: '1500',
              amountPaid: '0',
              startDate: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
        }),
      ],
    });

    await expect(service.run(TENANT, ACTOR, dto())).rejects.toThrow(
      /Deductions are more than pay for ama Mensah/,
    );
    expect(prisma.payrollRun.create).not.toHaveBeenCalled();
  });

  it('refuses when no one is paid this way', async () => {
    const { service } = build({
      employees: [employee('agent', { payrollGroupId: 'group-1' })],
    });
    await expect(
      service.run(TENANT, ACTOR, dto({ payslipType: 'commission' })),
    ).rejects.toThrow(/No one is paid commission through a payroll group/);
  });
});

describe('PayrollRunsService.approveMonth', () => {
  it('approves every pending run of the month, each on its own', async () => {
    const { service, prisma, payroll } = build();
    prisma.payrollRun.findMany.mockResolvedValue([
      { id: 'r1', payslipKey: 'monthly' },
      { id: 'r2', payslipKey: 'commission' },
    ]);

    const result = await service.approveMonth(TENANT, ACTOR, {
      month: 10,
      year: 2026,
      note: ' ok ',
    });

    expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT,
          month: 10,
          year: 2026,
          status: 'PENDING_APPROVAL',
          payslipKey: { not: 'legacy' },
        },
      }),
    );
    expect(payroll.approvePayroll).toHaveBeenCalledTimes(2);
    expect(payroll.approvePayroll).toHaveBeenCalledWith(TENANT, 'r1', ACTOR, {
      note: 'ok',
    });
    expect(result.approved.map((r) => r.runId)).toEqual(['r1', 'r2']);
    expect(result.failed).toEqual([]);
  });

  it('reports a run that could not be approved and still approves the others', async () => {
    const { service, prisma, payroll } = build();
    prisma.payrollRun.findMany.mockResolvedValue([
      { id: 'r1', payslipKey: 'monthly' },
      { id: 'r2', payslipKey: 'commission' },
    ]);
    payroll.approvePayroll
      .mockRejectedValueOnce(new Error('Accounting could not be reached'))
      .mockResolvedValueOnce({});

    const result = await service.approveMonth(TENANT, ACTOR, {
      month: 10,
      year: 2026,
    });

    expect(result.approved.map((r) => r.runId)).toEqual(['r2']);
    expect(result.failed).toEqual([
      {
        runId: 'r1',
        payslipType: 'monthly',
        message: 'Accounting could not be reached',
      },
    ]);
    expect(payroll.approvePayroll).toHaveBeenCalledWith(TENANT, 'r1', ACTOR, {
      note: 'Approved',
    });
  });

  it('says so when nothing is waiting', async () => {
    const { service, prisma } = build();
    prisma.payrollRun.findMany.mockResolvedValue([]);
    await expect(
      service.approveMonth(TENANT, ACTOR, { month: 10, year: 2026 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
