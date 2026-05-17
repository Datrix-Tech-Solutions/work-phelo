import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { RequestUser } from '@work-phelo/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACTOR: RequestUser = {
  id: 'user-uuid',
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

const ENCRYPTED_BANK_NAME = 'enc:GhCB';
const ENCRYPTED_ACCOUNT = 'enc:1234567890';
const DECRYPTED_BANK_NAME = 'Ghana Commercial Bank';
const DECRYPTED_ACCOUNT = '1234567890';
const MASKED_ACCOUNT = '****7890';

const PAYROLL_RUN = {
  id: 'run-uuid',
  tenantId: 'tenant-uuid',
  status: 'DRAFT',
  items: [
    {
      id: 'item-uuid',
      allowanceItems: [],
      deductionItems: [],
      employee: {
        firstName: 'Kofi',
        lastName: 'Boateng',
        employeeNumber: 'ACM-001',
        jobTitle: 'Software Engineer',
        bankName: ENCRYPTED_BANK_NAME,
        bankAccountNumber: ENCRYPTED_ACCOUNT,
      },
    },
  ],
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    payrollRun: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn(), findMany: jest.fn() },
    payrollItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    companySetting: { findFirst: jest.fn() },
    payrollAllowanceItem: { createMany: jest.fn() },
    payrollDeductionItem: { createMany: jest.fn() },
  };
}

function makeEncryptionMock() {
  return {
    decrypt: jest.fn((v: string | null | undefined) => {
      if (v === ENCRYPTED_BANK_NAME) return DECRYPTED_BANK_NAME;
      if (v === ENCRYPTED_ACCOUNT) return DECRYPTED_ACCOUNT;
      return v ?? null;
    }),
    mask: jest.fn((v: string | null | undefined): string | null => {
      if (v == null) return null;
      return v.length <= 4 ? '****' : `****${v.slice(-4)}`;
    }),
    encrypt: jest.fn((v: string) => `enc:${v}`),
    encryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    decryptEmployeeFields: jest.fn((obj: Record<string, unknown>) => obj),
    maskListFields: jest.fn((obj: Record<string, unknown>) => obj),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PayrollService', () => {
  let service: PayrollService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let encryption: ReturnType<typeof makeEncryptionMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    encryption = makeEncryptionMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyPayrollApproved: jest.fn() },
        },
        { provide: RabbitMQPublisher, useValue: { emit: jest.fn() } },
        { provide: FieldEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  describe('getPayrollRunById()', () => {
    it('returns masked bankAccountNumber and decrypted bankName', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(PAYROLL_RUN);

      const result = await service.getPayrollRunById(
        'tenant-uuid',
        'run-uuid',
        ACTOR,
      );

      const employee = result.items[0].employee!;
      expect(employee.bankName).toBe(DECRYPTED_BANK_NAME);
      expect(employee.bankAccountNumber).toBe(MASKED_ACCOUNT);
    });

    it('does not expose the full decrypted account number in the response', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(PAYROLL_RUN);

      const result = await service.getPayrollRunById(
        'tenant-uuid',
        'run-uuid',
        ACTOR,
      );

      const employee = result.items[0].employee!;
      expect(employee.bankAccountNumber).not.toBe(DECRYPTED_ACCOUNT);
      expect(employee.bankAccountNumber).toMatch(/^\*{4}/);
    });

    it('passes the decrypted value into mask(), not the ciphertext', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(PAYROLL_RUN);

      await service.getPayrollRunById('tenant-uuid', 'run-uuid', ACTOR);

      expect(encryption.decrypt).toHaveBeenCalledWith(ENCRYPTED_ACCOUNT);
      expect(encryption.mask).toHaveBeenCalledWith(DECRYPTED_ACCOUNT);
    });

    it('throws NotFoundException when run does not belong to tenant', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);

      await expect(
        service.getPayrollRunById('tenant-uuid', 'run-uuid', ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns null bankAccountNumber when employee has no account on file', async () => {
      const runWithNullAccount = {
        ...PAYROLL_RUN,
        items: [
          {
            ...PAYROLL_RUN.items[0],
            employee: {
              ...PAYROLL_RUN.items[0].employee,
              bankAccountNumber: null,
            },
          },
        ],
      };
      prisma.payrollRun.findFirst.mockResolvedValue(runWithNullAccount);

      const result = await service.getPayrollRunById(
        'tenant-uuid',
        'run-uuid',
        ACTOR,
      );

      expect(result.items[0].employee!.bankAccountNumber).toBeNull();
    });
  });
});
