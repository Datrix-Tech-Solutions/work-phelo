import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import {
  normalizeTenantDomain,
  TenantDomainsService,
} from './tenant-domains.service';
import { TxtResolver } from './dns-txt-resolver';

const TENANT = 'tenant-1';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;

const domain = (overrides: Record<string, unknown> = {}) => ({
  id: 'domain-1',
  tenantId: TENANT,
  domain: 'example.com',
  normalizedDomain: 'example.com',
  ownershipStatus: 'UNVERIFIED',
  verificationToken: 'token-1',
  verifiedAt: null,
  lastCheckedAt: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-10-08T00:00:00.000Z'),
  updatedAt: new Date('2026-10-08T00:00:00.000Z'),
  ...overrides,
});

function firstMockArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0]?.[0] as T;
}

describe('TenantDomainsService', () => {
  const prisma = {
    tenantDomain: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    marketingSmsSenderIdentity: { count: jest.fn() },
  };
  const resolver: jest.Mocked<TxtResolver> = {
    resolveTxt: jest.fn(),
  };
  const service = new TenantDomainsService(prisma as never, resolver as never);

  beforeEach(() => jest.resetAllMocks());

  it.each([
    ['Example.COM.', 'example.com'],
    ['bücher.example', 'xn--bcher-kva.example'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeTenantDomain(input)).toBe(expected);
  });

  it.each([
    'https://example.com',
    'example.com/path',
    'example.com?x=1',
    'example.com:443',
    'localhost',
    '127.0.0.1',
    '*.example.com',
  ])('rejects invalid domain %s', (input) => {
    expect(() => normalizeTenantDomain(input)).toThrow(BadRequestException);
  });

  it('creates a tenant domain with a generated DNS challenge', async () => {
    prisma.tenantDomain.create.mockResolvedValue(domain());

    const result = await service.create(user, { domain: 'Example.COM.' });

    const createArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.tenantDomain.create);
    expect(createArg.data.tenantId).toBe(TENANT);
    expect(createArg.data.domain).toBe('example.com');
    expect(createArg.data.normalizedDomain).toBe('example.com');
    expect(createArg.data.createdBy).toBe('user-1');
    expect(typeof createArg.data.verificationToken).toBe('string');
    expect(result.verificationRecord).toEqual({
      type: 'TXT',
      host: '_workphelo-verification.example.com',
      value: 'workphelo-verification=token-1',
    });
  });

  it('rejects duplicate domains across tenants', async () => {
    prisma.tenantDomain.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(user, { domain: 'example.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('scopes detail lookup to the authenticated tenant', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(null);

    await expect(service.findOne(TENANT, 'domain-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.tenantDomain.findFirst).toHaveBeenCalledWith({
      where: { id: 'domain-2', tenantId: TENANT },
    });
  });

  it('verifies a matching TXT token across multiple and chunked records', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(domain());
    resolver.resolveTxt.mockResolvedValue([
      ['unrelated=value'],
      ['workphelo-verification=', 'token-1'],
    ]);
    prisma.tenantDomain.update.mockResolvedValue(
      domain({
        ownershipStatus: 'VERIFIED',
        verifiedAt: new Date('2026-10-08T10:00:00.000Z'),
        lastCheckedAt: new Date('2026-10-08T10:00:00.000Z'),
      }),
    );

    const result = await service.verify(user, 'domain-1');

    expect(resolver.resolveTxt.mock.calls[0]?.[0]).toBe(
      '_workphelo-verification.example.com',
    );
    const updateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.tenantDomain.update);
    expect(updateArg).toMatchObject({ where: { id: 'domain-1' } });
    expect(updateArg.data.ownershipStatus).toBe('VERIFIED');
    expect(updateArg.data.lastCheckedAt).toBeInstanceOf(Date);
    expect(updateArg.data.verifiedAt).toBeInstanceOf(Date);
    expect(result.verified).toBe(true);
  });

  it('keeps the domain unverified when TXT is wrong', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(domain());
    resolver.resolveTxt.mockResolvedValue([['workphelo-verification=wrong']]);
    prisma.tenantDomain.update.mockResolvedValue(
      domain({ lastCheckedAt: new Date('2026-10-08T10:00:00.000Z') }),
    );

    const result = await service.verify(user, 'domain-1');

    expect(prisma.tenantDomain.update).toHaveBeenCalledWith({
      where: { id: 'domain-1' },
      data: { lastCheckedAt: expect.any(Date) as Date },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('not found');
  });

  it('handles NXDOMAIN without marking verified', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(domain());
    resolver.resolveTxt.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'ENOTFOUND' }),
    );
    prisma.tenantDomain.update.mockResolvedValue(
      domain({ lastCheckedAt: new Date('2026-10-08T10:00:00.000Z') }),
    );

    const result = await service.verify(user, 'domain-1');

    expect(result.verified).toBe(false);
    expect(result.reason).toContain('not found');
  });

  it('regenerates an unverified token and resets check state', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(domain());
    prisma.tenantDomain.update.mockResolvedValue(
      domain({ verificationToken: 'token-2' }),
    );

    const result = await service.regenerateVerification(user, 'domain-1');

    const updateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.tenantDomain.update);
    expect(updateArg).toMatchObject({ where: { id: 'domain-1' } });
    expect(updateArg.data.ownershipStatus).toBe('UNVERIFIED');
    expect(updateArg.data.verifiedAt).toBeNull();
    expect(updateArg.data.lastCheckedAt).toBeNull();
    expect(typeof updateArg.data.verificationToken).toBe('string');
    expect(result.verificationRecord.value).toBe(
      'workphelo-verification=token-2',
    );
  });

  it('does not regenerate verified domain challenges', async () => {
    prisma.tenantDomain.findFirst.mockResolvedValue(
      domain({ ownershipStatus: 'VERIFIED' }),
    );

    await expect(
      service.regenerateVerification(user, 'domain-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
