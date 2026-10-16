import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AuthService } from './auth.service';
import { RegisterRecruiterDto } from './dto/register-recruiter.dto';
import { RecruiterLoginDto } from './dto/recruiter-login.dto';
import { CareersSiteUrl } from '../common/careers-site-url.helper';
import { normalizeEmail } from '../common/email.helper';
import { generateSecureToken } from '../common/otp.helper';
import {
  ensurePermissionResources,
  seedDefaultPermissionTemplates,
  seedRecruiterPermissionSet,
} from '../permissions/system-permission-sets';
import { RESOURCES } from '../permissions/resource-definitions';

const CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
const SLUG_MAX_LENGTH = 40;
const RESERVED_SLUGS = new Set(['api', 'auth', 'admin', 'login', 'platform']);

const REGISTER_RESPONSE = {
  status: 'PENDING_VERIFICATION',
  message: 'Registration received. Check your email to confirm your account.',
};

const UNCONFIRMED_MESSAGE =
  'Please confirm your email address first. Check your inbox for the link.';

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug.length >= 2 ? slug : 'company';
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * Recruiters who sign up on the careers site. Each gets a real tenant (so they
 * can be upgraded to a full WorkPhelo workspace later without moving data) but
 * is limited to job openings and applicants by a restricted permission set.
 */
@Injectable()
export class RecruiterAuthService {
  private readonly logger = new Logger(RecruiterAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  async register(dto: RegisterRecruiterDto) {
    const email = normalizeEmail(dto.email);

    const existing = await this.prisma.tenant.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'We could not create this account. If you already registered, sign in or resend the confirmation email.',
      );
    }

    const slug = await this.uniqueSlug(dto.companyName);
    const password = await bcrypt.hash(dto.password, 12);
    const confirmationToken = generateSecureToken();
    const { firstName, lastName } = splitName(dto.name);
    const resourceIds = await this.resourceIds();

    let tenant: { id: string; name: string };
    let user: { id: string; email: string; firstName: string };
    try {
      ({ tenant, user } = await this.prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              name: dto.companyName.trim(),
              slug,
              email,
              ...this.location(dto),
              industry: dto.industry,
              size: dto.companySize,
              status: 'ACTIVE',
              source: 'WEBSITE',
              isVerified: false,
              moduleConfig: { hr: true, accounting: false, marketing: false },
            },
            select: { id: true, name: true },
          });
          await seedDefaultPermissionTemplates(
            tx,
            tenant.id,
            this.logger,
            resourceIds,
          );
          const recruiterSetId = await seedRecruiterPermissionSet(
            tx,
            tenant.id,
            resourceIds,
          );
          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              email,
              password,
              firstName,
              lastName,
              role: 'EMPLOYEE',
              status: 'PENDING_VERIFICATION',
              inviteToken: confirmationToken,
              inviteExpiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
            },
            select: { id: true, email: true, firstName: true },
          });
          await tx.userPermissionSet.create({
            data: {
              userId: user.id,
              permissionSetId: recruiterSetId,
              grantedBy: user.id,
            },
          });
          return { tenant, user };
        },
        { timeout: 30_000 },
      ));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'We could not create this account. If you already registered, sign in or resend the confirmation email.',
        );
      }
      throw error;
    }

    this.sendConfirmation(tenant, user, confirmationToken);
    void this.rabbitmq
      .hrRecruitmentEmployerUpdated({
        tenantId: tenant.id,
        isVerified: false,
        isBlocked: false,
      })
      .catch((err) =>
        this.logger.error('Failed to sync recruitment employer to HR', err),
      );

    await this.audit.log({
      tenantId: tenant.id,
      action: 'CREATE',
      resource: 'tenants',
      resourceId: tenant.id,
      changes: {
        after: { name: tenant.name, slug, source: 'WEBSITE', status: 'ACTIVE' },
      },
      status: 'SUCCESS',
    });

    return REGISTER_RESPONSE;
  }

  async confirmEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: token },
      include: { tenant: { select: { source: true } } },
    });
    if (
      !user ||
      user.tenant.source !== 'WEBSITE' ||
      !user.inviteExpiresAt ||
      user.inviteExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'This confirmation link is invalid or has expired.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return { message: 'Email confirmed. You can now sign in.' };
  }

  async resendConfirmation(rawEmail: string) {
    const generic = {
      message:
        'If that email is waiting for confirmation, a new link has been sent.',
    };
    const email = normalizeEmail(rawEmail);

    const tenant = await this.prisma.tenant.findFirst({
      where: { source: 'WEBSITE', email },
      select: { id: true, name: true },
    });
    if (!tenant) return generic;

    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email, status: 'PENDING_VERIFICATION' },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) return generic;

    const token = generateSecureToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        inviteToken: token,
        inviteExpiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
      },
    });
    this.sendConfirmation(tenant, user, token, true);
    return generic;
  }

  async login(dto: RecruiterLoginDto, ipAddress?: string, userAgent?: string) {
    const email = normalizeEmail(dto.email);

    const tenant = await this.prisma.tenant.findFirst({
      where: { source: 'WEBSITE', email },
      select: { id: true, slug: true, status: true },
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'This account has been blocked. Contact Workphelo support.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email },
      select: { status: true, password: true },
    });
    if (
      user?.status === 'PENDING_VERIFICATION' &&
      user.password &&
      (await bcrypt.compare(dto.password, user.password))
    ) {
      // Only someone who knows the password learns the account is unconfirmed.
      throw new ForbiddenException(UNCONFIRMED_MESSAGE);
    }

    return this.authService.login(
      { email, password: dto.password, tenantSlug: tenant.slug },
      ipAddress,
      userAgent,
    );
  }

  private sendConfirmation(
    tenant: { name: string },
    user: { id: string; email: string; firstName: string },
    token: string,
    isResend = false,
  ) {
    void this.rabbitmq
      .notificationInviteUser({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        tenantName: tenant.name,
        acceptInviteUrl: CareersSiteUrl.confirmRecruiterEmail(token),
        inviteKind: 'RECRUITER',
        isResend,
      })
      .catch((err) =>
        this.logger.error('Failed to emit recruiter confirmation email', err),
      );
  }

  /**
   * The site sends a country name, but tenants keep a two-letter code. A name
   * is folded into the address so nothing the recruiter typed is lost.
   */
  private location(dto: RegisterRecruiterDto) {
    const country = dto.country?.trim();
    if (country && /^[A-Za-z]{2}$/.test(country)) {
      return { address: dto.address, country: country.toUpperCase() };
    }
    const address = [dto.address?.trim(), country].filter(Boolean).join(', ');
    return { address: address || undefined, country: 'GH' };
  }

  private async resourceIds(): Promise<Record<string, string>> {
    const existing = await this.prisma.resource.findMany({
      where: { name: { in: RESOURCES.map((resource) => resource.name) } },
      select: { id: true, name: true },
    });
    return existing.length === RESOURCES.length
      ? Object.fromEntries(
          existing.map((resource) => [resource.name, resource.id]),
        )
      : ensurePermissionResources(this.prisma);
  }

  private async uniqueSlug(companyName: string): Promise<string> {
    const base = slugify(companyName);
    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken =
        RESERVED_SLUGS.has(candidate) ||
        (await this.prisma.tenant.findUnique({
          where: { slug: candidate },
          select: { id: true },
        }));
      if (!taken) return candidate;
      candidate = `${base.slice(0, SLUG_MAX_LENGTH - 5)}-${randomBytes(2).toString('hex')}`;
    }
    throw new ConflictException('Could not create this account. Try again.');
  }
}
