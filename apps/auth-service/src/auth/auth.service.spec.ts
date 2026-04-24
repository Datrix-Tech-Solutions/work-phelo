import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
}));

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuditService } from '../audit/audit.service';

// ─── Shared test fixtures ──────────────────────────────────────────────────

const TENANT = {
  id: 'tenant-uuid',
  name: 'Acme Ghana Ltd',
  slug: 'acme-ghana',
  status: 'ACTIVE',
};

const USER_BASE = {
  id: 'user-uuid',
  email: 'kofi@acmeghana.com',
  firstName: 'Kofi',
  lastName: 'Boateng',
  role: 'EMPLOYEE',
  tenantId: 'tenant-uuid',
  status: 'ACTIVE',
  isMfaEnabled: false,
  mfaMethod: null,
  mfaSecret: null,
  forcePasswordReset: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  tenant: TENANT,
};

// Pre-hashed password for 'Password123!' — generated once to keep tests fast
// (avoids calling real bcrypt.hash in beforeEach)
const HASHED_PASSWORD =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RmgE8kC3a';

// ─── Mock factories ────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    socialAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
}

function makeJwtMock() {
  return {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };
}

function makeRabbitMock() {
  return { emit: jest.fn().mockResolvedValue(undefined) };
}

function makeAuditMock() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

// ─── Test suite ────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let jwt: ReturnType<typeof makeJwtMock>;
  let rabbitmq: ReturnType<typeof makeRabbitMock>;
  let audit: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    jwt = makeJwtMock();
    rabbitmq = makeRabbitMock();
    audit = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: RabbitMQPublisher, useValue: rabbitmq },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════════════════════

  describe('login()', () => {
    const loginDto = {
      tenantSlug: 'acme-ghana',
      email: 'kofi@acmeghana.com',
      password: 'Password123!',
    };

    // Helper: set up a happy-path login where bcrypt resolves to true
    function setupHappyPath(userOverrides: Partial<typeof USER_BASE> = {}) {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        ...userOverrides,
      });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    }

    // ── Success ────────────────────────────────────────────────────────────

    it('returns user object and tokens on valid credentials', async () => {
      setupHappyPath();

      const result = await service.login(loginDto);

      expect(result).toMatchObject({
        user: {
          id: USER_BASE.id,
          email: USER_BASE.email,
          role: USER_BASE.role,
          tenantId: TENANT.id,
        },
        expiresIn: 900,
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('stores a refresh token in the database on success', async () => {
      setupHappyPath();

      await service.login(loginDto, '127.0.0.1', 'Mozilla/5.0');

      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_BASE.id,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      );
    });

    it('updates lastLoginAt on success', async () => {
      setupHappyPath();

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_BASE.id },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });

    it('clears failedLoginAttempts when user had previous failures', async () => {
      setupHappyPath({ failedLoginAttempts: 2 });

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    // ── Wrong password / lockout ───────────────────────────────────────────

    it('throws UnauthorizedException with countdown on wrong password (attempt 1)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      // First call: get user for login
      prisma.user.findUnique.mockResolvedValueOnce({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        failedLoginAttempts: 0,
      });
      // Second call: inside handleFailedLogin — still at 0 so newAttempts becomes 1
      prisma.user.findUnique.mockResolvedValueOnce({
        ...USER_BASE,
        failedLoginAttempts: 0,
      });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const error = await service.login(loginDto).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toMatch(/remaining/i);
    });

    it('throws ForbiddenException and locks account after 5 failed attempts', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValueOnce({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        failedLoginAttempts: 0,
      });
      // Inside handleFailedLogin — user already at 4 attempts
      prisma.user.findUnique.mockResolvedValueOnce({
        ...USER_BASE,
        failedLoginAttempts: 4,
      });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);

      // Verify lockedUntil was set
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('throws ForbiddenException with minutes-remaining when account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 25 * 60 * 1000); // 25 min from now
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        failedLoginAttempts: 5,
        lockedUntil,
      });

      const error = await service.login(loginDto).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.message).toMatch(/locked/i);
      expect(error.message).toMatch(/minute/i);
    });

    it('allows login once lockedUntil has passed', async () => {
      const expiredLock = new Date(Date.now() - 1000); // already in the past
      setupHappyPath({
        lockedUntil: expiredLock as any,
        failedLoginAttempts: 5,
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
    });

    // ── Tenant / user status checks ────────────────────────────────────────

    it('throws UnauthorizedException when tenant slug does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when tenant is SUSPENDED', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...TENANT,
        status: 'SUSPENDED',
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when tenant is PENDING', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...TENANT,
        status: 'PENDING',
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when user does not exist in tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when user is SUSPENDED', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        status: 'SUSPENDED',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is INACTIVE', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
        status: 'INACTIVE',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    // ── Intermediate states ────────────────────────────────────────────────

    it('returns requiresPasswordReset flag when forcePasswordReset is set', async () => {
      setupHappyPath({ forcePasswordReset: true });

      const result = await service.login(loginDto);

      expect(result).toEqual({
        requiresPasswordReset: true,
        userId: USER_BASE.id,
      });
      // Tokens must NOT be issued in this state
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('returns requiresMfa flag when MFA is enabled', async () => {
      setupHappyPath({ isMfaEnabled: true, mfaMethod: 'TOTP' as any });

      const result = await service.login(loginDto);

      expect(result).toEqual({
        requiresMfa: true,
        mfaMethod: 'TOTP',
        userId: USER_BASE.id,
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // ADMIN LOGIN
  // ════════════════════════════════════════════════════════════════════════

  describe('adminLogin()', () => {
    const SUPER_ADMIN = {
      ...USER_BASE,
      email: 'superadmin@datrix.com',
      role: 'SUPER_ADMIN',
      password: HASHED_PASSWORD,
      tenant: TENANT,
    };

    it('returns tokens for valid SuperAdmin credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(SUPER_ADMIN);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.adminLogin(
        'superadmin@datrix.com',
        'Password123!',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result.user.role).toBe('SUPER_ADMIN');
    });

    it('throws UnauthorizedException for non-existent SuperAdmin', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.adminLogin('wrong@datrix.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(SUPER_ADMIN);
      // Second call inside handleFailedLogin
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        ...SUPER_ADMIN,
        failedLoginAttempts: 0,
      });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.adminLogin('superadmin@datrix.com', 'WrongPass123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // TOKEN REFRESH
  // ════════════════════════════════════════════════════════════════════════

  describe('refresh()', () => {
    const STORED_TOKEN = {
      id: 'rt-uuid',
      userId: USER_BASE.id,
      token: 'valid-refresh-token',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: { ...USER_BASE, tenant: TENANT },
    };

    it('rotates tokens and returns new pair on valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(STORED_TOKEN);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh({
        refreshToken: 'valid-refresh-token',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      // Old token must be revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STORED_TOKEN.id },
          data: { isRevoked: true },
        }),
      );
    });

    it('throws UnauthorizedException for revoked refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...STORED_TOKEN,
        isRevoked: true,
      });

      await expect(
        service.refresh({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...STORED_TOKEN,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      await expect(
        service.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for non-existent refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'ghost-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════════════════════════════════════

  describe('logout()', () => {
    it('revokes the provided refresh token in the database', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
        data: { isRevoked: true },
      });
    });
  });

  describe('logoutAll()', () => {
    it('revokes all active refresh tokens for a user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logoutAll(USER_BASE.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_BASE.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // VERIFY EMAIL
  // ════════════════════════════════════════════════════════════════════════

  describe('verifyEmail()', () => {
    const dto = {
      tenantSlug: 'acme-ghana',
      email: 'kofi@acmeghana.com',
      otp: '123456',
    };

    const VALID_OTP = {
      id: 'otp-uuid',
      userId: USER_BASE.id,
      code: '123456',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    it('verifies email and activates user with valid OTP', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      prisma.otpCode.findFirst.mockResolvedValue(VALID_OTP);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await service.verifyEmail(dto);

      expect(result.message).toMatch(/verified/i);
      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: VALID_OTP.id },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            emailVerifiedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws UnauthorizedException for invalid OTP code', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for already-used OTP', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      // OTP with usedAt set — Prisma where clause filters these out, so mock returns null
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ════════════════════════════════════════════════════════════════════════

  describe('forgotPassword()', () => {
    const dto = {
      email: 'kofi@acmeghana.com',
      tenantSlug: 'acme-ghana',
    };

    it('generates OTP and publishes reset email event for valid user', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({ ...USER_BASE });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      await service.forgotPassword(dto);

      expect(prisma.otpCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PASSWORD_RESET',
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(rabbitmq.emit).toHaveBeenCalledWith(
        'notification.password_reset_link',
        expect.objectContaining({
          email: USER_BASE.email,
          resetLink: expect.stringContaining('/t/acme-ghana/reset-password'),
        }),
      );
    });

    it('reset link contains workspace slug (workspace-aware URL)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({ ...USER_BASE });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      await service.forgotPassword(dto);

      const emitCall = rabbitmq.emit.mock.calls[0];
      expect(emitCall[1].resetLink).toMatch(
        /\/t\/acme-ghana\/reset-password\?token=/,
      );
    });

    it('OTP expires in 15 minutes', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({ ...USER_BASE });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      const before = Date.now();
      await service.forgotPassword(dto);
      const after = Date.now();

      const createCall = prisma.otpCode.create.mock.calls[0][0];
      const expiresAt: Date = createCall.data.expiresAt;
      const diffMinutes = (expiresAt.getTime() - before) / 1000 / 60;

      expect(diffMinutes).toBeGreaterThanOrEqual(14.9);
      expect(diffMinutes).toBeLessThanOrEqual(15.1);
    });

    it('invalidates previous unused OTPs before creating a new one', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({ ...USER_BASE });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.otpCode.create.mockResolvedValue({});

      await service.forgotPassword(dto);

      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: {
          userId: USER_BASE.id,
          type: 'PASSWORD_RESET',
          usedAt: null,
        },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('returns safe message even when tenant does not exist (prevents enumeration)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword(dto);

      expect(result.message).toMatch(/if that email exists/i);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
      expect(rabbitmq.emit).not.toHaveBeenCalled();
    });

    it('returns safe message even when user does not exist (prevents enumeration)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword(dto);

      expect(result.message).toMatch(/if that email exists/i);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('returns safe message when tenant is SUSPENDED (prevents enumeration)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        ...TENANT,
        status: 'SUSPENDED',
      });

      const result = await service.forgotPassword(dto);

      expect(result.message).toMatch(/if that email exists/i);
      expect(rabbitmq.emit).not.toHaveBeenCalled();
    });

    it('publishes SMS OTP event when method is sms and user has phone', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        phone: '+233244000001',
      });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      await service.forgotPassword({
        ...dto,
        method: 'sms',
      });

      expect(rabbitmq.emit).toHaveBeenCalledWith(
        'notification.password_reset_otp',
        expect.objectContaining({ phone: '+233244000001' }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // RESET PASSWORD
  // ════════════════════════════════════════════════════════════════════════

  describe('resetPassword()', () => {
    const dto = {
      tenantSlug: 'acme-ghana',
      email: 'kofi@acmeghana.com',
      token: '654321',
      newPassword: 'NewPassword123!',
    };

    const VALID_OTP_RECORD = {
      id: 'otp-uuid',
      userId: USER_BASE.id,
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    it('resets password, hashes with bcrypt, and revokes all refresh tokens', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      prisma.otpCode.findFirst.mockResolvedValue(VALID_OTP_RECORD);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword(dto);

      expect(result.message).toMatch(/reset successfully/i);

      // Password stored must not be plaintext
      const userUpdateCall = prisma.user.update.mock.calls[0][0];
      expect(userUpdateCall.data.password).not.toBe(dto.newPassword);
      expect(userUpdateCall.data.password).toMatch(/^\$2[ab]\$/); // bcrypt hash

      // All refresh tokens for this user revoked
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_BASE.id },
        data: { isRevoked: true },
      });
    });

    it('invalidates OTP after single use', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      prisma.otpCode.findFirst.mockResolvedValue(VALID_OTP_RECORD);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.resetPassword(dto);

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: VALID_OTP_RECORD.id },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('throws BadRequestException for expired OTP', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      // Prisma where clause filters out expired records, so mock returns null
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for already-used OTP', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when no token or otpCode is provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(TENANT);
      prisma.user.findUnique.mockResolvedValue(USER_BASE);

      await expect(
        service.resetPassword({
          tenantSlug: 'acme-ghana',
          email: 'kofi@acmeghana.com',
          newPassword: 'NewPassword123!',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // FORCE RESET PASSWORD
  // ════════════════════════════════════════════════════════════════════════

  describe('forceResetPassword()', () => {
    const dto = {
      userId: USER_BASE.id,
      newPassword: 'NewPassword123!',
    };

    it('resets password and issues tokens immediately', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        forcePasswordReset: true,
        tenant: TENANT,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.forceResetPassword(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(USER_BASE.id);
    });

    it('clears forcePasswordReset flag after reset', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        forcePasswordReset: true,
        tenant: TENANT,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.forceResetPassword(dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            forcePasswordReset: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('throws BadRequestException if forcePasswordReset flag is not set', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        forcePasswordReset: false,
        tenant: TENANT,
      });

      await expect(service.forceResetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown userId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forceResetPassword(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD (authenticated)
  // ════════════════════════════════════════════════════════════════════════

  describe('changePassword()', () => {
    const dto = {
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    };

    it('changes password when current password is correct', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
      });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.changePassword(USER_BASE.id, dto);

      expect(result.message).toMatch(/changed/i);
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.password).not.toBe(dto.newPassword);
      expect(updateCall.data.password).toMatch(/^\$2[ab]\$/);
    });

    it('throws UnauthorizedException when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...USER_BASE,
        password: HASHED_PASSWORD,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(USER_BASE.id, dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
