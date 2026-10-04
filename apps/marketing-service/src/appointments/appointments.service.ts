import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingAppointmentStatus as Status,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentNotifier } from './appointment-notifier.service';
import { AuthDirectoryClient, ModuleUser } from './auth-directory.client';
import {
  AppointmentFormOptionsQueryDto,
  ApproveAppointmentDto,
  CreateAppointmentDto,
  QueryAppointmentsDto,
  ReviewAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

const NOT_FOUND_MESSAGE = 'Appointment not found';
/** An appointment without an end time is treated as this long when checking for clashes. */
const DEFAULT_DURATION_MINUTES = 60;
const PROSPECT_OPTION_LIMIT = 100;

type AppointmentRow = Prisma.MarketingAppointmentGetPayload<object>;

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: AuthDirectoryClient,
    private readonly notifier: AppointmentNotifier,
  ) {}

  async list(user: RequestUser, query: QueryAppointmentsDto = {}) {
    const where: Prisma.MarketingAppointmentWhereInput = {
      tenantId: user.tenantId,
      ...this.visibilityWhere(user),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: toDate(query.from) } : {}),
              ...(query.to ? { lte: toDate(query.to) } : {}),
            },
          }
        : {}),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.marketerUserId ? { marketerUserId: query.marketerUserId } : {}),
      ...(query.prospectId ? { prospectId: query.prospectId } : {}),
    };

    const rows = await this.prisma.marketingAppointment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      ...(query.limit ? { take: query.limit } : {}),
    });
    return { data: await this.respondAll(user.tenantId, rows) };
  }

  async findOne(user: RequestUser, id: string) {
    const row = await this.prisma.marketingAppointment.findFirst({
      where: { id, tenantId: user.tenantId, ...this.visibilityWhere(user) },
    });
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return this.respond(user.tenantId, row);
  }

  /**
   * What the form may offer this caller. Without create-for-others they can only book for
   * themselves, from their own prospects; with it they can pick any marketer, and the prospects
   * shown are that marketer's. Managers are only listed to people who can approve.
   */
  async formOptions(user: RequestUser, query: AppointmentFormOptionsQueryDto) {
    const canCreateForOthers = this.canCreateForOthers(user);
    const canApprove = this.canApprove(user);
    const people =
      canCreateForOthers || canApprove ? await this.moduleUsers(user) : [];

    const marketerId = canCreateForOthers
      ? (query.marketerUserId ?? user.id)
      : user.id;

    const prospects = await this.prisma.marketingProspect.findMany({
      where: {
        tenantId: user.tenantId,
        assignedUserId: marketerId,
        ...(query.search
          ? { companyName: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      select: { id: true, companyName: true },
      orderBy: { companyName: 'asc' },
      take: PROSPECT_OPTION_LIMIT,
    });

    return {
      canCreateForOthers,
      canApprove,
      currentUser: { id: user.id, name: this.selfName(user, people) },
      marketerUserId: marketerId,
      marketers: canCreateForOthers
        ? people.map((p) => this.person(p))
        : [{ id: user.id, name: this.selfName(user, people) }],
      managers: canApprove ? people.map((p) => this.person(p)) : [],
      prospects: prospects.map((p) => ({ id: p.id, name: p.companyName })),
    };
  }

  async create(user: RequestUser, dto: CreateAppointmentDto) {
    const marketerUserId = this.resolveMarketer(user, dto.marketerUserId);
    this.assertTimes(dto.startTime, dto.endTime);

    const [marketerName, prospect] = await Promise.all([
      this.nameFor(user, marketerUserId),
      this.assignedProspect(user, dto.prospectId, marketerUserId),
    ]);

    const row = await this.prisma.marketingAppointment.create({
      data: {
        tenantId: user.tenantId,
        prospectId: prospect.id,
        prospectName: prospect.companyName,
        date: toDate(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime || null,
        marketerUserId,
        marketerName,
        comment: dto.comment || null,
        createdByUserId: user.id,
      },
    });
    // Tell the approvers (best-effort, not awaited so the booking returns straight away).
    void this.notifier.requested(row, user.id);
    return this.respond(user.tenantId, row);
  }

  /** Pending only. The marketer (or who booked it) edits their own; create-for-others edits any. */
  async update(user: RequestUser, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.findForActor(user, id, 'edit');
    if (existing.status !== Status.PENDING) {
      throw new ConflictException('Only pending appointments can be edited');
    }

    const startTime = dto.startTime ?? existing.startTime;
    const endTime =
      dto.endTime === undefined ? existing.endTime : dto.endTime || null;
    this.assertTimes(startTime, endTime ?? undefined);

    const prospect =
      dto.prospectId && dto.prospectId !== existing.prospectId
        ? await this.assignedProspect(
            user,
            dto.prospectId,
            existing.marketerUserId,
          )
        : null;

    const row = await this.prisma.marketingAppointment.update({
      where: { id },
      data: {
        ...(prospect
          ? { prospectId: prospect.id, prospectName: prospect.companyName }
          : {}),
        ...(dto.date ? { date: toDate(dto.date) } : {}),
        startTime,
        endTime,
        ...(dto.comment !== undefined ? { comment: dto.comment || null } : {}),
      },
    });
    return this.respond(user.tenantId, row);
  }

  async approve(user: RequestUser, id: string, dto: ApproveAppointmentDto) {
    const existing = await this.getReviewable(user, id);

    let manager: { id: string; name: string } | null = null;
    if (dto.managerUserId) {
      const people = await this.moduleUsers(user);
      const found = people.find((p) => p.id === dto.managerUserId);
      if (!found) {
        throw new BadRequestException(
          'The manager must be someone with marketing access',
        );
      }
      manager = this.person(found);
      await this.assertManagerFree(existing, manager.id);
    }

    const row = await this.prisma.marketingAppointment.update({
      where: { id },
      data: {
        status: Status.APPROVED,
        managerUserId: manager?.id ?? null,
        managerName: manager?.name ?? null,
        reviewedByUserId: user.id,
        reviewedByName: await this.nameFor(user, user.id),
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote || null,
      },
    });
    void this.notifier.reviewed(row, user.id, 'APPROVED');
    return this.respond(user.tenantId, row);
  }

  async reject(user: RequestUser, id: string, dto: ReviewAppointmentDto) {
    await this.getReviewable(user, id);
    const row = await this.prisma.marketingAppointment.update({
      where: { id },
      data: {
        status: Status.REJECTED,
        reviewedByUserId: user.id,
        reviewedByName: await this.nameFor(user, user.id),
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote || null,
      },
    });
    void this.notifier.reviewed(row, user.id, 'REJECTED');
    return this.respond(user.tenantId, row);
  }

  /** The marketer or whoever booked it can cancel; so can an approver. */
  async cancel(user: RequestUser, id: string) {
    const existing = await this.findForActor(user, id, 'cancel');
    if (
      existing.status !== Status.PENDING &&
      existing.status !== Status.APPROVED
    ) {
      throw new ConflictException(
        'Only pending or approved appointments can be cancelled',
      );
    }
    const row = await this.prisma.marketingAppointment.update({
      where: { id },
      data: { status: Status.CANCELLED, cancelledAt: new Date() },
    });
    return this.respond(user.tenantId, row);
  }

  /** Marks an approved appointment as held. Final. */
  async complete(user: RequestUser, id: string) {
    const existing = await this.findForActor(user, id, 'complete');
    if (existing.status !== Status.APPROVED) {
      throw new ConflictException(
        'Only approved appointments can be completed',
      );
    }
    const row = await this.prisma.marketingAppointment.update({
      where: { id },
      data: { status: Status.COMPLETED, completedAt: new Date() },
    });
    return this.respond(user.tenantId, row);
  }

  // --- rules ---------------------------------------------------------------

  /** Everyone books for themselves; naming anyone else needs create-for-others. */
  private resolveMarketer(user: RequestUser, requested?: string) {
    if (!requested || requested === user.id) return user.id;
    if (!this.canCreateForOthers(user)) {
      throw new ForbiddenException(
        'You can only book appointments for yourself',
      );
    }
    return requested;
  }

  private assertTimes(startTime: string, endTime?: string) {
    if (endTime && endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }
  }

  /** The prospect must be one the marketer is assigned to. */
  private async assignedProspect(
    user: RequestUser,
    prospectId: string,
    marketerUserId: string,
  ) {
    const prospect = await this.prisma.marketingProspect.findFirst({
      where: {
        id: prospectId,
        tenantId: user.tenantId,
        assignedUserId: marketerUserId,
      },
      select: { id: true, companyName: true },
    });
    if (!prospect) {
      throw new BadRequestException(
        'Choose one of the marketer’s assigned prospects',
      );
    }
    return prospect;
  }

  /** Approved appointments for the same manager on the same day that overlap this one. */
  private async assertManagerFree(
    appointment: AppointmentRow,
    managerUserId: string,
  ) {
    const others = await this.prisma.marketingAppointment.findMany({
      where: {
        tenantId: appointment.tenantId,
        status: Status.APPROVED,
        managerUserId,
        date: appointment.date,
        id: { not: appointment.id },
      },
      select: { startTime: true, endTime: true },
    });
    const window = (a: { startTime: string; endTime: string | null }) => {
      const start = minutes(a.startTime);
      return {
        start,
        end: a.endTime ? minutes(a.endTime) : start + DEFAULT_DURATION_MINUTES,
      };
    };
    const mine = window(appointment);
    const clash = others.some((o) => {
      const other = window(o);
      return other.start < mine.end && other.end > mine.start;
    });
    if (clash) {
      throw new ConflictException(
        'That manager already has an approved appointment at this time',
      );
    }
  }

  // --- access --------------------------------------------------------------

  private async getReviewable(user: RequestUser, id: string) {
    const existing = await this.prisma.marketingAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND_MESSAGE);
    if (existing.status !== Status.PENDING) {
      throw new ConflictException('Only pending appointments can be reviewed');
    }
    return existing;
  }

  /**
   * Edit/cancel/complete: the marketer, whoever booked it, or the manager (complete only) may
   * act; so can approvers (cancel/complete) and create-for-others holders (edit). Anyone else
   * gets the same answer as for a missing id, so ids can't be probed.
   */
  private async findForActor(
    user: RequestUser,
    id: string,
    action: 'edit' | 'cancel' | 'complete',
  ) {
    const row = await this.prisma.marketingAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    const own =
      row &&
      (row.marketerUserId === user.id || row.createdByUserId === user.id);
    const allowed =
      row &&
      (own ||
        (action === 'edit' && this.canCreateForOthers(user)) ||
        (action !== 'edit' && this.canApprove(user)) ||
        (action === 'complete' && row.managerUserId === user.id));
    if (!row || !allowed) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return row;
  }

  private visibilityWhere(
    user: RequestUser,
  ): Prisma.MarketingAppointmentWhereInput {
    if (this.canViewAll(user)) return {};
    return {
      OR: [{ marketerUserId: user.id }, { managerUserId: user.id }],
    };
  }

  private hasPermission(user: RequestUser, permission: string) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;
    return user.permissions.includes(permission);
  }

  private canViewAll(user: RequestUser) {
    return (
      this.hasPermission(
        user,
        MarketingCrmSettingsPermission.APPOINTMENTS_VIEW_ALL,
      ) || this.canApprove(user)
    );
  }

  private canCreateForOthers(user: RequestUser) {
    return this.hasPermission(
      user,
      MarketingCrmSettingsPermission.APPOINTMENTS_CREATE_ALL,
    );
  }

  private canApprove(user: RequestUser) {
    return this.hasPermission(
      user,
      MarketingCrmSettingsPermission.APPOINTMENTS_APPROVE_ALL,
    );
  }

  // --- people --------------------------------------------------------------

  private async moduleUsers(user: RequestUser): Promise<ModuleUser[]> {
    try {
      const users = await this.directory.moduleUsers(user.tenantId);
      return users.filter((u) => u.status === 'ACTIVE');
    } catch (error) {
      if (!(error instanceof InternalServiceClientError)) throw error;
      this.logger.error(`auth-service call failed: ${error.message}`);
      throw new BadGatewayException(
        'This is temporarily unavailable. Please try again.',
      );
    }
  }

  private person(u: ModuleUser) {
    return { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() };
  }

  private selfName(user: RequestUser, people: ModuleUser[]) {
    const me = people.find((p) => p.id === user.id);
    return me ? this.person(me).name : user.firstName;
  }

  /** The name to snapshot for a user; someone else must have marketing access. */
  private async nameFor(user: RequestUser, userId: string) {
    const people = await this.moduleUsers(user);
    if (userId === user.id) return this.selfName(user, people);
    const found = people.find((p) => p.id === userId);
    if (!found) {
      throw new BadRequestException(
        'The marketer must be someone with marketing access',
      );
    }
    return this.person(found).name;
  }

  private async respond(tenantId: string, row: AppointmentRow) {
    const [response] = await this.respondAll(tenantId, [row]);
    return response;
  }

  /** Adds each prospect's current sales stage, looked up live so it follows stage changes. */
  private async respondAll(tenantId: string, rows: AppointmentRow[]) {
    const prospectIds = [
      ...new Set(
        rows.map((r) => r.prospectId).filter((id): id is string => !!id),
      ),
    ];
    const prospects = prospectIds.length
      ? await this.prisma.marketingProspect.findMany({
          where: { tenantId, id: { in: prospectIds } },
          select: { id: true, pipelineStageId: true },
        })
      : [];
    const stages = prospects.length
      ? await this.prisma.marketingPipelineStage.findMany({
          where: {
            tenantId,
            id: { in: [...new Set(prospects.map((p) => p.pipelineStageId))] },
          },
          select: { id: true, name: true, probability: true },
        })
      : [];
    const stageById = new Map(stages.map((st) => [st.id, st]));
    const stageByProspect = new Map(
      prospects.map((p) => [p.id, stageById.get(p.pipelineStageId) ?? null]),
    );
    return rows.map((row) =>
      this.toResponse(
        row,
        row.prospectId ? (stageByProspect.get(row.prospectId) ?? null) : null,
      ),
    );
  }

  private toResponse(
    row: AppointmentRow,
    salesStage: { id: string; name: string; probability: number } | null,
  ) {
    return {
      id: row.id,
      prospectId: row.prospectId,
      prospectName: row.prospectName,
      salesStage,
      date: toIso(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      marketerUserId: row.marketerUserId,
      marketerName: row.marketerName,
      managerUserId: row.managerUserId,
      managerName: row.managerName,
      comment: row.comment,
      status: row.status,
      reviewedByName: row.reviewedByName,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
