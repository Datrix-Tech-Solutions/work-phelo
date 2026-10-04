import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION];

const SELECT = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  email: true,
  jobTitle: true,
  department: { select: { name: true } },
} as const;

type EmployeeRow = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  department: { name: string } | null;
};

const toPerson = (employee: EmployeeRow) => ({
  employeeId: employee.id,
  /** The login account linked to the employee, when there is one. */
  userId: employee.userId,
  name: `${employee.firstName} ${employee.lastName}`,
  department: employee.department?.name ?? null,
  jobTitle: employee.jobTitle ?? null,
  email: employee.email,
});

/**
 * Read-only employee lookups for other services (e.g. marketing transport
 * requests) that need names and departments without HR access. Deliberately
 * excludes the encrypted personal fields (phone, address, ids, bank details).
 */
@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: { in: ACTIVE_STATUSES } },
      select: SELECT,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return employees.map(toPerson);
  }

  /**
   * `person` is the employee linked to `userId`, or null when that user has no
   * employee record. `people` are the requested employees; every one must be an
   * active employee of the tenant or the whole call fails.
   */
  async resolve(
    tenantId: string,
    input: { userId?: string; employeeIds?: string[]; userIds?: string[] },
  ) {
    const person = input.userId
      ? await this.prisma.employee.findFirst({
          where: { tenantId, userId: input.userId },
          select: SELECT,
        })
      : null;

    const ids = [...new Set(input.employeeIds ?? [])];
    const employees = ids.length
      ? await this.prisma.employee.findMany({
          where: {
            tenantId,
            id: { in: ids },
            employmentStatus: { in: ACTIVE_STATUSES },
          },
          select: SELECT,
        })
      : [];

    if (employees.length !== ids.length) {
      throw new NotFoundException('One or more employees were not found');
    }

    // Users asked for by account: each must be an active employee of the tenant.
    const userIds = [...new Set(input.userIds ?? [])];
    const byUser = userIds.length
      ? await this.prisma.employee.findMany({
          where: {
            tenantId,
            userId: { in: userIds },
            employmentStatus: { in: ACTIVE_STATUSES },
          },
          select: SELECT,
        })
      : [];
    if (byUser.length !== userIds.length) {
      throw new NotFoundException('One or more users were not found');
    }

    return {
      person: person ? toPerson(person) : null,
      people: [...employees, ...byUser].map(toPerson),
    };
  }
}
