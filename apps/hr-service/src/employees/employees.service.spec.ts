import { RequestUser } from '@work-phelo/types';
import { PayrollTaxPolicy } from '../../prisma/generated/client';
import { EmployeesService } from './employees.service';

const ACTOR: RequestUser = {
  id: 'admin-user-id',
  email: 'admin@acmeghana.com',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-uuid',
  tenantSlug: 'acme-ghana',
  tenantName: 'Acme Ghana Ltd',
  firstName: 'Admin',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
};

function makePrismaMock() {
  return {
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    branch: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    appraisal: { updateMany: jest.fn() },
  };
}

function makeEncryptionMock() {
  return {
    encryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    decryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    hmac: jest.fn((value: string) => `hmac:${value}`),
    encrypt: jest.fn((value: string | undefined) => value ?? null),
  };
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let encryption: ReturnType<typeof makeEncryptionMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    encryption = makeEncryptionMock();

    service = new EmployeesService(
      prisma as never,
      {} as never,
      { ensurePublicHolidaysSeededForEmployee: jest.fn() } as never,
      {} as never,
      encryption as never,
      {} as never,
    );
  });

  it('clears employee fixedTaxAmount when tax policy changes away from FIXED_AMOUNT', async () => {
    const existing = {
      id: 'employee-uuid',
      tenantId: 'tenant-uuid',
      hireDate: new Date('2026-01-01'),
      probationEndsAt: null,
      contractEndDate: null,
      employmentStatus: 'ACTIVE',
      taxPolicy: PayrollTaxPolicy.FIXED_AMOUNT,
      fixedTaxAmount: '150',
    };

    prisma.employee.findFirst.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({
      ...existing,
      taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
      fixedTaxAmount: null,
    });

    await service.update(
      'tenant-uuid',
      'employee-uuid',
      { taxPolicy: PayrollTaxPolicy.STANDARD_PAYE },
      ACTOR,
    );

    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-uuid' },
        data: expect.objectContaining({
          taxPolicy: PayrollTaxPolicy.STANDARD_PAYE,
          fixedTaxAmount: null,
        }),
      }),
    );
  });
});
