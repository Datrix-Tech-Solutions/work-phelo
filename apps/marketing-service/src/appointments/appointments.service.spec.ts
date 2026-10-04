import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { AppointmentsService } from './appointments.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const AMA = '22222222-2222-4222-8222-222222222222';
const KOFI = '33333333-3333-4333-8333-333333333333';
const MANAGER = '44444444-4444-4444-8444-444444444444';
const PROSPECT = '55555555-5555-4555-8555-555555555555';

const user = (overrides: Partial<RequestUser> = {}) =>
  ({
    id: AMA,
    tenantId: TENANT,
    firstName: 'Ama',
    role: 'USER',
    permissions: [],
    ...overrides,
  }) as RequestUser;

const people = [
  {
    id: AMA,
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'a@x.com',
    status: 'ACTIVE',
  },
  {
    id: KOFI,
    firstName: 'Kofi',
    lastName: 'Boateng',
    email: 'k@x.com',
    status: 'ACTIVE',
  },
  {
    id: MANAGER,
    firstName: 'Abena',
    lastName: 'Sarpong',
    email: 'm@x.com',
    status: 'ACTIVE',
  },
];

const createDto = {
  prospectId: PROSPECT,
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '10:00',
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    tenantId: TENANT,
    prospectId: PROSPECT,
    prospectName: 'Accra Brewing Co.',
    date: new Date('2026-10-20T00:00:00.000Z'),
    startTime: '09:00',
    endTime: '10:00',
    marketerUserId: AMA,
    marketerName: 'Ama Mensah',
    managerUserId: null,
    managerName: null,
    comment: null,
    status: 'PENDING',
    createdByUserId: AMA,
    reviewedByUserId: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

type FindManyArg = { where: Record<string, unknown> };
const prospectWhere = (fn: jest.Mock) =>
  (fn.mock.calls[0] as [FindManyArg])[0].where;

describe('AppointmentsService', () => {
  const prisma = {
    marketingAppointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketingProspect: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const directory = { moduleUsers: jest.fn() };
  let service: AppointmentsService;

  beforeEach(() => {
    jest.resetAllMocks();
    directory.moduleUsers.mockResolvedValue(people);
    prisma.marketingProspect.findFirst.mockResolvedValue({
      id: PROSPECT,
      companyName: 'Accra Brewing Co.',
    });
    prisma.marketingAppointment.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(row(data)),
    );
    prisma.marketingAppointment.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(row(data)),
    );
    service = new AppointmentsService(prisma as never, directory as never);
  });

  describe('create', () => {
    it('books for the caller and checks the prospect is theirs', async () => {
      const result = await service.create(user(), createDto);

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROSPECT, tenantId: TENANT, assignedUserId: AMA },
        }),
      );
      expect(result.marketerUserId).toBe(AMA);
      expect(result.marketerName).toBe('Ama Mensah');
      expect(result.status).toBe('PENDING');
    });

    it('refuses to book for someone else without create-for-others', async () => {
      await expect(
        service.create(user(), { ...createDto, marketerUserId: KOFI }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.marketingAppointment.create).not.toHaveBeenCalled();
    });

    it('lets a create-for-others holder book for another marketer', async () => {
      const caller = user({ permissions: [P.APPOINTMENTS_CREATE_ALL] });

      const result = await service.create(caller, {
        ...createDto,
        marketerUserId: KOFI,
      });

      expect(prisma.marketingProspect.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROSPECT, tenantId: TENANT, assignedUserId: KOFI },
        }),
      );
      expect(result.marketerUserId).toBe(KOFI);
      expect(result.marketerName).toBe('Kofi Boateng');
    });

    it('rejects a marketer without marketing access', async () => {
      const caller = user({ permissions: [P.APPOINTMENTS_CREATE_ALL] });

      await expect(
        service.create(caller, {
          ...createDto,
          marketerUserId: '66666666-6666-4666-8666-666666666666',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a prospect that is not assigned to the marketer', async () => {
      prisma.marketingProspect.findFirst.mockResolvedValue(null);

      await expect(service.create(user(), createDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an end time that is not after the start time', async () => {
      await expect(
        service.create(user(), { ...createDto, endTime: '09:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows no end time', async () => {
      const result = await service.create(user(), {
        ...createDto,
        endTime: undefined,
      });
      expect(result.endTime).toBeNull();
    });
  });

  describe('list', () => {
    it('limits a normal user to appointments they are on', async () => {
      prisma.marketingAppointment.findMany.mockResolvedValue([]);

      await service.list(user(), { from: '2026-10-01', to: '2026-10-31' });

      const where = (
        prisma.marketingAppointment.findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;
      expect(where.OR).toEqual([
        { marketerUserId: AMA },
        { managerUserId: AMA },
      ]);
      expect(where.tenantId).toBe(TENANT);
    });

    it('shows everyone’s to a view-all holder', async () => {
      prisma.marketingAppointment.findMany.mockResolvedValue([]);

      await service.list(user({ permissions: [P.APPOINTMENTS_VIEW_ALL] }));

      const where = (
        prisma.marketingAppointment.findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;
      expect(where.OR).toBeUndefined();
    });
  });

  describe('formOptions', () => {
    it('offers a normal user only themselves and their prospects', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        { id: PROSPECT, companyName: 'Accra Brewing Co.' },
      ]);

      const result = await service.formOptions(user(), {
        marketerUserId: KOFI,
      });

      expect(directory.moduleUsers).not.toHaveBeenCalled();
      expect(result.canCreateForOthers).toBe(false);
      expect(result.marketers).toEqual([{ id: AMA, name: 'Ama' }]);
      expect(result.managers).toEqual([]);
      expect(
        prospectWhere(prisma.marketingProspect.findMany).assignedUserId,
      ).toBe(AMA);
    });

    it('offers a create-for-others holder every marketer and the chosen one’s prospects', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([]);

      const result = await service.formOptions(
        user({ permissions: [P.APPOINTMENTS_CREATE_ALL] }),
        { marketerUserId: KOFI },
      );

      expect(result.marketers).toHaveLength(3);
      expect(
        prospectWhere(prisma.marketingProspect.findMany).assignedUserId,
      ).toBe(KOFI);
    });
  });

  describe('approve', () => {
    const approver = user({
      id: KOFI,
      permissions: [P.APPOINTMENTS_APPROVE_ALL],
    });

    it('only reviews pending appointments', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(
        row({ status: 'APPROVED' }),
      );

      await expect(
        service.approve(approver, 'appt-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('approves and assigns a manager', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());
      prisma.marketingAppointment.findMany.mockResolvedValue([]);

      const result = await service.approve(approver, 'appt-1', {
        managerUserId: MANAGER,
      });

      expect(result.status).toBe('APPROVED');
      expect(result.managerUserId).toBe(MANAGER);
      expect(result.managerName).toBe('Abena Sarpong');
    });

    it('approves without a manager', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());

      const result = await service.approve(approver, 'appt-1', {});

      expect(result.status).toBe('APPROVED');
      expect(result.managerUserId).toBeNull();
    });

    it('rejects a manager without marketing access', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());

      await expect(
        service.approve(approver, 'appt-1', {
          managerUserId: '66666666-6666-4666-8666-666666666666',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a manager already booked at an overlapping time', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());
      prisma.marketingAppointment.findMany.mockResolvedValue([
        { startTime: '09:30', endTime: '10:30' },
      ]);

      await expect(
        service.approve(approver, 'appt-1', { managerUserId: MANAGER }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets a manager take the slot straight after another', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());
      prisma.marketingAppointment.findMany.mockResolvedValue([
        { startTime: '10:00', endTime: '11:00' },
      ]);

      const result = await service.approve(approver, 'appt-1', {
        managerUserId: MANAGER,
      });
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('edit and cancel', () => {
    it('lets the marketer edit their own pending appointment', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());

      const result = await service.update(user(), 'appt-1', {
        startTime: '11:00',
        endTime: '12:00',
      });

      expect(result.startTime).toBe('11:00');
    });

    it('does not let someone else edit or cancel it', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());
      const other = user({ id: KOFI });

      await expect(
        service.update(other, 'appt-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.cancel(other, 'appt-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets a create-for-others holder edit but not cancel another’s', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());
      const creator = user({
        id: KOFI,
        permissions: [P.APPOINTMENTS_CREATE_ALL],
      });

      await expect(
        service.update(creator, 'appt-1', { comment: 'x' }),
      ).resolves.toBeDefined();
      await expect(service.cancel(creator, 'appt-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets an approver cancel any appointment', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(row());

      const result = await service.cancel(
        user({ id: KOFI, permissions: [P.APPOINTMENTS_APPROVE_ALL] }),
        'appt-1',
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('will not edit a non-pending appointment', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(
        row({ status: 'APPROVED' }),
      );

      await expect(
        service.update(user(), 'appt-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
