import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { randomBytes, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { domainToASCII } from 'url';
import { Prisma, TenantDomain } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTenantDomainDto,
  QueryTenantDomainsDto,
} from './dto/tenant-domain.dto';
import { DnsTxtResolver } from './dns-txt-resolver';

const NOT_FOUND_MESSAGE = 'Business domain not found';
const DUPLICATE_MESSAGE = 'This business domain is already registered';
const TXT_PREFIX = 'workphelo-verification=';
const TXT_HOST_PREFIX = '_workphelo-verification';

export function normalizeTenantDomain(input: string): string {
  const value = input.trim().toLowerCase().replace(/\.+$/, '');
  if (!value) throw new BadRequestException('Domain is required');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new BadRequestException('Enter a domain name without protocol');
  }
  if (/[/?#]/.test(value)) {
    throw new BadRequestException(
      'Enter a domain name without path, query or fragment',
    );
  }
  if (value.includes(':')) {
    throw new BadRequestException('Enter a domain name without port');
  }
  if (value === 'localhost' || value.endsWith('.localhost')) {
    throw new BadRequestException('Localhost domains are not allowed');
  }
  if (value.startsWith('*.') || value.includes('*')) {
    throw new BadRequestException('Wildcard domains are not supported');
  }
  if (isIP(value))
    throw new BadRequestException('IP addresses are not allowed');

  const ascii = domainToASCII(value);
  if (!ascii) throw new BadRequestException('Domain is invalid');
  if (ascii.length > 253) throw new BadRequestException('Domain is too long');

  const labels = ascii.split('.');
  if (labels.length < 2)
    throw new BadRequestException('Domain must include a suffix');
  for (const label of labels) {
    if (!label || label.length > 63)
      throw new BadRequestException('Domain label is invalid');
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) {
      throw new BadRequestException('Domain label is invalid');
    }
  }

  return ascii;
}

function generateVerificationToken() {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class TenantDomainsService {
  private readonly logger = new Logger(TenantDomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly txtResolver: DnsTxtResolver,
  ) {}

  async list(tenantId: string, query: QueryTenantDomainsDto = {}) {
    const where: Prisma.TenantDomainWhereInput = {
      tenantId,
      ...(query.ownershipStatus
        ? { ownershipStatus: query.ownershipStatus }
        : {}),
    };
    const items = await this.prisma.tenantDomain.findMany({
      where,
      orderBy: [{ ownershipStatus: 'asc' }, { domain: 'asc' }, { id: 'asc' }],
    });
    return { items: items.map((item) => this.toResponse(item)) };
  }

  async create(user: RequestUser, dto: CreateTenantDomainDto) {
    const normalizedDomain = normalizeTenantDomain(dto.domain);
    const token = generateVerificationToken();
    try {
      const item = await this.prisma.tenantDomain.create({
        data: {
          tenantId: user.tenantId,
          domain: normalizedDomain,
          normalizedDomain,
          verificationToken: token,
          createdBy: user.id,
        },
      });
      this.audit(
        'registered',
        user.tenantId,
        item.id,
        item.normalizedDomain,
        user.id,
      );
      return this.toResponse(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async findOne(tenantId: string, id: string) {
    return this.toResponse(await this.findOwned(tenantId, id));
  }

  async verify(user: RequestUser, id: string) {
    const item = await this.findOwned(user.tenantId, id);
    const checkedAt = new Date();
    let verified = false;
    let reason: string | undefined;

    try {
      const records = await this.resolveTxtWithTimeout(
        this.challengeHost(item),
      );
      verified = records.some((chunks) =>
        this.safeEqual(chunks.join(''), this.challengeValue(item)),
      );
      if (!verified) reason = 'Verification TXT record was not found yet';
    } catch (error) {
      reason = this.dnsErrorReason(error);
    }

    const updated = await this.prisma.tenantDomain.update({
      where: { id: item.id },
      data: {
        lastCheckedAt: checkedAt,
        ...(verified
          ? {
              ownershipStatus: 'VERIFIED',
              verifiedAt: item.verifiedAt ?? checkedAt,
            }
          : {}),
      },
    });

    this.audit(
      verified ? 'verified' : 'verification_attempted',
      user.tenantId,
      item.id,
      item.normalizedDomain,
      user.id,
      reason,
    );

    return {
      ...this.toResponse(updated),
      verified,
      ...(reason ? { reason } : {}),
    };
  }

  async regenerateVerification(user: RequestUser, id: string) {
    const item = await this.findOwned(user.tenantId, id);
    if (item.ownershipStatus === 'VERIFIED') {
      throw new BadRequestException(
        'Verified domains cannot regenerate verification challenges',
      );
    }
    const updated = await this.prisma.tenantDomain.update({
      where: { id: item.id },
      data: {
        verificationToken: generateVerificationToken(),
        ownershipStatus: 'UNVERIFIED',
        verifiedAt: null,
        lastCheckedAt: null,
      },
    });
    this.audit(
      'verification_regenerated',
      user.tenantId,
      item.id,
      item.normalizedDomain,
      user.id,
    );
    return this.toResponse(updated);
  }

  async archive(user: RequestUser, id: string) {
    const item = await this.findOwned(user.tenantId, id);
    const linkedSenderCount =
      await this.prisma.marketingSmsSenderIdentity.count({
        where: { tenantId: user.tenantId, tenantDomainId: id },
      });
    if (linkedSenderCount > 0) {
      throw new ConflictException(
        'Business domain is linked to SMS sender identities',
      );
    }
    await this.prisma.tenantDomain.delete({ where: { id } });
    this.audit(
      'deleted',
      user.tenantId,
      item.id,
      item.normalizedDomain,
      user.id,
    );
    return { id };
  }

  private async findOwned(tenantId: string, id: string) {
    const item = await this.prisma.tenantDomain.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return item;
  }

  private challengeHost(item: Pick<TenantDomain, 'normalizedDomain'>) {
    return `${TXT_HOST_PREFIX}.${item.normalizedDomain}`;
  }

  private challengeValue(item: Pick<TenantDomain, 'verificationToken'>) {
    return `${TXT_PREFIX}${item.verificationToken}`;
  }

  private toResponse(item: TenantDomain) {
    return {
      id: item.id,
      domain: item.domain,
      normalizedDomain: item.normalizedDomain,
      ownershipStatus: item.ownershipStatus,
      verificationRecord: {
        type: 'TXT' as const,
        host: this.challengeHost(item),
        value: this.challengeValue(item),
      },
      verifiedAt: item.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: item.lastCheckedAt?.toISOString() ?? null,
      createdBy: item.createdBy,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async resolveTxtWithTimeout(host: string) {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.txtResolver.resolveTxt(host),
        new Promise<string[][]>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('DNS lookup timed out')),
            5000,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private safeEqual(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private dnsErrorReason(error: unknown) {
    const codeValue =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    const code =
      typeof codeValue === 'string' || typeof codeValue === 'number'
        ? String(codeValue)
        : undefined;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ENODOMAIN') {
      return 'Verification TXT record was not found yet';
    }
    return error instanceof Error ? error.message : 'DNS verification failed';
  }

  private audit(
    action: string,
    tenantId: string,
    domainId: string,
    domain: string,
    actorId?: string,
    reason?: string,
  ) {
    this.logger.log(
      `tenantDomain.${action} tenant=${tenantId} domainId=${domainId} domain=${domain} actor=${actorId ?? 'unknown'}${reason ? ` reason=${reason}` : ''}`,
    );
  }
}
