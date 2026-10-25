/// <reference types="jest" />

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { RequestUser } from '@work-phelo/types';
import { AppraisalGoalsService } from '../../src/appraisal-goals/appraisal-goals.service';
import { AppraisalObjectivesService } from '../../src/appraisal-goals/appraisal-objectives.service';
import { linkedInCycleWindow } from '../../src/appraisal-goals/objective-window';
import { PrismaService } from '../../src/prisma/prisma.service';

const actor = (overrides: Partial<RequestUser> = {}): RequestUser => ({
  id: 'user-1',
  email: 'ama@acme.com',
  role: 'EMPLOYEE',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  tenantName: 'Acme Corp',
  firstName: 'Ama',
  moduleConfig: {},
  featureConfig: {},
  permissions: [],
  ...overrides,
});

describe('linkedInCycleWindow', () => {
  const cycle = {
    startDate: new Date('2026-10-01T00:00:00Z'),
    endDate: new Date('2026-12-31T00:00:00Z'),
  };

  it('counts the first and the whole last day of the cycle', () => {
    expect(linkedInCycleWindow(new Date('2026-10-01T00:00:00Z'), cycle)).toBe(
      true,
    );
    expect(linkedInCycleWindow(new Date('2026-12-31T23:30:00Z'), cycle)).toBe(
      true,
    );
  });

  it('leaves out anything before it starts or after it ends', () => {
    expect(linkedInCycleWindow(new Date('2026-09-30T23:59:00Z'), cycle)).toBe(
      false,
    );
    expect(linkedInCycleWindow(new Date('2027-01-01T00:00:00Z'), cycle)).toBe(
      false,
    );
  });

  it('never counts an objective with no goal', () => {
    expect(linkedInCycleWindow(null, cycle)).toBe(false);
  });
});

describe('AppraisalGoalsService', () => {
  it('refuses to delete a goal that is in a cycle', async () => {
    const prisma = {
      appraisalGoal: { findFirst: jest.fn(async () => ({ id: 'g1' })) },
      appraisalCycleGoal: { count: jest.fn(async () => 1) },
      $transaction: jest.fn(),
    };
    const service = new AppraisalGoalsService(
      prisma as unknown as PrismaService,
    );
    await expect(service.remove('tenant-1', 'g1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears goalId and linkedAt on the objectives it orphans', async () => {
    const updateMany = jest.fn();
    const del = jest.fn();
    const prisma = {
      appraisalGoal: {
        findFirst: jest.fn(async () => ({ id: 'g1' })),
        delete: del,
      },
      appraisalCycleGoal: { count: jest.fn(async () => 0) },
      appraisalObjective: { updateMany },
      $transaction: jest.fn(async () => []),
    };
    const service = new AppraisalGoalsService(
      prisma as unknown as PrismaService,
    );
    await service.remove('tenant-1', 'g1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', goalId: 'g1' },
      data: { goalId: null, linkedAt: null },
    });
  });

  it('rejects a name another goal already uses, ignoring case', async () => {
    const prisma = {
      appraisalGoal: { findFirst: jest.fn(async () => ({ id: 'other' })) },
    };
    const service = new AppraisalGoalsService(
      prisma as unknown as PrismaService,
    );
    await expect(
      service.create('tenant-1', 'user-1', {
        name: 'Sales',
        selfAssessmentWeight: 40,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AppraisalObjectivesService permissions', () => {
  const build = (target: { userId: string; managerId: string | null }) => {
    const prisma = {
      employee: {
        findFirst: jest.fn(async (args: { where: { userId?: string } }) =>
          args.where.userId
            ? { id: 'emp-actor' }
            : { id: 'emp-target', ...target },
        ),
      },
      appraisalGoal: { findFirst: jest.fn(async () => ({ id: 'g1' })) },
      appraisalObjective: {
        create: jest.fn(async (args: unknown) => args),
      },
    };
    return {
      prisma,
      service: new AppraisalObjectivesService(
        prisma as unknown as PrismaService,
      ),
    };
  };
  const dto = { employeeId: 'emp-target', name: 'Ship it', goalId: 'g1' };

  it('lets an employee add their own objective with create on self-appraisals', async () => {
    const { service, prisma } = build({ userId: 'user-1', managerId: null });
    await service.create(
      'tenant-1',
      actor({ permissions: ['self-appraisals:CREATE'] }),
      dto,
    );
    expect(prisma.appraisalObjective.create).toHaveBeenCalled();
  });

  it('refuses an employee with no create permission, even for themselves', async () => {
    const { service } = build({ userId: 'user-1', managerId: null });
    await expect(
      service.create('tenant-1', actor(), dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a team reviewer add for their own report with only appraisal-reviews:EDIT', async () => {
    const { service, prisma } = build({
      userId: 'user-2',
      managerId: 'emp-actor',
    });
    await service.create(
      'tenant-1',
      actor({ permissions: ['appraisal-reviews:EDIT'] }),
      dto,
    );
    expect(prisma.appraisalObjective.create).toHaveBeenCalled();
  });

  it('stops a team reviewer adding for someone who does not report to them', async () => {
    const { service } = build({ userId: 'user-2', managerId: 'someone-else' });
    await expect(
      service.create(
        'tenant-1',
        actor({ permissions: ['appraisal-reviews:EDIT'] }),
        dto,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets HR add for anyone', async () => {
    const { service, prisma } = build({
      userId: 'user-2',
      managerId: 'someone-else',
    });
    await service.create(
      'tenant-1',
      actor({
        permissions: ['appraisal-reviews:EDIT', 'appraisals:CREATE'],
      }),
      dto,
    );
    expect(prisma.appraisalObjective.create).toHaveBeenCalled();
  });
});
