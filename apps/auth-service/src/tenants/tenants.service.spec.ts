import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuditService } from '../audit/audit.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const TENANT = {
  id: 'tenant-uuid',
  name: 'Acme Ghana Ltd',
  slug: 'acme-ghana',
  email: 'admin@acmeghana.com',
  phone: '+233302000001',
  country: 'GH',
  industry: 'Manufacturing',
  size: '100-500',
  status: 'PENDING',
  createdAt: new Date('2026-01-01'),
  _count: { users: 1 },
};

const REGISTER_DTO = {
  name: 'Acme Ghana Ltd',
  slug: 'acme-ghana',
  email: 'admin@acmeghana.com',
  firstName: 'Abena',
  lastName: 'Mensah',
  password: 'Admin123!',
  phone: '+233302000001',
  industry: 'Manufacturing',
  size: '100-500',
};

// ─── Mock factories ────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    tenant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    otpCode: {
      create: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
  };
}

// ─── Test suite ────────────────────────────────────────────────────────────

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let rabbitmq: { emit: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    rabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    function setupSuccessfulRegistration() {
      prisma.tenant.findFirst.mockResolvedValue(null); // no conflict
      prisma.tenant.create.mockResolvedValue(TENANT);
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid',
        firstName: 'Abena',
        email: 'admin@acmeghana.com',
      });
      prisma.otpCode.create.mockResolvedValue({});
    }

    it('returns tenantId, tenantSlug, tenantName, workspaceUrl, and userId', async () => {
      setupSuccessfulRegistration();

      const result = await service.register(REGISTER_DTO);

      expect(result).toMatchObject({
        tenantId: TENANT.id,
        tenantSlug: TENANT.slug,
        tenantName: TENANT.name,
        userId: 'user-uuid',
      });
      expect(result).toHaveProperty('workspaceUrl');
      expect(result).toHaveProperty('message');
    });

    it('workspaceUrl contains the tenant slug', async () => {
      setupSuccessfulRegistration();

      const result = await service.register(REGISTER_DTO);

      expect(result.workspaceUrl).toContain('/t/acme-ghana/login');
    });

    it('creates tenant with PENDING status', async () => {
      setupSuccessfulRegistration();

      await service.register(REGISTER_DTO);

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('hashes the admin password before storing', async () => {
      setupSuccessfulRegistration();

      await service.register(REGISTER_DTO);

      const userCreateCall = prisma.user.create.mock.calls[0][0];
      expect(userCreateCall.data.password).not.toBe(REGISTER_DTO.password);
      expect(userCreateCall.data.password).toMatch(/^\$2[ab]\$/); // bcrypt hash
    });

    it('creates admin user with TENANT_ADMIN role and PENDING_VERIFICATION status', async () => {
      setupSuccessfulRegistration();

      await service.register(REGISTER_DTO);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'TENANT_ADMIN',
            status: 'PENDING_VERIFICATION',
            tenantId: TENANT.id,
          }),
        }),
      );
    });

    it('creates OTP verification code for the admin user', async () => {
      setupSuccessfulRegistration();

      await service.register(REGISTER_DTO);

      expect(prisma.otpCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EMAIL_VERIFICATION',
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('publishes email verification event to RabbitMQ', async () => {
      setupSuccessfulRegistration();

      await service.register(REGISTER_DTO);

      expect(rabbitmq.emit).toHaveBeenCalledWith(
        'notification.email_verification',
        expect.objectContaining({
          email: REGISTER_DTO.email,
          firstName: REGISTER_DTO.firstName,
          tenantName: TENANT.name,
        }),
      );
    });

    it('throws ConflictException when slug is already taken', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        ...TENANT,
        email: 'other@company.com',
      });

      await expect(service.register(REGISTER_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email is already registered', async () => {
      prisma.tenant.findFirst.mockResolvedValue({
        ...TENANT,
        slug: 'different-slug',
      });

      await expect(service.register(REGISTER_DTO)).rejects.toThrow(
        ConflictException,
      );
    });

    it('conflict error message distinguishes slug vs email collision', async () => {
      // Email collision
      prisma.tenant.findFirst.mockResolvedValue({
        ...TENANT,
        email: REGISTER_DTO.email,
        slug: 'different-slug',
      });
      const emailError = await service.register(REGISTER_DTO).catch((e) => e);
      expect(emailError.message).toMatch(/email/i);

      // Slug collision
      prisma.tenant.findFirst.mockResolvedValue({
        ...TENANT,
        slug: REGISTER_DTO.slug,
        email: 'other@other.com',
      });
      const slugError = await service.register(REGISTER_DTO).catch((e) => e);
      expect(slugError.message).toMatch(/slug/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FIND ALL (SuperAdmin list)
  // ════════════════════════════════════════════════════════════════════════

  describe('findAll()', () => {
    it('returns all tenants with total count for SuperAdmin', async () => {
      prisma.tenant.findMany.mockResolvedValue([
        TENANT,
        { ...TENANT, id: 'tenant-2' },
      ]);

      const result = await service.findAll({});

      expect(result.total).toBe(2);
      expect(result.tenants).toHaveLength(2);
    });

    it('filters by status when provided', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT]);

      await service.findAll({ status: 'PENDING' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('scopes to single tenant when tenantId is provided (Tenant Admin)', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT]);

      await service.findAll({ tenantId: 'tenant-uuid' });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'tenant-uuid' }),
        }),
      );
    });

    it('returns tenant shape with required fields', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT]);

      const result = await service.findAll({});

      const t = result.tenants[0];
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('slug');
      expect(t).toHaveProperty('status');
      expect(t).toHaveProperty('createdAt');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FIND BY ID
  // ════════════════════════════════════════════════════════════════════════

  describe('findById()', () => {
    it('returns tenant when found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);

      const result = await service.findById('tenant-uuid');

      expect(result.id).toBe('tenant-uuid');
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findById('ghost-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // APPROVE TENANT
  // ════════════════════════════════════════════════════════════════════════

  describe('approveTenant()', () => {
    it('sets tenant status to ACTIVE', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.update.mockResolvedValue({ ...TENANT, status: 'ACTIVE' });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      await service.approveTenant('tenant-uuid');

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-uuid' },
        data: { status: 'ACTIVE' },
      });
    });

    it('activates TENANT_ADMIN users and sets emailVerifiedAt', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.update.mockResolvedValue({ ...TENANT, status: 'ACTIVE' });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      await service.approveTenant('tenant-uuid');

      expect(prisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-uuid', role: 'TENANT_ADMIN' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            emailVerifiedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundException for unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.approveTenant('ghost-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // SUSPEND TENANT
  // ════════════════════════════════════════════════════════════════════════

  describe('suspendTenant()', () => {
    it('sets tenant status to SUSPENDED', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.update.mockResolvedValue({
        ...TENANT,
        status: 'SUSPENDED',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'user-uuid' }]);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.suspendTenant('tenant-uuid');

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-uuid' },
        data: { status: 'SUSPENDED' },
      });
    });

    it('revokes all active sessions for all users in the tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.tenant.update.mockResolvedValue({
        ...TENANT,
        status: 'SUSPENDED',
      });
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.suspendTenant('tenant-uuid');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
        data: { isRevoked: true },
      });
    });

    it('throws NotFoundException for unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.suspendTenant('ghost-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
