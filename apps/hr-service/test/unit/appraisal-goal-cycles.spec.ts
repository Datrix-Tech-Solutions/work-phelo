/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { AppraisalGoalCyclesService } from '../../src/appraisal-goals/appraisal-goal-cycles.service';
import { AppraisalObjectivesService } from '../../src/appraisal-goals/appraisal-objectives.service';
import { overallScore, sideScore } from '../../src/appraisal-goals/score';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('scores', () => {
  const entries = [
    {
      goal: { selfAssessmentWeight: 40, managerAssessmentWeight: 60 },
      objectives: [{ id: 'a' }, { id: 'b' }],
    },
  ];

  it('averages one side against the top rating', () => {
    expect(sideScore(entries, { a: { score: 5 }, b: { score: 3 } })).toBe(80);
    expect(sideScore(entries, {})).toBeNull();
  });

  it('blends both sides by the goal weights', () => {
    const self = { a: { score: 5 }, b: { score: 5 } };
    const manager = { a: { score: 3 }, b: { score: 3 } };
    // (5 * 0.4 + 3 * 0.6) / 5 = 76%
    expect(overallScore(entries, self, manager)).toBe(76);
  });
});

const cycle = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  tenantId: 't1',
  title: 'Q4',
  status: 'IN_PROGRESS',
  startDate: new Date('2026-10-01T00:00:00Z'),
  endDate: new Date('2026-12-31T00:00:00Z'),
  selfAssessmentDeadline: new Date('2026-12-10T00:00:00Z'),
  managerReviewDeadline: new Date('2026-12-20T00:00:00Z'),
  goals: [
    {
      goalId: 'g1',
      goal: {
        name: 'G',
        selfAssessmentWeight: 40,
        managerAssessmentWeight: 60,
      },
    },
  ],
  groups: [],
  ...overrides,
});

const build = (prisma: Record<string, unknown>) =>
  new AppraisalGoalCyclesService(
    prisma as unknown as PrismaService,
    {} as AppraisalObjectivesService,
    { createMany: jest.fn() } as unknown as NotificationsService,
  );

describe('AppraisalGoalCyclesService', () => {
  it('only lets the name and description change once a cycle has started', async () => {
    const prisma = {
      appraisalCycle: { findFirst: jest.fn(async () => cycle()) },
    };
    await expect(
      build(prisma).updateCycle('t1', 'c1', { endDate: '2027-01-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to run a cycle that has no goals (a template cycle)', async () => {
    const prisma = {
      appraisalCycle: {
        findFirst: jest.fn(async () =>
          cycle({ status: 'UPCOMING', goals: [] }),
        ),
      },
    };
    await expect(
      build(prisma).startCycle('t1', 'c1', { tenantSlug: 'acme' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('brings the end date forward when a cycle is closed early', async () => {
    const update = jest.fn(
      async (_args: { data: Record<string, Date> }) => ({}),
    );
    const prisma = {
      appraisalCycle: {
        findFirst: jest.fn(async () => cycle()),
        update,
      },
    };
    await build(prisma).closeCycle('t1', 'c1');
    const { data } = update.mock.calls[0][0];
    expect(data.endDate.getTime()).toBeLessThan(
      new Date('2026-12-31T00:00:00Z').getTime(),
    );
    expect(data.closedAt).toEqual(data.endDate);
  });

  it('voids a cancelled cycle by deleting its assessments', async () => {
    const deleteMany = jest.fn();
    const prisma = {
      appraisalCycle: {
        findFirst: jest.fn(async () => cycle()),
        update: jest.fn(),
      },
      appraisal: { findMany: jest.fn(async () => []), deleteMany },
      $transaction: jest.fn(async () => []),
    };
    await build(prisma).cancelCycle('t1', 'c1', 'Policy changed');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', cycleId: 'c1' },
    });
  });

  const dates = {
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    selfAssessmentDeadline: '2026-12-10',
    managerReviewDeadline: '2026-12-20',
  };

  it('refuses groups that share a person, since they would have two sets of weights', async () => {
    const create = jest.fn();
    const prisma = {
      appraisalCycle: { findFirst: jest.fn(async () => null), create },
      appraisalGroup: {
        findMany: jest.fn(async () => [
          { id: 'a', employeeIds: ['e1', 'e2'], goals: [{ goalId: 'g1' }] },
          { id: 'b', employeeIds: ['e2', 'e3'], goals: [{ goalId: 'g2' }] },
        ]),
      },
    };
    await expect(
      build(prisma).createCycle('t1', 'u1', {
        title: 'Q4',
        ...dates,
        groupIds: ['a', 'b'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('runs the goals of its groups, once each', async () => {
    const create = jest.fn(async (_args: unknown) =>
      cycle({
        status: 'UPCOMING',
        groups: [{ groupId: 'a' }, { groupId: 'b' }],
      }),
    );
    const prisma = {
      appraisalCycle: { findFirst: jest.fn(async () => null), create },
      appraisalGroup: {
        findMany: jest.fn(async () => [
          { id: 'a', employeeIds: ['e1'], goals: [{ goalId: 'g1' }] },
          {
            id: 'b',
            employeeIds: ['e2'],
            goals: [{ goalId: 'g1' }, { goalId: 'g2' }],
          },
        ]),
      },
    };
    const view = await build(prisma).createCycle('t1', 'u1', {
      title: 'Q4',
      ...dates,
      groupIds: ['a', 'b'],
    });
    const data = (
      create.mock.calls[0][0] as {
        data: { goals: { create: { goalId: string }[] } };
      }
    ).data;
    expect(data.goals.create.map((g) => g.goalId)).toEqual(['g1', 'g2']);
    expect(view.groupIds).toEqual(['a', 'b']);
  });

  it('needs groups or goals to create a cycle', async () => {
    const prisma = {
      appraisalCycle: { findFirst: jest.fn(async () => null) },
    };
    await expect(
      build(prisma).createCycle('t1', 'u1', { title: 'Q4', ...dates }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
