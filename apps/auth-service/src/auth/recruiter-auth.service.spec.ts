import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import type { CanActivate } from '@nestjs/common';
import type { JwtPayload } from '@work-phelo/types';
import type { Prisma } from '../../prisma/generated/client';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RecruiterAuthService } from './recruiter-auth.service';
import { isResourceEnabledForTenant } from '../permissions/permission-entitlements';
import * as permissionSets from '../permissions/system-permission-sets';

jest.mock('../permissions/system-permission-sets', () => ({
  ensurePermissionResources: jest.fn().mockResolvedValue({}),
  seedDefaultPermissionTemplates: jest.fn().mockResolvedValue({}),
  seedRecruiterPermissionSet: jest.fn().mockResolvedValue('recruiter-set'),
}));

const dto = {
  companyName: 'Acme Ghana Ltd',
  name: 'Abena Mensah',
  email: 'Abena@Acme.test',
  password: 'Password123!',
};

function setup() {
  const tx = {
    tenant: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'tenant-1', name: 'Acme Ghana Ltd' }),
    },
    user: {
      create: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'abena@acme.test',
        firstName: 'Abena',
      }),
    },
    userPermissionSet: { create: jest.fn() },
  };
  const prisma = {
    resource: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const rabbitmq = {
    notificationInviteUser: jest.fn().mockResolvedValue(undefined),
    hrRecruitmentEmployerUpdated: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  };
  const service = new RecruiterAuthService(
    prisma as never,
    rabbitmq as never,
    audit as never,
    authService as never,
  );
  return { service, prisma, tx, rabbitmq, authService, audit };
}

describe('RecruiterAuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('creates an unverified website tenant limited to the recruiter permission set and emails a confirmation link', async () => {
      const { service, tx, rabbitmq } = setup();

      const response = await service.register(dto);

      expect(tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Ghana Ltd',
            slug: 'acme-ghana-ltd',
            email: 'abena@acme.test',
            status: 'ACTIVE',
            source: 'WEBSITE',
            isVerified: false,
            moduleConfig: { hr: true, accounting: false, marketing: false },
            featureConfig: {
              hr: {
                leave: false,
                time: false,
                payroll: false,
                appraisals: false,
                projects: false,
                assets: false,
                recruitment: true,
              },
              marketing: {
                campaign: false,
                'sales-crm': false,
                transport: false,
              },
            },
          }),
        }),
      );
      const userData = tx.user.create.mock.calls[0][0].data;
      expect(userData).toEqual(
        expect.objectContaining({
          role: 'EMPLOYEE',
          status: 'PENDING_VERIFICATION',
          firstName: 'Abena',
          lastName: 'Mensah',
        }),
      );
      expect(userData.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, userData.password)).toBe(true);
      expect(permissionSets.seedRecruiterPermissionSet).toHaveBeenCalled();
      expect(tx.userPermissionSet.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          permissionSetId: 'recruiter-set',
          grantedBy: 'user-1',
        },
      });
      expect(rabbitmq.notificationInviteUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'abena@acme.test',
          inviteKind: 'RECRUITER',
          acceptInviteUrl: expect.stringContaining(
            `/auth/recruiter/confirm?token=${userData.inviteToken}`,
          ),
        }),
      );
      expect(rabbitmq.hrRecruitmentEmployerUpdated).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        isVerified: false,
        isBlocked: false,
      });
      expect(response).toEqual({
        status: 'PENDING_VERIFICATION',
        message:
          'Registration received. Check your email to confirm your account.',
      });
    });

    it('keeps a country name in the address and falls back to the default code', async () => {
      const { service, tx } = setup();

      await service.register({
        ...dto,
        country: 'Ghana',
        address: '12 Independence Ave',
      });

      expect(tx.tenant.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          country: 'GH',
          address: '12 Independence Ave, Ghana',
        }),
      );
    });

    it('adds a suffix when the generated slug is already taken', async () => {
      const { service, prisma, tx } = setup();
      prisma.tenant.findUnique.mockResolvedValueOnce({ id: 'other' });

      await service.register(dto);

      const slug = tx.tenant.create.mock.calls[0][0].data.slug;
      expect(slug).toMatch(/^acme-ghana-ltd-[0-9a-f]{4}$/);
    });

    it('refuses an email that already has a company', async () => {
      const { service, prisma } = setup();
      prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-9' });

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  it('preserves recruitment access through registration, confirmation and current-state authentication', async () => {
    const { prisma, tx, rabbitmq, audit } = setup();
    let tenant: Prisma.TenantCreateInput & { id: string };
    let user: Prisma.UserUncheckedCreateInput & { id: string };
    tx.tenant.create.mockImplementation(
      ({ data }: { data: Prisma.TenantCreateInput }) => {
        tenant = { ...data, id: 'tenant-1' };
        return Promise.resolve(tenant);
      },
    );
    tx.user.create.mockImplementation(
      ({ data }: { data: Prisma.UserUncheckedCreateInput }) => {
        user = { ...data, id: 'user-1' };
        return Promise.resolve(user);
      },
    );
    prisma.user.findUnique.mockImplementation(() =>
      Promise.resolve({ ...user, tenant }),
    );
    prisma.user.update.mockImplementation(
      ({ data }: { data: Partial<typeof user> }) => {
        Object.assign(user, data);
        return Promise.resolve(user);
      },
    );
    const database = {
      ...prisma,
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermissionSet: {
        findMany: jest.fn().mockImplementation(() => {
          expect(tx.userPermissionSet.create).toHaveBeenCalledWith({
            data: {
              userId: user.id,
              permissionSetId: 'recruiter-set',
              grantedBy: user.id,
            },
          });
          return Promise.resolve([
            {
              permissionSet: {
                resources: [
                  {
                    resource: { name: 'recruitment.vacancies' },
                    action: 'VIEW',
                  },
                ],
              },
            },
          ]);
        }),
      },
      refreshToken: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const secret = 'recruiter-lifecycle-test-secret';
    const jwt = new JwtService({ secret });
    const auth = new AuthService(
      database as never,
      jwt,
      rabbitmq as never,
      audit as never,
    );
    const recruiter = new RecruiterAuthService(
      database as never,
      rabbitmq as never,
      audit as never,
      auth,
    );
    const strategy = new JwtStrategy(
      database as never,
      new ConfigService({ JWT_SECRET: secret }),
    );

    await recruiter.register(dto);
    expect(tenant!.source).toBe('WEBSITE');
    expect(user!.status).toBe('PENDING_VERIFICATION');
    expect(permissionSets.seedRecruiterPermissionSet).toHaveBeenCalled();
    await expect(
      strategy.validate({ sub: 'user-1', tenantId: 'tenant-1' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await recruiter.confirmEmail(user!.inviteToken!);
    expect(user!.status).toBe('ACTIVE');
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);
    prisma.tenant.findFirst.mockResolvedValue(tenant!);
    prisma.tenant.findUnique.mockResolvedValue(tenant!);
    prisma.user.findFirst.mockImplementation(() => Promise.resolve(user));
    const session = await recruiter.login({
      email: dto.email,
      password: dto.password,
    });
    const payload = jwt.verify<JwtPayload>(session.accessToken!);
    expect(payload).toMatchObject({ scope: 'careers' });
    const current = await strategy.validate(payload);
    expect(current.moduleConfig).toEqual({
      hr: true,
      accounting: false,
      marketing: false,
    });
    expect(current.featureConfig.hr).toEqual({
      leave: false,
      time: false,
      payroll: false,
      appraisals: false,
      projects: false,
      assets: false,
      recruitment: true,
    });
    expect(current.featureConfig.marketing).toEqual({
      campaign: false,
      'sales-crm': false,
      transport: false,
    });
    expect(current.permissions).toContain('recruitment.vacancies:VIEW');
    expect(
      isResourceEnabledForTenant(
        { name: 'recruitment.vacancies', module: 'HR' },
        current,
      ),
    ).toBe(true);

    // Exercise HR's unchanged gate without starting a server or weakening its metadata.
    const { FeatureGuard } = jest.requireActual<{
      FeatureGuard: new (reflector: Reflector) => CanActivate;
    }>('../../../hr-service/src/auth/guards/feature.guard');
    const guard = new FeatureGuard({
      getAllAndOverride: () => ({ module: 'hr', feature: 'recruitment' }),
    } as unknown as Reflector);
    const context = new ExecutionContextHost([{ user: current }]);
    expect(guard.canActivate(context)).toBe(true);
    expect(() =>
      guard.canActivate(
        new ExecutionContextHost([
          {
            user: {
              ...current,
              featureConfig: { hr: { recruitment: false } },
            },
          },
        ]),
      ),
    ).toThrow(ForbiddenException);
  });

  describe('confirmEmail', () => {
    it('activates the account and clears the token', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        inviteExpiresAt: new Date(Date.now() + 60_000),
        tenant: { source: 'WEBSITE' },
      });

      await service.confirmEmail('token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          emailVerifiedAt: expect.any(Date),
          inviteToken: null,
          inviteExpiresAt: null,
        }),
      });
    });

    it.each([
      ['unknown token', null],
      [
        'expired token',
        {
          id: 'user-1',
          inviteExpiresAt: new Date(Date.now() - 1000),
          tenant: { source: 'WEBSITE' },
        },
      ],
      [
        'a token from a normal workspace invite',
        {
          id: 'user-1',
          inviteExpiresAt: new Date(Date.now() + 60_000),
          tenant: { source: 'PLATFORM' },
        },
      ],
    ])('rejects %s', async (_label, user) => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.confirmEmail('token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resendConfirmation', () => {
    it('issues a new link only for an unconfirmed website recruiter', async () => {
      const { service, prisma, rabbitmq } = setup();
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme',
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'abena@acme.test',
        firstName: 'Abena',
      });

      const response = await service.resendConfirmation('ABENA@acme.test');

      expect(prisma.user.update).toHaveBeenCalled();
      expect(rabbitmq.notificationInviteUser).toHaveBeenCalledWith(
        expect.objectContaining({ inviteKind: 'RECRUITER', isResend: true }),
      );
      expect(response.message).toContain('If that email');
    });

    it('answers the same way when nothing matches', async () => {
      const { service, rabbitmq } = setup();

      const response = await service.resendConfirmation('nobody@acme.test');

      expect(rabbitmq.notificationInviteUser).not.toHaveBeenCalled();
      expect(response.message).toContain('If that email');
    });
  });

  describe('login', () => {
    const login = { email: 'Abena@Acme.test', password: 'Password123!' };

    it('signs in through the normal login using the tenant found from the email', async () => {
      const { service, prisma, authService } = setup();
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme-ghana-ltd',
        status: 'ACTIVE',
      });
      prisma.user.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        password: await bcrypt.hash(login.password, 4),
      });

      await service.login(login, '1.2.3.4', 'agent');

      expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { source: 'WEBSITE', email: 'abena@acme.test' },
        }),
      );
      expect(authService.login).toHaveBeenCalledWith(
        {
          email: 'abena@acme.test',
          password: login.password,
          tenantSlug: 'acme-ghana-ltd',
        },
        '1.2.3.4',
        'agent',
        'careers',
      );
    });

    it('does not reveal whether an email has a website account', async () => {
      const { service, authService } = setup();

      await expect(service.login(login)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('blocks a suspended recruiter', async () => {
      const { service, prisma, authService } = setup();
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        status: 'SUSPENDED',
      });

      await expect(service.login(login)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('asks an unconfirmed recruiter with the right password to confirm first', async () => {
      const { service, prisma, authService } = setup();
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        status: 'ACTIVE',
      });
      prisma.user.findFirst.mockResolvedValue({
        status: 'PENDING_VERIFICATION',
        password: await bcrypt.hash(login.password, 4),
      });

      await expect(service.login(login)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('treats a wrong password on an unconfirmed account as invalid credentials', async () => {
      const { service, prisma, authService } = setup();
      prisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        status: 'ACTIVE',
      });
      prisma.user.findFirst.mockResolvedValue({
        status: 'PENDING_VERIFICATION',
        password: await bcrypt.hash('another-password', 4),
      });
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(service.login(login)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    describe('company admins of normal companies', () => {
      const admin = async (slug: string, password = login.password) => ({
        email: 'abena@acme.test',
        password: await bcrypt.hash(password, 4),
        tenant: { slug, isVerified: true },
      });

      it('signs in the only matching admin with a careers-site token and reports the company as verified', async () => {
        const { service, prisma, authService } = setup();
        prisma.user.findMany.mockResolvedValue([await admin('acme')]);

        const result = await service.login(login, '1.2.3.4', 'agent');

        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              role: 'TENANT_ADMIN',
              status: 'ACTIVE',
              tenant: { source: 'PLATFORM', status: 'ACTIVE' },
            }),
          }),
        );
        expect(authService.login).toHaveBeenCalledWith(
          {
            email: 'abena@acme.test',
            password: login.password,
            tenantSlug: 'acme',
          },
          '1.2.3.4',
          'agent',
          'careers',
        );
        expect(result).toMatchObject({ accessToken: 'a', isVerified: true });
      });

      it('uses the password to pick between companies the same admin manages', async () => {
        const { service, prisma, authService } = setup();
        prisma.user.findMany.mockResolvedValue([
          await admin('first', 'another-password'),
          await admin('second'),
        ]);

        await service.login(login);

        expect(authService.login).toHaveBeenCalledWith(
          expect.objectContaining({ tenantSlug: 'second' }),
          undefined,
          undefined,
          'careers',
        );
      });

      it('sends the admin to the app when the password fits several companies', async () => {
        const { service, prisma, authService } = setup();
        prisma.user.findMany.mockResolvedValue([
          await admin('first'),
          await admin('second'),
        ]);

        await expect(service.login(login)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(authService.login).not.toHaveBeenCalled();
      });

      it('rejects a wrong password for an admin who manages several companies', async () => {
        const { service, prisma } = setup();
        prisma.user.findMany.mockResolvedValue([
          await admin('first', 'x-password'),
          await admin('second', 'y-password'),
        ]);

        await expect(service.login(login)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });

      it.each([
        ['two-factor', { requiresMfa: true, userId: 'user-1' }],
        [
          'a forced password reset',
          { requiresPasswordReset: true, userId: 'user-1' },
        ],
      ])(
        'asks the admin to finish setup in the app when %s is required',
        async (_label, result) => {
          const { service, prisma, authService } = setup();
          prisma.user.findMany.mockResolvedValue([await admin('acme')]);
          authService.login.mockResolvedValue(result);

          await expect(service.login(login)).rejects.toBeInstanceOf(
            ForbiddenException,
          );
        },
      );
    });
  });
});
