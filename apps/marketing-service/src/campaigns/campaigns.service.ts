import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCampaign,
  MarketingCampaignRecipientStatus,
  MarketingCampaignStatus,
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_DISPATCHER,
  type CampaignDispatcher,
} from './campaign-dispatcher';
import {
  CampaignChannel,
  CreateCampaignDto,
  PreviewCampaignRecipientsDto,
  QueryCampaignsDto,
} from './dto/campaign.dto';

const NOT_FOUND_MESSAGE = 'Campaign not found';
const INVALID_BUSINESS_TYPE_MESSAGE =
  'A selected business type is invalid or inactive';
const NO_PROSPECTS_MESSAGE =
  'No prospects were found under the selected business types';
const NO_REACHABLE_MESSAGE =
  'None of the prospects under these business types have a primary contact reachable on the selected channels';
const PAST_DATE_MESSAGE = 'The scheduled date cannot be in the past';
const NOT_CANCELLABLE_MESSAGE = 'Only scheduled campaigns can be cancelled';
const CANCELLED_DETAIL = 'Campaign cancelled';
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
}

export interface CampaignDeliveryResult {
  recipientId: string;
  status: 'SENT' | 'FAILED';
  providerDetail?: string;
}

type StatusCounts = Record<
  'total' | 'pending' | 'sent' | 'failed' | 'skipped',
  number
>;

const emptyCounts = (): StatusCounts => ({
  total: 0,
  pending: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
});

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CAMPAIGN_DISPATCHER)
    private readonly dispatcher: CampaignDispatcher,
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

  /** How many messages a campaign would queue, without saving anything. */
  async preview(user: RequestUser, dto: PreviewCampaignRecipientsDto) {
    await this.assertActiveBusinessTypes(user.tenantId, dto.businessTypeIds);
    const { prospectCount, drafts } = await this.resolveRecipients(
      user.tenantId,
      dto.businessTypeIds,
      dto.channels,
    );
    return {
      prospectCount,
      reachable: this.countDrafts(drafts, 'PENDING'),
      skipped: this.countDrafts(drafts, 'SKIPPED'),
    };
  }

  async create(user: RequestUser, dto: CreateCampaignDto) {
    const scheduledDate = this.parseScheduledDate(dto);
    const businessTypes = await this.assertActiveBusinessTypes(
      user.tenantId,
      dto.businessTypeIds,
    );
    const { prospectCount, drafts } = await this.resolveRecipients(
      user.tenantId,
      dto.businessTypeIds,
      dto.channels,
    );
    if (prospectCount === 0)
      throw new BadRequestException(NO_PROSPECTS_MESSAGE);
    if (this.countDrafts(drafts, 'PENDING') === 0) {
      throw new BadRequestException(NO_REACHABLE_MESSAGE);
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.marketingCampaign.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          channels: dto.channels,
          businessTypeIds: businessTypes.map((type) => type.id),
          businessTypeNames: businessTypes.map((type) => type.name),
          subject: dto.subject,
          message: dto.message,
          dispatchMode: dto.dispatchMode,
          scheduledDate,
          status:
            dto.dispatchMode === 'SCHEDULED' ? 'SCHEDULED' : 'PENDING_DISPATCH',
          createdByUserId: user.id,
        },
      });
      await tx.marketingCampaignRecipient.createMany({
        data: drafts.map((draft) => ({
          ...draft,
          tenantId: user.tenantId,
          campaignId: created.id,
        })),
      });
      return created;
    });

    // After commit, so a dispatcher that reads recipients always finds them.
    await this.dispatcher.dispatch(campaign.id);

    const counts = await this.countRecipients(user.tenantId, [campaign.id]);
    return this.toResponse(campaign, counts.get(campaign.id));
  }

  async cancel(user: RequestUser, id: string) {
    const existing = await this.findOwned(user.tenantId, id);
    if (existing.status !== 'SCHEDULED') {
      throw new BadRequestException(NOT_CANCELLABLE_MESSAGE);
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      // Guarded by status so a campaign that started sending meanwhile is not cancelled.
      const { count } = await tx.marketingCampaign.updateMany({
        where: { id, tenantId: user.tenantId, status: 'SCHEDULED' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
        },
      });
      if (count === 0) throw new BadRequestException(NOT_CANCELLABLE_MESSAGE);
      await tx.marketingCampaignRecipient.updateMany({
        where: { campaignId: id, status: 'PENDING' },
        data: { status: 'SKIPPED', providerDetail: CANCELLED_DETAIL },
      });
      return tx.marketingCampaign.findUniqueOrThrow({ where: { id } });
    });

    await this.dispatcher.cancel(id);

    const counts = await this.countRecipients(user.tenantId, [id]);
    return this.toResponse(cancelled, counts.get(id));
  }

  /**
   * Records delivery outcomes reported by the sending pipeline and moves the
   * campaign to SENDING, then COMPLETED (or FAILED if nothing was delivered)
   * once no recipient is left pending. Not exposed over HTTP; the notification
   * result handler calls it.
   */
  async applyDeliveryResults(
    campaignId: string,
    results: CampaignDeliveryResult[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.marketingCampaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) throw new NotFoundException(NOT_FOUND_MESSAGE);
      if (campaign.status === 'CANCELLED') return campaign;

      const sentAt = new Date();
      for (const result of results) {
        await tx.marketingCampaignRecipient.updateMany({
          where: { id: result.recipientId, campaignId, status: 'PENDING' },
          data: {
            status: result.status,
            providerDetail: result.providerDetail ?? null,
            sentAt: result.status === 'SENT' ? sentAt : null,
          },
        });
      }

      const [pending, sent] = await Promise.all([
        tx.marketingCampaignRecipient.count({
          where: { campaignId, status: 'PENDING' },
        }),
        tx.marketingCampaignRecipient.count({
          where: { campaignId, status: 'SENT' },
        }),
      ]);
      const status: MarketingCampaignStatus =
        pending > 0 ? 'SENDING' : sent > 0 ? 'COMPLETED' : 'FAILED';
      return tx.marketingCampaign.update({
        where: { id: campaignId },
        data: { status },
      });
    });
  }

  /**
   * One draft per prospect primary contact per channel. A contact without the
   * needed phone/email, or an address already used earlier in the campaign, is
   * kept as SKIPPED so the counts explain themselves.
   */
  private async resolveRecipients(
    tenantId: string,
    businessTypeIds: string[],
    channels: CampaignChannel[],
  ) {
    const prospects = await this.prisma.marketingProspect.findMany({
      where: { tenantId, businessTypeId: { in: businessTypeIds } },
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
  private async assertActiveBusinessTypes(tenantId: string, ids: string[]) {
    const settings = await this.prisma.marketingCrmSettingOption.findMany({
      where: {
        id: { in: ids },
        tenantId,
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    const byId = new Map(settings.map((setting) => [setting.id, setting]));
    const ordered = ids.map((id) => byId.get(id));
    if (ordered.some((setting) => !setting)) {
      throw new BadRequestException(INVALID_BUSINESS_TYPE_MESSAGE);
    }
    return ordered as { id: string; name: string }[];
  }

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
      SENT: 'sent',
      FAILED: 'failed',
      SKIPPED: 'skipped',
    };
    for (const group of groups) {
      const counts = byCampaign.get(group.campaignId) ?? emptyCounts();
      counts[key[group.status]] += group._count._all;
      counts.total += group._count._all;
      byCampaign.set(group.campaignId, counts);
    }
    return byCampaign;
  }

  private toResponse(campaign: MarketingCampaign, counts?: StatusCounts) {
    return {
      id: campaign.id,
      name: campaign.name,
      channels: campaign.channels,
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
      status: campaign.status,
      recipients: counts ?? emptyCounts(),
      cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
    };
  }
}
