import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignDeliveryResultEvent, RequestUser } from '@work-phelo/types';
import {
  MarketingCampaign,
  MarketingCampaignRecipientStatus,
  MarketingCampaignStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { campaignSmsText, estimateSmsSegments } from '../sms/sms-segments';
import { SmsSenderIdentitiesService } from '../sms/sms-sender-identities.service';
import { SmsWalletService } from '../sms/sms-wallet.service';
import { CampaignSegmentsService } from './campaign-segments.service';
import {
  CAMPAIGN_DISPATCHER,
  type CampaignDispatcher,
} from './campaign-dispatcher';
import {
  CampaignChannel,
  CreateCampaignDto,
  EstimateCampaignDto,
  PreviewCampaignRecipientsDto,
  QueryCampaignsDto,
  RecipientOptionsQueryDto,
} from './dto/campaign.dto';

const NOT_FOUND_MESSAGE = 'Campaign not found';
const NO_PROSPECTS_MESSAGE = 'No prospects were found in the selected segments';
const NO_REACHABLE_MESSAGE =
  'None of the prospects in these segments have a primary contact reachable on the selected channels';
const PAST_DATE_MESSAGE = 'The scheduled date cannot be in the past';
const NOT_CANCELLABLE_MESSAGE =
  'Only campaigns that have not started sending can be cancelled';
const NOT_SENDABLE_MESSAGE =
  'Only pending or scheduled SMS campaigns can be sent';
const EMAIL_NOT_SUPPORTED_MESSAGE =
  'Email campaign delivery is not available in this phase';
const SMS_SENDER_REQUIRED_MESSAGE =
  'SMS campaigns require an approved sender identity';
const CANCELLED_DETAIL = 'Campaign cancelled';
const DISPATCH_FAILED_DETAIL = 'Campaign dispatch could not be queued';
const DUPLICATE_DETAIL = 'Duplicate address in this campaign';
const MISSING_ADDRESS_DETAIL = {
  SMS: 'Primary contact has no phone number',
  EMAIL: 'Primary contact has no email address',
} as const;

export interface CampaignRecipientDraft {
  prospectId: string;
  contactId: string;
  companyName: string;
  contactName: string;
  channel: CampaignChannel;
  address: string | null;
  status: 'PENDING' | 'SKIPPED';
  providerDetail: string | null;
  segmentCount?: number | null;
  estimatedCredits?: number | null;
  senderIdSnapshot?: string | null;
  senderIdentityId?: string | null;
}

export interface CampaignDeliveryResult {
  recipientId: string;
  status: 'SENT' | 'FAILED';
  providerDetail?: string;
}

type StatusCounts = Record<
  | 'total'
  | 'pending'
  | 'queued'
  | 'sending'
  | 'accepted'
  | 'delivered'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'cancelled',
  number
>;

const emptyCounts = (): StatusCounts => ({
  total: 0,
  pending: 0,
  queued: 0,
  sending: 0,
  accepted: 0,
  delivered: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  cancelled: 0,
});

const ACTIVE_SEND_STATUSES: MarketingCampaignStatus[] = [
  'PENDING_DISPATCH',
  'SCHEDULED',
];

const ACTIVE_RECIPIENT_STATUSES: MarketingCampaignRecipientStatus[] = [
  'PENDING',
  'QUEUED',
  'SENDING',
];

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senderIdentities: SmsSenderIdentitiesService,
    private readonly wallet: SmsWalletService,
    @Inject(CAMPAIGN_DISPATCHER)
    private readonly dispatcher: CampaignDispatcher,
    private readonly segments: CampaignSegmentsService,
  ) {}

  async list(user: RequestUser, query: QueryCampaignsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MarketingCampaignWhereInput = {
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, campaigns] = await Promise.all([
      this.prisma.marketingCampaign.count({ where }),
      this.prisma.marketingCampaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const counts = await this.countRecipients(
      user.tenantId,
      campaigns.map((campaign) => campaign.id),
    );

    return {
      data: campaigns.map((campaign) =>
        this.toResponse(campaign, counts.get(campaign.id)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async get(user: RequestUser, id: string) {
    const campaign = await this.findOwned(user.tenantId, id);
    const counts = await this.countRecipients(user.tenantId, [id]);
    return this.toResponse(campaign, counts.get(id));
  }

  /** Prospects that can be picked when building a segment, optionally within some filters. */
  async recipientOptions(user: RequestUser, query: RecipientOptionsQueryDto) {
    const search = query.search?.trim().replace(/\s+/g, ' ').toLowerCase();
    const prospects = await this.prisma.marketingProspect.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.businessTypeIds?.length
          ? { businessTypeId: { in: query.businessTypeIds } }
          : {}),
        ...(query.ids?.length ? { id: { in: query.ids } } : {}),
        ...(query.pipelineStageIds?.length
          ? { pipelineStageId: { in: query.pipelineStageIds } }
          : {}),
        ...(search ? { normalizedCompanyName: { contains: search } } : {}),
      },
      orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
      take: query.ids?.length ?? query.limit ?? 30,
      select: {
        id: true,
        companyName: true,
        locationLabel: true,
        contacts: {
          where: { isPrimary: true },
          take: 1,
          select: { name: true },
        },
      },
    });
    return prospects.map((prospect) => ({
      id: prospect.id,
      companyName: prospect.companyName,
      locationLabel: prospect.locationLabel,
      contactName: prospect.contacts[0]?.name ?? null,
    }));
  }

  /** How many messages a campaign would queue, without saving anything. */
  async preview(user: RequestUser, dto: PreviewCampaignRecipientsDto) {
    const audience = await this.segments.resolve(user.tenantId, dto.segmentIds);
    const { prospectCount, drafts } = await this.resolveRecipients(
      audience.where,
      dto.channels,
    );
    return {
      prospectCount,
      reachable: this.countDrafts(drafts, 'PENDING'),
      skipped: this.countDrafts(drafts, 'SKIPPED'),
    };
  }

  async estimate(user: RequestUser, dto: EstimateCampaignDto) {
    const audience = await this.segments.resolve(user.tenantId, dto.segmentIds);
    const { prospectCount, drafts } = await this.resolveRecipients(
      audience.where,
      dto.channels,
    );
    const smsDrafts = drafts.filter((draft) => draft.channel === 'SMS');
    const smsPendingCount = smsDrafts.filter(
      (draft) => draft.status === 'PENDING',
    ).length;
    const emailRecipientCount = drafts.filter(
      (draft) => draft.channel === 'EMAIL' && draft.status === 'PENDING',
    ).length;
    const missingSmsCount = smsDrafts.filter(
      (draft) => draft.providerDetail === MISSING_ADDRESS_DETAIL.SMS,
    ).length;
    const missingEmailCount = drafts.filter(
      (draft) =>
        draft.channel === 'EMAIL' &&
        draft.providerDetail === MISSING_ADDRESS_DETAIL.EMAIL,
    ).length;
    const duplicateRecipientCount = drafts.filter(
      (draft) => draft.providerDetail === DUPLICATE_DETAIL,
    ).length;
    const smsEstimate = estimateSmsSegments(
      campaignSmsText(dto.subject, dto.message),
    );
    const estimatedCredits = smsPendingCount * smsEstimate.segmentCount;
    const balance = await this.wallet.getBalance(user.tenantId);
    const sender = dto.channels.includes('SMS')
      ? await this.senderIdentities.findApprovedForCampaign(
          user.tenantId,
          dto.senderIdentityId,
        )
      : null;
    const warnings: Array<{ code: string; message: string; count?: number }> =
      [];

    if (dto.channels.includes('SMS') && !dto.senderIdentityId) {
      warnings.push({
        code: 'NO_APPROVED_SENDER_IDENTITY',
        message: SMS_SENDER_REQUIRED_MESSAGE,
      });
    } else if (dto.channels.includes('SMS') && !sender) {
      warnings.push({
        code: 'INVALID_OR_UNAPPROVED_SENDER_IDENTITY',
        message: SMS_SENDER_REQUIRED_MESSAGE,
      });
    }
    if (missingSmsCount > 0) {
      warnings.push({
        code: 'MISSING_SMS_ADDRESS',
        message: MISSING_ADDRESS_DETAIL.SMS,
        count: missingSmsCount,
      });
    }
    if (missingEmailCount > 0) {
      warnings.push({
        code: 'MISSING_EMAIL_ADDRESS',
        message: MISSING_ADDRESS_DETAIL.EMAIL,
        count: missingEmailCount,
      });
    }
    if (duplicateRecipientCount > 0) {
      warnings.push({
        code: 'DUPLICATE_RECIPIENT',
        message: DUPLICATE_DETAIL,
        count: duplicateRecipientCount,
      });
    }
    if (estimatedCredits > balance.availableCredits) {
      warnings.push({
        code: 'INSUFFICIENT_SMS_CREDITS',
        message: 'SMS wallet has insufficient available credits',
        count: estimatedCredits - balance.availableCredits,
      });
    }

    return {
      prospectCount,
      recipientCount: this.countDrafts(drafts, 'PENDING'),
      smsRecipientCount: smsPendingCount,
      emailRecipientCount,
      smsEncoding: smsEstimate.encoding,
      segmentsPerMessage: smsEstimate.segmentCount,
      estimatedSmsSegments: estimatedCredits,
      estimatedCredits,
      wallet: {
        ...balance,
        sufficientCredits: balance.availableCredits >= estimatedCredits,
        shortfallCredits: Math.max(
          estimatedCredits - balance.availableCredits,
          0,
        ),
      },
      senderIdentity: sender
        ? {
            id: sender.id,
            senderId: sender.senderId,
            displayName: sender.displayName,
            isDefault: sender.isDefault,
          }
        : null,
      warnings,
    };
  }

  async create(user: RequestUser, dto: CreateCampaignDto) {
    const scheduledDate = this.parseScheduledDate(dto);
    const audience = await this.segments.resolve(user.tenantId, dto.segmentIds);
    const { prospectCount, drafts } = await this.resolveRecipients(
      audience.where,
      dto.channels,
    );
    if (prospectCount === 0)
      throw new BadRequestException(NO_PROSPECTS_MESSAGE);
    if (this.countDrafts(drafts, 'PENDING') === 0) {
      throw new BadRequestException(NO_REACHABLE_MESSAGE);
    }
    const usesSms = dto.channels.includes('SMS');
    const sender = usesSms
      ? await this.senderIdentities.findApprovedForCampaign(
          user.tenantId,
          dto.senderIdentityId,
        )
      : null;
    if (usesSms && !sender)
      throw new BadRequestException(SMS_SENDER_REQUIRED_MESSAGE);
    const smsEstimate = usesSms
      ? estimateSmsSegments(campaignSmsText(dto.subject, dto.message))
      : null;
    const preparedDrafts = drafts.map((draft) => {
      if (
        draft.channel !== 'SMS' ||
        !smsEstimate ||
        draft.status !== 'PENDING'
      ) {
        return draft;
      }
      return {
        ...draft,
        segmentCount: smsEstimate.segmentCount,
        estimatedCredits: smsEstimate.segmentCount,
        senderIdSnapshot: sender?.senderId ?? null,
        senderIdentityId: sender?.id ?? null,
      };
    });
    const estimatedCredits = preparedDrafts.reduce(
      (total, draft) => total + (draft.estimatedCredits ?? 0),
      0,
    );

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketingCampaign.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          channels: dto.channels,
          businessTypeIds: audience.businessTypes.map((type) => type.id),
          businessTypeNames: audience.businessTypes.map((type) => type.name),
          segmentIds: audience.segments.map((segment) => segment.id),
          segmentNames: audience.segments.map((segment) => segment.name),
          senderIdentityId: sender?.id ?? null,
          senderIdSnapshot: sender?.senderId ?? null,
          subject: dto.subject,
          message: dto.message,
          dispatchMode: dto.dispatchMode,
          scheduledDate,
          status:
            dto.dispatchMode === 'SCHEDULED' ? 'SCHEDULED' : 'PENDING_DISPATCH',
          estimatedCredits,
          createdByUserId: user.id,
        },
      });
      await tx.marketingCampaignRecipient.createMany({
        data: preparedDrafts.map((draft) => ({
          ...draft,
          tenantId: user.tenantId,
          campaignId: created.id,
        })),
      });
      return created;
    });

    const counts = await this.countRecipients(user.tenantId, [campaign.id]);
    return this.toResponse(campaign, counts.get(campaign.id));
  }

  async send(user: RequestUser, id: string) {
    const campaign = await this.dispatchCampaign(user.tenantId, id);
    const counts = await this.countRecipients(user.tenantId, [id]);
    return this.toResponse(campaign, counts.get(id));
  }

  async dispatchDueScheduledCampaigns(limit = 25) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dueCampaigns = await this.prisma.marketingCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: { lte: today },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, tenantId: true },
    });

    for (const campaign of dueCampaigns) {
      try {
        await this.dispatchCampaign(campaign.tenantId, campaign.id);
      } catch {
        // The scheduler is best-effort; explicit send can retry campaigns that remain pending.
      }
    }
  }

  async cancel(user: RequestUser, id: string) {
    const existing = await this.findOwned(user.tenantId, id);
    if (!['SCHEDULED', 'PENDING_DISPATCH'].includes(existing.status)) {
      throw new BadRequestException(NOT_CANCELLABLE_MESSAGE);
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketingCampaign.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
          status: { in: ['SCHEDULED', 'PENDING_DISPATCH'] },
        },
      });
      if (!current) throw new BadRequestException(NOT_CANCELLABLE_MESSAGE);

      const pendingCredits = await tx.marketingCampaignRecipient.aggregate({
        where: {
          tenantId: user.tenantId,
          campaignId: id,
          status: 'PENDING',
          creditReleasedAt: null,
        },
        _sum: { estimatedCredits: true },
      });
      const releaseCredits = pendingCredits._sum.estimatedCredits ?? 0;
      const releasedAt = new Date();
      if (current.smsReservationId && releaseCredits > 0) {
        await this.wallet.releaseReservationInTransaction(
          tx,
          user.tenantId,
          current.smsReservationId,
          releaseCredits,
        );
      }

      await tx.marketingCampaignRecipient.updateMany({
        where: {
          campaignId: id,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          providerDetail: CANCELLED_DETAIL,
          creditReleasedAt: current.smsReservationId ? releasedAt : undefined,
        },
      });
      return tx.marketingCampaign.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: releasedAt,
          cancelledByUserId: user.id,
        },
      });
    });

    await this.dispatcher.cancel(id);

    const counts = await this.countRecipients(user.tenantId, [id]);
    return this.toResponse(cancelled, counts.get(id));
  }

  async applyDeliveryResult(result: CampaignDeliveryResultEvent) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.marketingCampaign.findFirst({
        where: {
          id: result.campaignId,
          tenantId: result.tenantId,
        },
      });
      if (!campaign) throw new NotFoundException(NOT_FOUND_MESSAGE);
      if (campaign.status === 'CANCELLED') return campaign;

      const recipient = await tx.marketingCampaignRecipient.findFirst({
        where: {
          id: result.recipientId,
          tenantId: result.tenantId,
          campaignId: result.campaignId,
        },
      });
      if (!recipient)
        throw new NotFoundException('Campaign recipient not found');

      const now = new Date();
      const credits = result.accepted
        ? result.chargedCredits || recipient.estimatedCredits || 1
        : recipient.estimatedCredits || 0;
      const reservationId =
        result.reservationId ??
        recipient.smsReservationId ??
        campaign.smsReservationId;

      if (reservationId && credits > 0) {
        if (result.accepted && !recipient.creditConsumedAt) {
          await this.wallet.consumeReservationInTransaction(
            tx,
            result.tenantId,
            reservationId,
            credits,
          );
        }
        if (!result.accepted && !recipient.creditReleasedAt) {
          await this.wallet.releaseReservationInTransaction(
            tx,
            result.tenantId,
            reservationId,
            credits,
          );
        }
      }

      await tx.marketingCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: result.accepted ? 'ACCEPTED' : 'FAILED',
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          providerDetail: result.providerDetail,
          failureCode: result.failureCode,
          failureReason: result.failureReason,
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          acceptedAt: result.accepted ? now : recipient.acceptedAt,
          sentAt: result.accepted ? now : recipient.sentAt,
          failedAt: result.accepted ? recipient.failedAt : now,
          smsReservationId: reservationId,
          creditConsumedAt:
            result.accepted && !recipient.creditConsumedAt
              ? now
              : recipient.creditConsumedAt,
          creditReleasedAt:
            !result.accepted && !recipient.creditReleasedAt
              ? now
              : recipient.creditReleasedAt,
        },
      });

      if (result.accepted && !recipient.creditConsumedAt) {
        await tx.marketingCampaign.update({
          where: { id: campaign.id },
          data: { consumedCredits: { increment: credits } },
        });
      }

      return this.recalculateCampaignStatus(tx, result.tenantId, campaign.id);
    });
  }

  /**
   * Backward-compatible bulk result helper used by earlier tests and any local
   * direct integration harness. New delivery results arrive one event per recipient.
   */
  async applyDeliveryResults(
    campaignId: string,
    results: CampaignDeliveryResult[],
  ) {
    let last: MarketingCampaign | null = null;
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException(NOT_FOUND_MESSAGE);
    for (const result of results) {
      last = await this.applyDeliveryResult({
        tenantId: campaign.tenantId,
        campaignId,
        recipientId: result.recipientId,
        channel: 'SMS',
        accepted: result.status === 'SENT',
        provider: 'termii',
        providerDetail: result.providerDetail,
        failureReason:
          result.status === 'FAILED' ? result.providerDetail : undefined,
        chargedCredits: result.status === 'SENT' ? 1 : 0,
        idempotencyKey: `${campaignId}:${result.recipientId}:legacy`,
      });
    }
    return last ?? campaign;
  }

  private async dispatchCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.findOwned(tenantId, campaignId);
    if (!ACTIVE_SEND_STATUSES.includes(campaign.status)) {
      return campaign;
    }
    if (
      !campaign.channels.includes('SMS') ||
      campaign.channels.includes('EMAIL')
    ) {
      throw new BadRequestException(EMAIL_NOT_SUPPORTED_MESSAGE);
    }
    const sender = await this.senderIdentities.findApprovedForCampaign(
      tenantId,
      campaign.senderIdentityId ?? undefined,
    );
    if (!sender) throw new BadRequestException(SMS_SENDER_REQUIRED_MESSAGE);

    const pendingCredits =
      await this.prisma.marketingCampaignRecipient.aggregate({
        where: {
          tenantId,
          campaignId,
          channel: 'SMS',
          status: 'PENDING',
          address: { not: null },
        },
        _sum: { estimatedCredits: true },
        _count: { _all: true },
      });
    const credits = pendingCredits._sum.estimatedCredits ?? 0;
    if (pendingCredits._count._all === 0 || credits <= 0) {
      throw new BadRequestException('Campaign has no pending SMS recipients');
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.marketingCampaign.updateMany({
        where: {
          id: campaignId,
          tenantId,
          status: { in: ACTIVE_SEND_STATUSES },
          smsReservationId: null,
        },
        data: { status: 'QUEUED' },
      });
      if (count === 0) {
        const current = await tx.marketingCampaign.findFirst({
          where: { id: campaignId, tenantId },
        });
        if (current?.smsReservationId) return { id: current.smsReservationId };
        throw new BadRequestException(NOT_SENDABLE_MESSAGE);
      }
      const created = await this.wallet.reserveCreditsInTransaction(tx, {
        tenantId,
        campaignId,
        credits,
        idempotencyKey: `campaign:${campaignId}:sms`,
      });
      await tx.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          smsReservationId: created.id,
          reservedCredits: created.reservedCredits,
          senderIdSnapshot: sender.senderId,
        },
      });
      return created;
    });

    try {
      await this.dispatcher.dispatch(campaignId);
      return this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'SENDING',
          dispatchedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.releaseReservationInTransaction(
          tx,
          tenantId,
          reservation.id,
        );
        await tx.marketingCampaignRecipient.updateMany({
          where: {
            tenantId,
            campaignId,
            status: { in: ['PENDING', 'QUEUED'] },
          },
          data: {
            status: 'PENDING',
            smsReservationId: null,
            providerDetail: DISPATCH_FAILED_DETAIL,
          },
        });
        await tx.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            status: campaign.status,
            smsReservationId: null,
            reservedCredits: 0,
          },
        });
      });
      throw error;
    }
  }

  /**
   * One draft per prospect primary contact per channel. A contact without the
   * needed phone/email, or an address already used earlier in the campaign, is
   * kept as SKIPPED so the counts explain themselves.
   */
  private async resolveRecipients(
    /** Matches a prospect in any of the chosen segments, so one in several is listed once. */
    where: Prisma.MarketingProspectWhereInput,
    channels: CampaignChannel[],
  ) {
    const prospects = await this.prisma.marketingProspect.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        companyName: true,
        contacts: {
          where: { isPrimary: true },
          take: 1,
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    const seen = new Set<string>();
    const drafts: CampaignRecipientDraft[] = [];
    for (const prospect of prospects) {
      const contact = prospect.contacts[0];
      if (!contact) continue;

      for (const channel of channels) {
        const raw = channel === 'SMS' ? contact.phone : contact.email;
        const address = raw?.trim() || null;
        const key = address
          ? `${channel}:${address.toLowerCase().replace(/\s+/g, '')}`
          : null;

        let status: 'PENDING' | 'SKIPPED' = 'PENDING';
        let providerDetail: string | null = null;
        if (!address) {
          status = 'SKIPPED';
          providerDetail = MISSING_ADDRESS_DETAIL[channel];
        } else if (key && seen.has(key)) {
          status = 'SKIPPED';
          providerDetail = DUPLICATE_DETAIL;
        } else if (key) {
          seen.add(key);
        }

        drafts.push({
          prospectId: prospect.id,
          contactId: contact.id,
          companyName: prospect.companyName,
          contactName: contact.name,
          channel,
          address,
          status,
          providerDetail,
        });
      }
    }

    return { prospectCount: prospects.length, drafts };
  }

  private countDrafts(
    drafts: CampaignRecipientDraft[],
    status: CampaignRecipientDraft['status'],
  ) {
    return drafts.filter((draft) => draft.status === status).length;
  }

  /** Every id must be an active business type of this tenant; returned in the order requested. */
  /** "YYYY-MM-DD" as a UTC date, rejecting anything before today. */
  private parseScheduledDate(dto: CreateCampaignDto): Date | null {
    if (dto.dispatchMode !== 'SCHEDULED' || !dto.scheduledDate) return null;
    const date = new Date(`${dto.scheduledDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date < today) {
      throw new BadRequestException(PAST_DATE_MESSAGE);
    }
    return date;
  }

  private async findOwned(tenantId: string, id: string) {
    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { id, tenantId },
    });
    if (!campaign) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return campaign;
  }

  private async countRecipients(tenantId: string, campaignIds: string[]) {
    const byCampaign = new Map<string, StatusCounts>();
    if (campaignIds.length === 0) return byCampaign;

    const groups = await this.prisma.marketingCampaignRecipient.groupBy({
      by: ['campaignId', 'status'],
      where: { tenantId, campaignId: { in: campaignIds } },
      _count: { _all: true },
    });
    const key: Record<MarketingCampaignRecipientStatus, keyof StatusCounts> = {
      PENDING: 'pending',
      QUEUED: 'queued',
      SENDING: 'sending',
      ACCEPTED: 'accepted',
      DELIVERED: 'delivered',
      SENT: 'sent',
      FAILED: 'failed',
      SKIPPED: 'skipped',
      CANCELLED: 'cancelled',
    };
    for (const group of groups) {
      const counts = byCampaign.get(group.campaignId) ?? emptyCounts();
      counts[key[group.status]] += group._count._all;
      counts.total += group._count._all;
      byCampaign.set(group.campaignId, counts);
    }
    return byCampaign;
  }

  private async recalculateCampaignStatus(
    tx: Prisma.TransactionClient,
    tenantId: string,
    campaignId: string,
  ) {
    const groups = await tx.marketingCampaignRecipient.groupBy({
      by: ['status'],
      where: { tenantId, campaignId },
      _count: { _all: true },
    });
    const active = groups
      .filter((group) => ACTIVE_RECIPIENT_STATUSES.includes(group.status))
      .reduce((total, group) => total + group._count._all, 0);
    const accepted = groups
      .filter((group) =>
        ['ACCEPTED', 'DELIVERED', 'SENT'].includes(group.status),
      )
      .reduce((total, group) => total + group._count._all, 0);
    const failed = groups
      .filter((group) => group.status === 'FAILED')
      .reduce((total, group) => total + group._count._all, 0);

    const status: MarketingCampaignStatus =
      active > 0
        ? 'SENDING'
        : accepted > 0 && failed > 0
          ? 'PARTIALLY_COMPLETED'
          : accepted > 0
            ? 'COMPLETED'
            : 'FAILED';
    return tx.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        ...(active === 0 ? { completedAt: new Date() } : {}),
      },
    });
  }

  private toResponse(campaign: MarketingCampaign, counts?: StatusCounts) {
    return {
      id: campaign.id,
      name: campaign.name,
      channels: campaign.channels,
      segments: campaign.segmentIds.map((id, index) => ({
        id,
        name: campaign.segmentNames[index] ?? '',
      })),
      businessTypes: campaign.businessTypeIds.map((id, index) => ({
        id,
        name: campaign.businessTypeNames[index] ?? '',
      })),
      subject: campaign.subject,
      message: campaign.message,
      dispatchMode: campaign.dispatchMode,
      scheduledDate: campaign.scheduledDate
        ? campaign.scheduledDate.toISOString().slice(0, 10)
        : null,
      senderIdentityId: campaign.senderIdentityId,
      senderIdSnapshot: campaign.senderIdSnapshot,
      estimatedCredits: campaign.estimatedCredits,
      reservedCredits: campaign.reservedCredits,
      consumedCredits: campaign.consumedCredits,
      status: campaign.status,
      recipients: counts ?? emptyCounts(),
      dispatchedAt: campaign.dispatchedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
      cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
    };
  }
}
