import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PayrollIntegrationService } from './payroll-integration.service';
import {
  PostPayrollAccrualDto,
  PostPayrollRoleAccrualDto,
} from './dto/payroll-integration.dto';

const DTO: PostPayrollAccrualDto = {
  tenantId: 'tenant-1',
  payrollRunId: 'run-1',
  periodLabel: '3/2026',
  transactionDate: '2026-03-31',
  totalGross: 1000,
  totalNet: 800,
  totalPAYE: 100,
  totalTier1: 55,
  totalTier2: 0,
  totalTier3: 0,
  totalEmployerCost: 1130,
  totalOtherDeductions: 0,
};

const MAPPED = {
  salariesWagesExpense: { id: 'a-sal', code: '5121', name: 'Salaries' },
  employerSocialSecurityExpense: { id: 'a-ess', code: '5122', name: 'ESS' },
  netPayPayable: { id: 'a-net', code: '2121', name: 'Net' },
  incomeTaxPayable: { id: 'a-tax', code: '2122', name: 'Tax' },
  socialSecurityPayable: { id: 'a-ss', code: '2123', name: 'SS' },
  statutoryPensionPayable: null,
  otherDeductionsPayable: null,
};

function build(
  options: {
    source?: { id: string; isActive: boolean };
    mapped?: Record<string, unknown>;
    autoPost?: boolean;
    existingEntries?: number;
    journalStatus?: string;
  } = {},
) {
  const prisma = {
    fiscalPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }) },
    sourceLedgerEntry: {
      count: jest.fn().mockResolvedValue(options.existingEntries ?? 0),
    },
  };
  const setup = {
    getSource: jest
      .fn()
      .mockResolvedValue(options.source ?? { id: 'src-1', isActive: true }),
    getMappedAccounts: jest.fn().mockResolvedValue(options.mapped ?? MAPPED),
    autoPostEnabled: jest.fn().mockResolvedValue(options.autoPost ?? false),
  };
  const journals = {
    create: jest.fn().mockResolvedValue({
      id: 'j-1',
      status: options.journalStatus ?? 'DRAFT',
    }),
    post: jest.fn().mockResolvedValue({ id: 'j-1', status: 'POSTED' }),
  };
  const sourceLedger = {
    createEntry: jest.fn().mockResolvedValue({}),
    listBySourceRecord: jest.fn(),
  };
  const hrClient = {
    notifyNetPaySettled: jest.fn().mockResolvedValue({}),
    notifyFullySettled: jest.fn().mockResolvedValue({}),
  };
  const masterData = {
    getConfig: jest.fn().mockResolvedValue({ baseCurrency: 'GHS' }),
  };
  const service = new PayrollIntegrationService(
    prisma as never,
    masterData as never,
    setup as never,
    journals as never,
    sourceLedger as never,
    hrClient as never,
  );
  return { service, prisma, setup, journals, sourceLedger, hrClient };
}

describe('PayrollIntegrationService.postAccrual', () => {
  it('refuses when payroll is not linked', async () => {
    const { service, journals } = build({
      source: { id: 'src-1', isActive: false },
    });

    await expect(
      service.postAccrual('hr-service', 'approver-1', DTO),
    ).rejects.toThrow(ConflictException);
    expect(journals.create).not.toHaveBeenCalled();
  });

  it('names the accounts that are missing for amounts in the run', async () => {
    const { service, journals } = build({
      mapped: { ...MAPPED, netPayPayable: null, incomeTaxPayable: null },
    });

    await expect(
      service.postAccrual('hr-service', 'approver-1', DTO),
    ).rejects.toThrow(/Net Pay Payable, Income Tax Payable/);
    expect(journals.create).not.toHaveBeenCalled();
  });

  it('does not need an account for a function the run has no amount for', async () => {
    const { service, journals } = build();

    await expect(
      service.postAccrual('hr-service', 'approver-1', DTO),
    ).resolves.toBeDefined();
    expect(journals.create).toHaveBeenCalled();
  });

  it('posts to the mapped accounts, on behalf of the approver', async () => {
    const { service, journals } = build();

    await service.postAccrual('hr-service', 'approver-1', DTO);

    const [user, input] = journals.create.mock.calls[0] as [
      RequestUser,
      { lines: { glAccountId: string }[]; idempotencyKey: string },
    ];
    expect(user.id).toBe('approver-1');
    expect(input.idempotencyKey).toBe('payroll-accrual:run-1');
    expect(input.lines.map((l) => l.glAccountId).sort()).toEqual(
      ['a-sal', 'a-ess', 'a-net', 'a-tax', 'a-ss'].sort(),
    );
  });

  it('raises one open item per liability, remembering which function each belongs to', async () => {
    const { service, sourceLedger } = build();

    await service.postAccrual('hr-service', 'approver-1', DTO);

    const created = sourceLedger.createEntry.mock.calls.map(
      ([entry]: [{ sourceRole: string; glAccountId: string }]) => [
        entry.sourceRole,
        entry.glAccountId,
      ],
    );
    expect(created).toEqual([
      ['netPayPayable', 'a-net'],
      ['incomeTaxPayable', 'a-tax'],
      ['socialSecurityPayable', 'a-ss'],
    ]);
  });

  it('does not raise the open items twice for a repeated call', async () => {
    const { service, sourceLedger } = build({ existingEntries: 3 });

    await service.postAccrual('hr-service', 'approver-1', DTO);

    expect(sourceLedger.createEntry).not.toHaveBeenCalled();
  });

  it('leaves the journal as a draft unless Accounting auto-posts', async () => {
    const { service, journals } = build({ autoPost: false });

    await service.postAccrual('hr-service', 'approver-1', DTO);

    expect(journals.post).not.toHaveBeenCalled();
  });

  it('posts the journal straight away when Accounting is set to auto-post', async () => {
    const { service, journals, setup } = build({ autoPost: true });

    await service.postAccrual('hr-service', 'approver-1', DTO);

    expect(setup.autoPostEnabled).toHaveBeenCalledWith('tenant-1');
    expect(journals.post).toHaveBeenCalled();
  });

  it('fails when no fiscal period is open', async () => {
    const { service, prisma } = build();
    prisma.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      service.postAccrual('hr-service', 'approver-1', DTO),
    ).rejects.toThrow(BadRequestException);
  });
});

const ROLE_DTO: PostPayrollRoleAccrualDto = {
  tenantId: 'tenant-1',
  payrollRunId: 'run-2',
  periodLabel: '10/2026',
  transactionDate: '2026-10-31',
  totalGross: 6000,
  totalNet: 4220,
  totalIncomeTax: 1029.75,
  totalEmployeeSocialSecurity: 275,
  totalEmployerSocialSecurity: 650,
  totalPension: 250,
  totalOtherDeductions: 225.25,
};

describe('PayrollIntegrationService.postRoleAccrual', () => {
  const allMapped = {
    ...MAPPED,
    statutoryPensionPayable: { id: 'a-pen', code: '2124', name: 'Pension' },
    otherDeductionsPayable: { id: 'a-oth', code: '2125', name: 'Other' },
  };

  it('posts the totals by role and balances', async () => {
    const { service, journals } = build({ mapped: allMapped });

    await service.postRoleAccrual('hr-service', 'approver-1', ROLE_DTO);

    const { lines } = (journals.create.mock.calls as unknown[][])[0][1] as {
      lines: { glAccountId: string; debit?: number; credit?: number }[];
    };
    const by = (id: string) => lines.find((l) => l.glAccountId === id);
    expect(by('a-sal')?.debit).toBe(6000);
    expect(by('a-ess')?.debit).toBe(650);
    expect(by('a-net')?.credit).toBe(4220);
    expect(by('a-tax')?.credit).toBe(1029.75);
    // Owed to the social security fund: the employees' share plus the employer's.
    expect(by('a-ss')?.credit).toBe(925);
    expect(by('a-pen')?.credit).toBe(250);
    expect(by('a-oth')?.credit).toBe(225.25);

    const debits = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const credits = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
    expect(Math.round(debits * 100)).toBe(Math.round(credits * 100));
  });

  it('needs no account for roles the run has nothing for', async () => {
    // A commission payroll: pay and a flat tax only, so no social security, pension or other accounts.
    const { service, journals } = build({
      mapped: {
        ...MAPPED,
        employerSocialSecurityExpense: null,
        socialSecurityPayable: null,
      },
    });

    await service.postRoleAccrual('hr-service', 'approver-1', {
      ...ROLE_DTO,
      totalGross: 1000,
      totalNet: 900,
      totalIncomeTax: 100,
      totalEmployeeSocialSecurity: 0,
      totalEmployerSocialSecurity: 0,
      totalPension: 0,
      totalOtherDeductions: 0,
    });

    const { lines } = (journals.create.mock.calls as unknown[][])[0][1] as {
      lines: unknown[];
    };
    expect(lines).toHaveLength(3);
  });

  it('names a missing account only for a role that has an amount', async () => {
    const { service, journals } = build({
      mapped: {
        ...MAPPED,
        statutoryPensionPayable: null,
        otherDeductionsPayable: null,
      },
    });

    await expect(
      service.postRoleAccrual('hr-service', 'approver-1', ROLE_DTO),
    ).rejects.toThrow(/Statutory Pension Payable, Other Deductions Payable/);
    expect(journals.create).not.toHaveBeenCalled();
  });

  it('raises one open item per liability, remembering which role each belongs to', async () => {
    const { service, sourceLedger } = build({ mapped: allMapped });

    await service.postRoleAccrual('hr-service', 'approver-1', ROLE_DTO);

    const roles = (sourceLedger.createEntry.mock.calls as unknown[][]).map(
      (call) => (call[0] as { sourceRole: string }).sourceRole,
    );
    expect(roles).toEqual([
      'netPayPayable',
      'incomeTaxPayable',
      'socialSecurityPayable',
      'statutoryPensionPayable',
      'otherDeductionsPayable',
    ]);
  });

  it('refuses when payroll is not linked', async () => {
    const { service } = build({ source: { id: 'src-1', isActive: false } });
    await expect(
      service.postRoleAccrual('hr-service', 'approver-1', ROLE_DTO),
    ).rejects.toThrow(ConflictException);
  });
});

describe('PayrollIntegrationService settlement', () => {
  const entry = (role: string, state: string) => ({
    sourceRole: role,
    paymentState: state,
    amount: 100,
    outstandingAmount: state === 'PAID' ? 0 : 100,
  });

  it('reads each liability by the function recorded on the item, not by the current account', async () => {
    const { service, sourceLedger } = build();
    sourceLedger.listBySourceRecord.mockResolvedValue([
      entry('netPayPayable', 'PAID'),
      entry('incomeTaxPayable', 'OPEN'),
    ]);

    await expect(
      service.getSettlementStatus('tenant-1', 'run-1'),
    ).resolves.toEqual({
      netPay: { paymentState: 'PAID', amount: 100, outstandingAmount: 0 },
      incomeTax: { paymentState: 'OPEN', amount: 100, outstandingAmount: 100 },
      socialSecurity: null,
    });
  });

  it('tells HR to release payslips when the Net Pay item is paid', async () => {
    const { service, sourceLedger, hrClient } = build();
    sourceLedger.listBySourceRecord.mockResolvedValue([
      entry('netPayPayable', 'PAID'),
      entry('incomeTaxPayable', 'OPEN'),
    ]);

    await service.handleSourceLedgerEntrySettled('tenant-1', {
      sourceRecordId: 'run-1',
      sourceRole: 'netPayPayable',
    });

    expect(hrClient.notifyNetPaySettled).toHaveBeenCalledWith(
      'tenant-1',
      'run-1',
    );
    expect(hrClient.notifyFullySettled).not.toHaveBeenCalled();
  });

  it('tells HR the run is fully settled once every item is paid', async () => {
    const { service, sourceLedger, hrClient } = build();
    sourceLedger.listBySourceRecord.mockResolvedValue([
      entry('netPayPayable', 'PAID'),
      entry('incomeTaxPayable', 'PAID'),
    ]);

    await service.handleSourceLedgerEntrySettled('tenant-1', {
      sourceRecordId: 'run-1',
      sourceRole: 'incomeTaxPayable',
    });

    expect(hrClient.notifyNetPaySettled).not.toHaveBeenCalled();
    expect(hrClient.notifyFullySettled).toHaveBeenCalledWith(
      'tenant-1',
      'run-1',
    );
  });

  it('does not let a failed callback undo the payment', async () => {
    const { service, sourceLedger, hrClient } = build();
    sourceLedger.listBySourceRecord.mockResolvedValue([
      entry('netPayPayable', 'PAID'),
    ]);
    hrClient.notifyNetPaySettled.mockRejectedValue(new Error('hr down'));
    hrClient.notifyFullySettled.mockRejectedValue(new Error('hr down'));

    await expect(
      service.handleSourceLedgerEntrySettled('tenant-1', {
        sourceRecordId: 'run-1',
        sourceRole: 'netPayPayable',
      }),
    ).resolves.toBeUndefined();
  });
});
