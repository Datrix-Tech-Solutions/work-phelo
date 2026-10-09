import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCampaignStatus,
  MarketingSmsSenderIdentity,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSmsSenderIdentityDto,
  QuerySmsSenderIdentitiesDto,
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
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QuerySmsSenderIdentitiesDto = {}) {
    const where: Prisma.MarketingSmsSenderIdentityWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
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
    const approved = await this.prisma.marketingSmsSenderIdentity.update({
      where: { id },
      data: {
        status: 'APPROVED',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'UNKNOWN',
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    return this.toResponse(approved);
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
    if (!id) return null;
    return this.prisma.marketingSmsSenderIdentity.findFirst({
      where: { id, tenantId, status: 'APPROVED' },
    });
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
}
