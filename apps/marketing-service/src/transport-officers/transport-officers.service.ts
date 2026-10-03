import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingTransportOfficer } from '../../prisma/generated/client';
import { callHr } from '../hr/call-hr';
import { DirectoryPerson, HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddTransportOfficersDto,
  QueryTransportOfficersDto,
} from './dto/transport-officer.dto';

const NOT_FOUND_MESSAGE = 'Transport officer not found';
export const NOT_AN_OFFICER_MESSAGE =
  'The selected driver is not an active transport officer';

/**
 * Transport officers are the tenant's drivers: HR employees marked as such here.
 * HR owns the person (name, department, job title); this module owns only the
 * "is a driver" flag, so details are always read live from HR.
 */
@Injectable()
export class TransportOfficersService {
  private readonly logger = new Logger(TransportOfficersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: HrDirectoryClient,
  ) {}

  async list(user: RequestUser, query: QueryTransportOfficersDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.toLowerCase();

    const [officers, people] = await Promise.all([
      this.prisma.marketingTransportOfficer.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.callHr(() => this.directory.list(user.tenantId)),
    ]);
    const peopleById = new Map(people.map((p) => [p.employeeId, p]));

    const rows = officers
      .map((officer) =>
        this.toResponse(officer, peopleById.get(officer.employeeId)),
      )
      .filter((row) => {
        if (query.status === 'ACTIVE' && !row.isActive) return false;
        if (query.status === 'INACTIVE' && row.isActive) return false;
        if (!search) return true;
        return [row.name, row.jobTitle, row.department].some((value) =>
          value?.toLowerCase().includes(search),
        );
      })
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          a.name.localeCompare(b.name),
      );

    const total = rows.length;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Employees who can still be added: active in HR and not already an officer. */
  async candidates(user: RequestUser) {
    const [officers, people] = await Promise.all([
      this.prisma.marketingTransportOfficer.findMany({
        where: { tenantId: user.tenantId },
        select: { employeeId: true },
      }),
      this.callHr(() => this.directory.list(user.tenantId)),
    ]);
    const taken = new Set(officers.map((o) => o.employeeId));
    return people.filter((person) => !taken.has(person.employeeId));
  }

  /** Adds employees as officers. Re-adding a deactivated officer reactivates them. */
  async add(user: RequestUser, dto: AddTransportOfficersDto) {
    // HR rejects the whole call if any id isn't an active employee of this tenant.
    const { people } = await this.callHr(() =>
      this.directory.resolve(user.tenantId, { employeeIds: dto.employeeIds }),
    );

    const saved = await this.prisma.$transaction(
      people.map((person) =>
        this.prisma.marketingTransportOfficer.upsert({
          where: {
            tenantId_employeeId: {
              tenantId: user.tenantId,
              employeeId: person.employeeId,
            },
          },
          create: {
            tenantId: user.tenantId,
            employeeId: person.employeeId,
            name: person.name,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          update: {
            name: person.name,
            isActive: true,
            deactivatedAt: null,
            updatedByUserId: user.id,
          },
        }),
      ),
    );

    const byId = new Map(people.map((p) => [p.employeeId, p]));
    return saved.map((officer) =>
      this.toResponse(officer, byId.get(officer.employeeId)),
    );
  }

  async setActive(user: RequestUser, id: string, isActive: boolean) {
    const existing = await this.prisma.marketingTransportOfficer.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const updated = await this.prisma.marketingTransportOfficer.update({
      where: { id },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        updatedByUserId: user.id,
      },
    });

    // Deactivating never cancels trips already approved with this driver; say so.
    const upcomingTrips = isActive
      ? 0
      : await this.prisma.marketingTransportRequest.count({
          where: {
            tenantId: user.tenantId,
            status: 'APPROVED',
            driverEmployeeId: existing.employeeId,
            travelDate: { gte: this.startOfTodayUtc() },
          },
        });

    const people = await this.callHr(() => this.directory.list(user.tenantId));
    return {
      ...this.toResponse(
        updated,
        people.find((p) => p.employeeId === updated.employeeId),
      ),
      upcomingTrips,
    };
  }

  /**
   * Active officers who are still active employees in HR: the source for every
   * driver dropdown (fleet and request allocation).
   */
  async activeDrivers(tenantId: string): Promise<DirectoryPerson[]> {
    const [officers, people] = await Promise.all([
      this.prisma.marketingTransportOfficer.findMany({
        where: { tenantId, isActive: true },
        select: { employeeId: true },
      }),
      this.callHr(() => this.directory.list(tenantId)),
    ]);
    const active = new Set(officers.map((o) => o.employeeId));
    return people.filter((person) => active.has(person.employeeId));
  }

  /** Server-side guard so a driver can't be chosen by id without being an active officer. */
  async assertActiveOfficer(tenantId: string, employeeId: string) {
    const officer = await this.prisma.marketingTransportOfficer.findFirst({
      where: { tenantId, employeeId, isActive: true },
      select: { id: true },
    });
    if (!officer) throw new BadRequestException(NOT_AN_OFFICER_MESSAGE);
  }

  private toResponse(
    officer: MarketingTransportOfficer,
    person: DirectoryPerson | undefined,
  ) {
    return {
      id: officer.id,
      employeeId: officer.employeeId,
      name: person?.name ?? officer.name,
      department: person?.department ?? null,
      jobTitle: person?.jobTitle ?? null,
      email: person?.email ?? null,
      isActive: officer.isActive,
      // False once the employee has left HR; they drop out of every dropdown.
      employeeActive: !!person,
      deactivatedAt: officer.deactivatedAt?.toISOString() ?? null,
      createdAt: officer.createdAt.toISOString(),
    };
  }

  private startOfTodayUtc() {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private callHr<T>(action: () => Promise<T>) {
    return callHr(
      this.logger,
      action,
      'Employee details are temporarily unavailable. Please try again.',
    );
  }
}
