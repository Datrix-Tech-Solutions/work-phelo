import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RequestUser,
  SmsProviderName,
  SmsSenderIdentityProviderResult,
} from '@work-phelo/types';
import {
  MarketingInternalReviewStatus,
  MarketingCampaignStatus,
  MarketingSmsSenderIdentity,
  MarketingProviderVerificationStatus,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingRabbitPublisher } from '../messaging/rabbitmq.publisher';
import { PrismaService } from '../prisma/prisma.service';
import {
  evaluateSmsSenderReadiness,
  getSmsSenderReadinessConfig,
  isSmsSenderProviderSyncDue,
  resolveSmsSenderProvider,
  smsProviderSupportsSenderRefresh,
  SmsSenderReadinessConfig,
  SmsSenderReadinessResult,
} from './sms-sender-readiness';
import {
  CreateSmsSenderIdentityDto,
  QuerySmsSenderIdentitiesDto,
  ReconcileSmsSenderProviderStatusDto,
  RejectSmsSenderIdentityDto,
  UpdateSmsSenderIdentityDto,
} from './dto/sms-sender-identity.dto';

const NOT_FOUND_MESSAGE = 'SMS sender identity not found';
const DUPLICATE_MESSAGE =
  'An SMS sender identity with this sender ID already exists';
const NOT_APPROVED_MESSAGE = 'Only approved SMS sender identities can be used';
const IN_USE_MESSAGE = 'SMS sender identity is used by an active campaign';
const PLATFORM_APPROVAL_MESSAGE =
  'Only platform administrators can approve SMS sender identities';
const PROVIDER_UNSUPPORTED_MESSAGE =
  'The selected SMS provider does not support tenant sender identity automation';
const REFRESH_UNSUPPORTED_MESSAGE =
  'The selected SMS provider does not support automated status refresh';
const MUTABLE_STATUSES = ['DRAFT', 'REJECTED'] as const;
const ACTIVE_CAMPAIGN_STATUSES: MarketingCampaignStatus[] = [
  'PENDING_DISPATCH',
  'SCHEDULED',
  'SENDING',
];

export function normalizeSenderId(senderId: string) {
  return senderId.replace(/\s+/g, '').toLowerCase();
}

@Injectable()
export class SmsSenderIdentitiesService {
  private readonly logger = new Logger(SmsSenderIdentitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit?: MarketingRabbitPublisher,
  ) {}

  async list(tenantId: string, query: QuerySmsSenderIdentitiesDto = {}) {
    const where: Prisma.MarketingSmsSenderIdentityWhereInput = {
      tenantId,
      ...(query.status
        ? { status: query.status }
        : query.includeArchived
          ? {}
          : { status: { not: 'ARCHIVED' } }),
      ...(query.providerStatus
        ? { providerStatus: query.providerStatus }
        : query.providerStatusNot
          ? { providerStatus: { not: query.providerStatusNot } }
          : {}),
    };
    const items = await this.prisma.marketingSmsSenderIdentity.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { senderId: 'asc' }, { id: 'asc' }],
    });
    return { items: items.map((item) => this.toResponse(item)) };
  }

  async create(user: RequestUser, dto: CreateSmsSenderIdentityDto) {
    return this.createWithStatus(user.tenantId, user.id, dto);
  }

  /**
   * Provisioned by a platform administrator on a tenant's behalf: the platform is the approver,
   * so the identity skips the draft/submit/approve steps and can be used by campaigns at once.
   */
  async createApproved(
    tenantId: string,
    actorId: string,
    dto: CreateSmsSenderIdentityDto,
  ) {
    return this.createWithStatus(tenantId, actorId, dto, {
      status: 'APPROVED',
      internalReviewStatus: 'APPROVED',
      providerStatus: 'UNKNOWN',
      approvedBy: actorId,
      approvedAt: new Date(),
    });
  }

  private async createWithStatus(
    tenantId: string,
    actorId: string,
    dto: CreateSmsSenderIdentityDto,
    extra: Pick<
      Prisma.MarketingSmsSenderIdentityUncheckedCreateInput,
      | 'status'
      | 'internalReviewStatus'
      | 'providerStatus'
      | 'approvedBy'
      | 'approvedAt'
    > = {},
  ) {
    await this.assertUnique(tenantId, dto.senderId);
    const item = await this.prisma.marketingSmsSenderIdentity.create({
      data: {
        tenantId,
        senderId: dto.senderId,
        normalizedSenderId: normalizeSenderId(dto.senderId),
        displayName: dto.displayName || null,
        purpose: dto.purpose || null,
        provider: dto.provider || null,
        providerReference: dto.providerReference || null,
        createdBy: actorId,
        ...extra,
      },
    });
    return this.toResponse(item);
  }

  async findOne(tenantId: string, id: string) {
    return this.toResponse(await this.findOwned(tenantId, id));
  }

  async update(user: RequestUser, id: string, dto: UpdateSmsSenderIdentityDto) {
    const existing = await this.findOwned(user.tenantId, id);
    if (
      !MUTABLE_STATUSES.includes(
        existing.status as (typeof MUTABLE_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        'Only draft or rejected sender identities can be edited',
      );
    }
    if (
      dto.senderId &&
      normalizeSenderId(dto.senderId) !== existing.normalizedSenderId
    ) {
      await this.assertUnique(user.tenantId, dto.senderId, id);
    }

    const updated = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        ...(dto.senderId
          ? {
              senderId: dto.senderId,
              normalizedSenderId: normalizeSenderId(dto.senderId),
            }
          : {}),
        ...(dto.displayName !== undefined
          ? { displayName: dto.displayName || null }
          : {}),
        ...(dto.purpose !== undefined ? { purpose: dto.purpose || null } : {}),
        ...(dto.provider !== undefined
          ? { provider: dto.provider || null }
          : {}),
        ...(dto.providerReference !== undefined
          ? { providerReference: dto.providerReference || null }
          : {}),
      },
    });
    return this.toResponse(updated);
  }

  async archive(user: RequestUser, id: string) {
    await this.findOwned(user.tenantId, id);
    const activeCampaigns = await this.prisma.marketingCampaign.count({
      where: {
        tenantId: user.tenantId,
        senderIdentityId: id,
        status: { in: ACTIVE_CAMPAIGN_STATUSES },
      },
    });
    if (activeCampaigns > 0) throw new ConflictException(IN_USE_MESSAGE);

    const archived = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: { status: 'ARCHIVED', isDefault: false },
    });
    return this.toResponse(archived);
  }

  async submit(user: RequestUser, id: string) {
    const existing = await this.findOwned(user.tenantId, id);
    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new BadRequestException(
        'Only draft or rejected sender identities can be submitted',
      );
    }
    const submitted = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: 'PENDING_PROVIDER_APPROVAL',
        internalReviewStatus: 'PENDING',
        providerStatus: 'NOT_SUBMITTED',
        requestedBy: user.id,
        requestedAt: new Date(),
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        isDefault: false,
      },
    });
    return this.toResponse(submitted);
  }

  async approve(user: RequestUser, id: string) {
    this.assertPlatformAdmin(user);
    const existing = await this.findOwned(user.tenantId, id);
    if (existing.status !== 'PENDING_PROVIDER_APPROVAL') {
      throw new BadRequestException(
        'Only pending sender identities can be approved',
      );
    }
    const provider = this.providerFor(existing);
    this.assertProviderSupportsSubmit(provider);
    const submission = await this.submitToProvider(existing, provider);
    const legacyStatus = this.legacyStatusFor(
      'APPROVED',
      submission.providerStatus,
      existing.status,
    );
    const approved = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: legacyStatus,
        internalReviewStatus: 'APPROVED',
        ...this.providerUpdateData(submission, true),
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    return this.toResponse(approved);
  }

  async refreshProviderStatus(user: RequestUser, id: string) {
    const existing = await this.findOwned(user.tenantId, id);
    const provider = this.providerFor(existing);
    this.assertProviderSupportsRefresh(provider);
    const result = await this.refreshFromProvider(existing, provider);
    const updated = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: this.legacyStatusFor(
          existing.internalReviewStatus,
          result.providerStatus,
          existing.status,
        ),
        ...this.providerUpdateData(result),
      },
    });
    return this.toResponse(updated);
  }

  async reconcileProviderStatus(
    user: RequestUser,
    id: string,
    dto: ReconcileSmsSenderProviderStatusDto,
  ) {
    this.assertPlatformAdmin(user);
    const existing = await this.findOwned(user.tenantId, id);
    const status = dto.providerStatus;
    const updated = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: this.legacyStatusFor(
          existing.internalReviewStatus,
          status,
          existing.status,
        ),
        providerStatus: status,
        providerReferenceId:
          dto.providerReferenceId ?? existing.providerReferenceId,
        providerLastSyncedAt: new Date(),
        providerStatusReason: dto.note ?? null,
        providerPayload: {
          manualReconciliation: {
            actorId: user.id,
            providerStatus: status,
            providerReferenceId: dto.providerReferenceId ?? null,
            note: dto.note ?? null,
            recordedAt: new Date().toISOString(),
          },
        },
      },
    });
    return this.toResponse(updated);
  }

  async reject(user: RequestUser, id: string, dto: RejectSmsSenderIdentityDto) {
    this.assertPlatformAdmin(user);
    const existing = await this.findOwned(user.tenantId, id);
    if (existing.status !== 'PENDING_PROVIDER_APPROVAL') {
      throw new BadRequestException(
        'Only pending sender identities can be rejected',
      );
    }
    const rejected = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: 'REJECTED',
        internalReviewStatus: 'REJECTED',
        providerStatus: 'NOT_SUBMITTED',
        rejectedBy: user.id,
        rejectedAt: new Date(),
        rejectionReason: dto.reason || null,
        approvedBy: null,
        approvedAt: null,
        isDefault: false,
      },
    });
    return this.toResponse(rejected);
  }

  async setDefault(user: RequestUser, id: string) {
    const existing = await this.findOwned(user.tenantId, id);
    if (existing.status !== 'APPROVED')
      throw new BadRequestException(NOT_APPROVED_MESSAGE);

    const item = await this.prisma.$transaction(async (tx) => {
      await tx.marketingSmsSenderIdentity.updateMany({
        where: { tenantId: user.tenantId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.marketingSmsSenderIdentity.update({
        where: { id },
        data: { isDefault: true },
      });
    });
    return this.toResponse(item);
  }

  async findApprovedForCampaign(tenantId: string, id?: string) {
    const readiness = await this.evaluateForCampaign(tenantId, id);
    return readiness.ready ? readiness.sender : null;
  }

  async evaluateForCampaign(
    tenantId: string,
    id?: string,
    options: { refreshIfDue?: boolean; campaignId?: string } = {},
  ): Promise<SmsSenderReadinessResult<MarketingSmsSenderIdentity>> {
    const config = getSmsSenderReadinessConfig();
    if (!id) {
      const readiness = evaluateSmsSenderReadiness<MarketingSmsSenderIdentity>(
        null,
        config,
      );
      this.logReadinessIfNeeded(readiness, tenantId, options.campaignId);
      return readiness;
    }
    const sender = await this.prisma.marketingSmsSenderIdentity.findFirst({
      where: { id, tenantId },
    });
    let readiness = evaluateSmsSenderReadiness(sender, config);
    if (
      options.refreshIfDue &&
      sender &&
      this.shouldRefreshProvider(sender, config)
    ) {
      this.logger.log(
        `sms_sender.readiness_refresh_attempt tenantId=${tenantId} campaignId=${options.campaignId ?? 'n/a'} senderId=${sender.senderId} provider=${readiness.provider} mode=${readiness.mode} reasonCode=${readiness.reasonCode}`,
      );
      try {
        const refreshed = await this.refreshFromProvider(
          sender,
          readiness.provider,
        );
        const updated = await this.prisma.marketingSmsSenderIdentity.update({
          where: { id: sender.id },
          data: {
            status: this.legacyStatusFor(
              sender.internalReviewStatus,
              refreshed.providerStatus,
              sender.status,
            ),
            ...this.providerUpdateData(refreshed),
          },
        });
        const refreshedReadiness = evaluateSmsSenderReadiness(updated, config);
        this.logger.log(
          `sms_sender.readiness_refresh_success tenantId=${tenantId} campaignId=${options.campaignId ?? 'n/a'} senderId=${updated.senderId} provider=${refreshedReadiness.provider} mode=${refreshedReadiness.mode} reasonCode=${refreshedReadiness.reasonCode}`,
        );
        readiness = refreshedReadiness;
      } catch (error) {
        this.logger.error(
          `sms_sender.readiness_refresh_failed tenantId=${tenantId} campaignId=${options.campaignId ?? 'n/a'} senderId=${sender.senderId} provider=${readiness.provider} mode=${readiness.mode} reasonCode=${readiness.reasonCode} error=${this.safeProviderError(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    this.logReadinessIfNeeded(readiness, tenantId, options.campaignId);
    return readiness;
  }

  private async findOwned(tenantId: string, id: string) {
    const item = await this.prisma.marketingSmsSenderIdentity.findFirst({
      where: { id, tenantId, status: { not: 'ARCHIVED' } },
    });
    if (!item) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return item;
  }

  private assertPlatformAdmin(user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(PLATFORM_APPROVAL_MESSAGE);
    }
  }

  private providerFor(sender: MarketingSmsSenderIdentity): SmsProviderName {
    const provider = (
      sender.provider ||
      process.env.SMS_PROVIDER ||
      'termii'
    ).toLowerCase();
    if (
      provider === 'termii' ||
      provider === 'pilosms' ||
      provider === 'sasusync' ||
      provider === 'agoosms'
    ) {
      return provider;
    }
    throw new BadRequestException(`Unsupported SMS provider "${provider}"`);
  }

  private assertProviderSupportsSubmit(provider: SmsProviderName) {
    if (provider === 'agoosms') {
      throw new BadRequestException(PROVIDER_UNSUPPORTED_MESSAGE);
    }
  }

  private assertProviderSupportsRefresh(provider: SmsProviderName) {
    if (provider === 'agoosms' || provider === 'pilosms') {
      throw new BadRequestException(REFRESH_UNSUPPORTED_MESSAGE);
    }
  }

  private shouldRefreshProvider(
    sender: MarketingSmsSenderIdentity,
    config: SmsSenderReadinessConfig,
  ) {
    const provider = resolveSmsSenderProvider(sender.provider);
    return (
      smsProviderSupportsSenderRefresh(provider) &&
      isSmsSenderProviderSyncDue(sender, config.maxProviderStatusAgeHours)
    );
  }

  private async submitToProvider(
    sender: MarketingSmsSenderIdentity,
    provider: SmsProviderName,
  ): Promise<SmsSenderIdentityProviderResult> {
    if (!this.rabbit) {
      throw new ServiceUnavailableException(
        'Provider submission is not configured',
      );
    }
    try {
      return await this.rabbit.submitSmsSenderIdentity({
        tenantId: sender.tenantId,
        senderIdentityId: sender.id,
        provider,
        senderId: sender.senderId,
        purpose:
          sender.purpose ||
          sender.displayName ||
          `Marketing SMS campaigns for ${sender.senderId}`,
      });
    } catch (error) {
      throw new ServiceUnavailableException(this.safeProviderError(error));
    }
  }

  private async refreshFromProvider(
    sender: MarketingSmsSenderIdentity,
    provider: SmsProviderName,
  ): Promise<SmsSenderIdentityProviderResult> {
    if (!this.rabbit) {
      throw new ServiceUnavailableException(
        'Provider status refresh is not configured',
      );
    }
    try {
      return await this.rabbit.refreshSmsSenderIdentityStatus({
        tenantId: sender.tenantId,
        senderIdentityId: sender.id,
        provider,
        senderId: sender.senderId,
        providerReferenceId: sender.providerReferenceId,
      });
    } catch (error) {
      throw new ServiceUnavailableException(this.safeProviderError(error));
    }
  }

  private providerUpdateData(
    result: SmsSenderIdentityProviderResult,
    submitted = false,
  ): Prisma.MarketingSmsSenderIdentityUpdateInput {
    return {
      provider: result.provider,
      providerStatus:
        result.providerStatus as MarketingProviderVerificationStatus,
      providerReferenceId: result.providerReferenceId ?? undefined,
      providerSubmittedAt: submitted ? new Date() : undefined,
      providerLastSyncedAt: new Date(),
      providerStatusReason: result.providerStatusReason ?? null,
      providerPayload: result.providerPayload
        ? (result.providerPayload as Prisma.InputJsonValue)
        : undefined,
    };
  }

  private legacyStatusFor(
    internalReviewStatus: MarketingInternalReviewStatus,
    providerStatus: MarketingProviderVerificationStatus,
    fallback: MarketingSmsSenderIdentity['status'],
  ): MarketingSmsSenderIdentity['status'] {
    if (providerStatus === 'REJECTED') return 'REJECTED';
    if (providerStatus === 'SUSPENDED') return 'SUSPENDED';
    if (internalReviewStatus === 'APPROVED' && providerStatus === 'APPROVED') {
      return 'APPROVED';
    }
    return fallback === 'APPROVED' && providerStatus !== 'APPROVED'
      ? 'PENDING_PROVIDER_APPROVAL'
      : fallback;
  }

  private safeProviderError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Provider operation failed';
    return message || 'Provider operation failed';
  }

  private logReadinessIfNeeded(
    readiness: SmsSenderReadinessResult<MarketingSmsSenderIdentity>,
    tenantId: string,
    campaignId?: string,
  ) {
    if (readiness.ready && readiness.effectiveReady) return;
    const senderId = readiness.sender?.senderId ?? 'n/a';
    const detail = `tenantId=${tenantId} campaignId=${campaignId ?? 'n/a'} senderId=${senderId} provider=${readiness.provider} mode=${readiness.mode} reasonCode=${readiness.reasonCode}`;
    if (!readiness.ready) {
      this.logger.warn(`sms_sender.readiness_block ${detail}`);
    } else if (!readiness.effectiveReady) {
      this.logger.warn(`sms_sender.readiness_warning ${detail}`);
    }
  }

  private async assertUnique(
    tenantId: string,
    senderId: string,
    exceptId?: string,
  ) {
    const duplicate = await this.prisma.marketingSmsSenderIdentity.findFirst({
      where: {
        tenantId,
        normalizedSenderId: normalizeSenderId(senderId),
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException(DUPLICATE_MESSAGE);
  }

  private toResponse(item: MarketingSmsSenderIdentity) {
    return {
      id: item.id,
      senderId: item.senderId,
      displayName: item.displayName,
      tenantDomainId: item.tenantDomainId,
      purpose: item.purpose,
      provider: item.provider,
      providerReference: item.providerReference,
      providerReferenceId: item.providerReferenceId,
      status: item.status,
      ownershipStatus: item.ownershipStatus,
      internalReviewStatus: item.internalReviewStatus,
      providerStatus: item.providerStatus,
      providerSubmittedAt: item.providerSubmittedAt?.toISOString() ?? null,
      providerLastSyncedAt: item.providerLastSyncedAt?.toISOString() ?? null,
      providerStatusReason: item.providerStatusReason,
      readiness: this.toReadinessResponse(item),
      isDefault: item.isDefault,
      requestedBy: item.requestedBy,
      requestedAt: item.requestedAt?.toISOString() ?? null,
      approvedBy: item.approvedBy,
      approvedAt: item.approvedAt?.toISOString() ?? null,
      rejectedBy: item.rejectedBy,
      rejectedAt: item.rejectedAt?.toISOString() ?? null,
      rejectionReason: item.rejectionReason,
      createdBy: item.createdBy,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toReadinessResponse(item: MarketingSmsSenderIdentity) {
    const readiness = evaluateSmsSenderReadiness(item);
    return {
      ready: readiness.ready,
      legacyReady: readiness.legacyReady,
      effectiveReady: readiness.effectiveReady,
      mode: readiness.mode,
      reasonCode: readiness.reasonCode,
      reasonMessage: readiness.reasonMessage,
      provider: readiness.provider,
      providerStatusStale: readiness.providerStatusStale,
    };
  }
}
