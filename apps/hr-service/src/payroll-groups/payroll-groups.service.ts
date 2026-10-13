import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COMPENSATION_PAYSLIP_TYPE,
  PAYSLIP_TYPES,
  type CompensationType,
} from '@work-phelo/payroll-engine';
import { PrismaService } from '../prisma/prisma.service';
import {
  PayrollPayFrequency,
  PayrollPaydayKind,
  Prisma,
} from '../../prisma/generated/client';
import {
  MAX_PAYDAY_DAY,
  MAX_REMINDER_DAYS,
  type PayFrequencyKey,
} from './payroll-groups.constants';
import type { SavePayrollGroupDto } from './dto/save-payroll-group.dto';

export interface PayrollGroupView {
  id: string;
  name: string;
  frequency: PayFrequencyKey;
  payday: { kind: 'day_of_month'; day: number } | { kind: 'last_day' };
  configurationId: string;
  reminder: { enabled: boolean; daysBefore: number };
  employeeCount: number;
}

type GroupRow = Prisma.PayrollGroupGetPayload<{
  include: { _count: { select: { employees: true } } };
}>;

const INCLUDE_COUNT = { _count: { select: { employees: true } } } as const;

const FREQUENCY_TO_ENUM: Record<PayFrequencyKey, PayrollPayFrequency> = {
  monthly: PayrollPayFrequency.MONTHLY,
  biweekly: PayrollPayFrequency.BIWEEKLY,
  weekly: PayrollPayFrequency.WEEKLY,
};
const ENUM_TO_FREQUENCY: Record<PayrollPayFrequency, PayFrequencyKey> = {
  MONTHLY: 'monthly',
  BIWEEKLY: 'biweekly',
  WEEKLY: 'weekly',
};

function toView(row: GroupRow): PayrollGroupView {
  return {
    id: row.id,
    name: row.name,
    frequency: ENUM_TO_FREQUENCY[row.frequency],
    payday:
      row.paydayKind === PayrollPaydayKind.LAST_DAY
        ? { kind: 'last_day' }
        : { kind: 'day_of_month', day: row.paydayDay ?? 1 },
    configurationId: row.configurationId,
    reminder: {
      enabled: row.reminderEnabled,
      daysBefore: row.reminderDaysBefore,
    },
    employeeCount: row._count.employees,
  };
}

@Injectable()
export class PayrollGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<PayrollGroupView[]> {
    const rows = await this.prisma.payrollGroup.findMany({
      where: { tenantId },
      include: INCLUDE_COUNT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toView);
  }

  async create(
    tenantId: string,
    userId: string,
    dto: SavePayrollGroupDto,
  ): Promise<PayrollGroupView> {
    await this.check(tenantId, dto);
    try {
      const row = await this.prisma.payrollGroup.create({
        data: { tenantId, createdBy: userId, ...this.fields(dto) },
        include: INCLUDE_COUNT,
      });
      return toView(row);
    } catch (e) {
      throw this.nameClash(e);
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: SavePayrollGroupDto,
  ): Promise<PayrollGroupView> {
    const existing = await this.findOrThrow(tenantId, id);
    await this.check(tenantId, dto, id);
    // Everyone in the group is paid through its configuration, so a new one has to fit them all.
    if (existing.configurationId !== dto.configurationId) {
      await this.assertMembersFit(tenantId, id, dto.configurationId);
    }
    try {
      const row = await this.prisma.payrollGroup.update({
        where: { id },
        data: this.fields(dto),
        include: INCLUDE_COUNT,
      });
      return toView(row);
    } catch (e) {
      throw this.nameClash(e);
    }
  }

  /** Employees deleted with the group are not deleted, only left without a group. */
  async remove(tenantId: string, id: string) {
    await this.findOrThrow(tenantId, id);
    await this.prisma.payrollGroup.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Members ──────────────────────────────────────────────────────────────

  /**
   * Sets who is in the group. Anyone listed is moved here from whichever group they were in, and
   * anyone not listed is taken out. Only employees paid the way the group's configuration pays
   * (its payslip type) can join.
   */
  async setEmployees(tenantId: string, id: string, employeeIds: string[]) {
    const group = await this.prisma.payrollGroup.findFirst({
      where: { id, tenantId },
      include: { configuration: { select: { payslipType: true } } },
    });
    if (!group) throw new NotFoundException('Payroll group not found');

    const ids = [...new Set(employeeIds)];
    const employees = ids.length
      ? await this.prisma.employee.findMany({
          where: { id: { in: ids }, tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            compensationType: true,
          },
        })
      : [];
    if (employees.length !== ids.length) {
      throw new BadRequestException(
        'Some of those employees could not be found.',
      );
    }

    const requiredType = this.requiredType(group.configuration.payslipType);
    const misfits = employees.filter(
      (e) =>
        COMPENSATION_PAYSLIP_TYPE[e.compensationType as CompensationType] !==
        requiredType,
    );
    if (misfits.length) {
      throw new BadRequestException(
        `${misfits.map((e) => `${e.firstName} ${e.lastName}`).join(', ')} ` +
          `${misfits.length === 1 ? "isn't" : "aren't"} paid the way this group's configuration ` +
          `pays (${PAYSLIP_TYPES[requiredType].label}).`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.employee.updateMany({
        where: { tenantId, payrollGroupId: id, id: { notIn: ids } },
        data: { payrollGroupId: null },
      }),
      this.prisma.employee.updateMany({
        where: { tenantId, id: { in: ids } },
        data: { payrollGroupId: id },
      }),
    ]);
    return { assigned: ids.length };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** The columns a group is saved with. */
  private fields(dto: SavePayrollGroupDto) {
    return {
      name: dto.name.trim(),
      frequency: FREQUENCY_TO_ENUM[dto.frequency],
      paydayKind:
        dto.payday.kind === 'last_day'
          ? PayrollPaydayKind.LAST_DAY
          : PayrollPaydayKind.DAY_OF_MONTH,
      paydayDay:
        dto.payday.kind === 'last_day' ? null : (dto.payday.day ?? null),
      configurationId: dto.configurationId,
      reminderEnabled: dto.reminder.enabled,
      reminderDaysBefore: dto.reminder.daysBefore,
    };
  }

  /** Rules the request shape can't express. */
  private async check(
    tenantId: string,
    dto: SavePayrollGroupDto,
    ownId?: string,
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Give the group a name.');

    // Only monthly pay is calculated so far, so another frequency would never be run.
    if (dto.frequency !== 'monthly') {
      throw new BadRequestException(
        `${dto.frequency} pay isn't available yet. Choose monthly.`,
      );
    }

    if (dto.payday.kind === 'day_of_month') {
      const day = dto.payday.day;
      if (
        day === undefined ||
        !Number.isInteger(day) ||
        day < 1 ||
        day > MAX_PAYDAY_DAY
      ) {
        throw new BadRequestException(
          `Choose a payday from the 1st to the ${MAX_PAYDAY_DAY}th, or the last day of the month.`,
        );
      }
    }
    if (dto.reminder.daysBefore > MAX_REMINDER_DAYS) {
      throw new BadRequestException(
        `A reminder can be up to ${MAX_REMINDER_DAYS} days before payday.`,
      );
    }

    const configuration = await this.prisma.payrollConfiguration.findFirst({
      where: { id: dto.configurationId, tenantId },
      select: { id: true },
    });
    if (!configuration) {
      throw new BadRequestException(
        'Choose a payroll configuration that exists.',
      );
    }

    // Names are compared ignoring case, so "Regular employees" and "regular employees" clash.
    const clash = await this.prisma.payrollGroup.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(ownId ? { id: { not: ownId } } : {}),
      },
      select: { id: true },
    });
    if (clash)
      throw new ConflictException('Another group already has that name.');
  }

  /** Two requests racing past the check still hit the database's own unique name rule. */
  private nameClash(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Another group already has that name.');
    }
    return error;
  }

  private requiredType(payslipType: string | null) {
    const type = (
      payslipType ?? ''
    ).toLowerCase() as keyof typeof PAYSLIP_TYPES;
    if (!(type in PAYSLIP_TYPES)) {
      throw new BadRequestException(
        "This group's configuration has no payslip type.",
      );
    }
    return type;
  }

  /** Every employee already in the group must be paid the way the new configuration pays. */
  private async assertMembersFit(
    tenantId: string,
    groupId: string,
    configurationId: string,
  ) {
    const configuration = await this.prisma.payrollConfiguration.findFirst({
      where: { id: configurationId, tenantId },
      select: { payslipType: true },
    });
    const requiredType = this.requiredType(configuration?.payslipType ?? null);
    const members = await this.prisma.employee.findMany({
      where: { tenantId, payrollGroupId: groupId },
      select: { firstName: true, lastName: true, compensationType: true },
    });
    const misfits = members.filter(
      (e) =>
        COMPENSATION_PAYSLIP_TYPE[e.compensationType as CompensationType] !==
        requiredType,
    );
    if (misfits.length) {
      throw new BadRequestException(
        `That configuration pays ${PAYSLIP_TYPES[requiredType].label}, but ${misfits.length} ` +
          `${misfits.length === 1 ? 'employee in the group is' : 'employees in the group are'} ` +
          'paid another way. Take them out of the group first.',
      );
    }
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.payrollGroup.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Payroll group not found');
    return row;
  }
}
