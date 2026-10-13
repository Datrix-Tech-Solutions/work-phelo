import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollGroupsService } from './payroll-groups.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/generated/client';
import type { SavePayrollGroupDto } from './dto/save-payroll-group.dto';

const TENANT = 'tenant-1';
const USER = 'user-1';
const CONFIG_ID = '11111111-1111-4111-8111-111111111111';

const dto = (over: Partial<SavePayrollGroupDto> = {}): SavePayrollGroupDto => ({
  name: 'Regular employees',
  frequency: 'monthly',
  payday: { kind: 'last_day' },
  configurationId: CONFIG_ID,
  reminder: { enabled: true, daysBefore: 3 },
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'group-1',
  tenantId: TENANT,
  name: 'Regular employees',
  frequency: 'MONTHLY',
  paydayKind: 'LAST_DAY',
  paydayDay: null,
  configurationId: CONFIG_ID,
  reminderEnabled: true,
  reminderDaysBefore: 3,
  createdBy: USER,
  createdAt: new Date('2026-10-08T09:00:00.000Z'),
  updatedAt: new Date('2026-10-08T09:00:00.000Z'),
  _count: { employees: 0 },
  ...over,
});

function makePrisma() {
  return {
    payrollGroup: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    payrollConfiguration: {
      findFirst: jest.fn().mockResolvedValue({ id: CONFIG_ID }),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe('PayrollGroupsService', () => {
  let service: PayrollGroupsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PayrollGroupsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('lists only the tenant groups, in the shape the page uses', async () => {
      prisma.payrollGroup.findMany.mockResolvedValue([
        row(),
        row({
          id: 'group-2',
          name: 'Contractors',
          paydayKind: 'DAY_OF_MONTH',
          paydayDay: 25,
        }),
      ]);

      const groups = await service.list(TENANT);

      expect(prisma.payrollGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
      expect(groups[0]).toEqual({
        id: 'group-1',
        name: 'Regular employees',
        frequency: 'monthly',
        payday: { kind: 'last_day' },
        configurationId: CONFIG_ID,
        reminder: { enabled: true, daysBefore: 3 },
        employeeCount: 0,
      });
      expect(groups[1].payday).toEqual({ kind: 'day_of_month', day: 25 });
    });
  });

  describe('create', () => {
    it('saves a group with the columns for its payday and reminder', async () => {
      prisma.payrollGroup.create.mockResolvedValue(
        row({
          paydayKind: 'DAY_OF_MONTH',
          paydayDay: 25,
          reminderEnabled: false,
        }),
      );

      const view = await service.create(
        TENANT,
        USER,
        dto({
          name: '  Regular employees  ',
          payday: { kind: 'day_of_month', day: 25 },
          reminder: { enabled: false, daysBefore: 5 },
        }),
      );

      expect(prisma.payrollGroup.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          createdBy: USER,
          name: 'Regular employees',
          frequency: 'MONTHLY',
          paydayKind: 'DAY_OF_MONTH',
          paydayDay: 25,
          configurationId: CONFIG_ID,
          reminderEnabled: false,
          reminderDaysBefore: 5,
        },
        include: { _count: { select: { employees: true } } },
      });
      expect(view.payday).toEqual({ kind: 'day_of_month', day: 25 });
    });

    it('stores no day for the last day of the month', async () => {
      prisma.payrollGroup.create.mockResolvedValue(row());
      await service.create(
        TENANT,
        USER,
        dto({ payday: { kind: 'last_day', day: 12 } }),
      );
      const data = prisma.payrollGroup.create.mock.calls[0][0].data;
      expect(data.paydayKind).toBe('LAST_DAY');
      expect(data.paydayDay).toBeNull();
    });

    it('refuses a pay frequency that is not calculated yet', async () => {
      await expect(
        service.create(TENANT, USER, dto({ frequency: 'weekly' })),
      ).rejects.toThrow(/weekly pay isn't available yet/);
      expect(prisma.payrollGroup.create).not.toHaveBeenCalled();
    });

    it('refuses a payday outside the 1st to the 28th', async () => {
      for (const day of [0, 29, 31, 2.5]) {
        await expect(
          service.create(
            TENANT,
            USER,
            dto({ payday: { kind: 'day_of_month', day } }),
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(
        service.create(TENANT, USER, dto({ payday: { kind: 'day_of_month' } })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a reminder set too far ahead', async () => {
      await expect(
        service.create(
          TENANT,
          USER,
          dto({ reminder: { enabled: true, daysBefore: 45 } }),
        ),
      ).rejects.toThrow(/up to 30 days/);
    });

    it("refuses a configuration that doesn't exist for the tenant", async () => {
      prisma.payrollConfiguration.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT, USER, dto())).rejects.toThrow(
        'Choose a payroll configuration that exists.',
      );
      expect(prisma.payrollConfiguration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CONFIG_ID, tenantId: TENANT } }),
      );
    });

    it('refuses a name another group has, ignoring case', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue({ id: 'group-9' });

      await expect(
        service.create(TENANT, USER, dto({ name: 'REGULAR EMPLOYEES' })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.payrollGroup.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT,
          name: { equals: 'REGULAR EMPLOYEES', mode: 'insensitive' },
        },
        select: { id: true },
      });
    });

    it('turns the database name rule into the same conflict when two saves race', async () => {
      prisma.payrollGroup.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(TENANT, USER, dto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('lets a group keep its own name', async () => {
      prisma.payrollGroup.findFirst
        .mockResolvedValueOnce(row()) // the group being edited
        .mockResolvedValueOnce(null); // no other group with that name
      prisma.payrollGroup.update.mockResolvedValue(
        row({ reminderDaysBefore: 7 }),
      );

      const view = await service.update(
        TENANT,
        'group-1',
        dto({ reminder: { enabled: true, daysBefore: 7 } }),
      );

      expect(prisma.payrollGroup.findFirst).toHaveBeenLastCalledWith({
        where: {
          tenantId: TENANT,
          name: { equals: 'Regular employees', mode: 'insensitive' },
          id: { not: 'group-1' },
        },
        select: { id: true },
      });
      expect(view.reminder.daysBefore).toBe(7);
    });

    it("404s for another tenant's group", async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, 'other', dto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.payrollGroup.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a tenant group', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(row());
      expect(await service.remove(TENANT, 'group-1')).toEqual({
        deleted: true,
      });
      expect(prisma.payrollGroup.delete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
    });

    it('404s for an unknown group', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(null);
      await expect(service.remove(TENANT, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.payrollGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe('employees in a group', () => {
    const member = (
      id: string,
      compensationType: string,
      firstName = 'Ama',
    ) => ({
      id,
      firstName,
      lastName: 'Mensah',
      compensationType,
    });
    const groupWithConfig = (payslipType: string | null) => ({
      ...row(),
      configuration: { payslipType },
    });

    it('counts the members of each group', async () => {
      prisma.payrollGroup.findMany.mockResolvedValue([
        row({ _count: { employees: 4 } }),
      ]);
      const [group] = await service.list(TENANT);
      expect(group.employeeCount).toBe(4);
    });

    it('moves the listed employees in and takes everyone else out', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY'),
      );
      prisma.employee.findMany.mockResolvedValue([
        member('e1', 'SALARY'),
        member('e2', 'SALARY'),
      ]);

      const result = await service.setEmployees(TENANT, 'group-1', [
        'e1',
        'e2',
        'e1',
      ]);

      expect(result).toEqual({ assigned: 2 });
      expect(prisma.employee.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT,
          payrollGroupId: 'group-1',
          id: { notIn: ['e1', 'e2'] },
        },
        data: { payrollGroupId: null },
      });
      expect(prisma.employee.updateMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, id: { in: ['e1', 'e2'] } },
        data: { payrollGroupId: 'group-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('can empty a group', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY'),
      );
      const result = await service.setEmployees(TENANT, 'group-1', []);
      expect(result).toEqual({ assigned: 0 });
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });

    it('only looks up employees of the same company', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY'),
      );
      prisma.employee.findMany.mockResolvedValue([member('e1', 'SALARY')]);
      await service.setEmployees(TENANT, 'group-1', ['e1']);
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['e1'] }, tenantId: TENANT },
        }),
      );
    });

    it('refuses employees it cannot find', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY'),
      );
      prisma.employee.findMany.mockResolvedValue([member('e1', 'SALARY')]);
      await expect(
        service.setEmployees(TENANT, 'group-1', ['e1', 'ghost']),
      ).rejects.toThrow('Some of those employees could not be found.');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses employees who aren't paid the way the group's configuration pays", async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY'),
      );
      prisma.employee.findMany.mockResolvedValue([
        member('e1', 'SALARY'),
        member('e2', 'COMMISSION', 'Kofi'),
      ]);
      await expect(
        service.setEmployees(TENANT, 'group-1', ['e1', 'e2']),
      ).rejects.toThrow(
        /Kofi Mensah isn't paid the way this group's configuration pays \(Salary\)/,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('matches Salary + Commission employees to a Salary + Commission configuration', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(
        groupWithConfig('MONTHLY_COMMISSION'),
      );
      prisma.employee.findMany.mockResolvedValue([
        member('e1', 'SALARY_PLUS_COMMISSION'),
      ]);
      await expect(
        service.setEmployees(TENANT, 'group-1', ['e1']),
      ).resolves.toEqual({
        assigned: 1,
      });
    });

    it('404s for a group of another company', async () => {
      prisma.payrollGroup.findFirst.mockResolvedValue(null);
      await expect(
        service.setEmployees(TENANT, 'nope', []),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a new configuration that does not fit the people already in the group', async () => {
      prisma.payrollGroup.findFirst
        .mockResolvedValueOnce(row()) // the group being edited
        .mockResolvedValueOnce(null); // no name clash
      prisma.payrollConfiguration.findFirst
        .mockResolvedValueOnce({ id: CONFIG_ID }) // the new configuration exists
        .mockResolvedValueOnce({ payslipType: 'COMMISSION' });
      prisma.employee.findMany.mockResolvedValue([member('e1', 'SALARY')]);

      await expect(
        service.update(
          TENANT,
          'group-1',
          dto({ configurationId: '22222222-2222-4222-8222-222222222222' }),
        ),
      ).rejects.toThrow(
        /pays Commission, but 1 employee in the group is paid another way/,
      );
      expect(prisma.payrollGroup.update).not.toHaveBeenCalled();
    });
  });
});
