import { NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { TargetReportService } from './target-report.service';

const D = (value: string) => new Prisma.Decimal(value);

const target = (
  userId: string,
  amount: string,
  achieved: string | null,
  productId: string | null = null,
) => ({ userId, productId, amount, achieved });

describe('TargetReportService', () => {
  const rep: RequestUser = {
    id: 'rep-1',
    tenantId: 'tenant-1',
    email: 'rep@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ama',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [],
  };
  const manager: RequestUser = {
    ...rep,
    id: 'mgr-1',
    permissions: [P.TARGETS_VIEW_ALL],
  };

  const people = [
    {
      employeeId: 'e1',
      userId: 'rep-1',
      name: 'Ama',
      department: 'Sales',
      departmentId: 'd1',
      branch: 'Accra',
      branchId: 'b1',
    },
    {
      employeeId: 'e2',
      userId: 'rep-2',
      name: 'Kofi',
      department: 'Corporate',
      departmentId: 'd2',
      branch: 'Kumasi',
      branchId: 'b2',
    },
  ];

  let prisma: {
    marketingClientProduct: { findMany: jest.Mock };
    marketingProspectProduct: { findMany: jest.Mock };
  };
  let targets: {
    canViewAll: jest.Mock;
    listOverlapping: jest.Mock;
    baseCurrency: jest.Mock;
  };
  let assignees: { namesFor: jest.Mock; activeUsers: jest.Mock };
  let hr: { list: jest.Mock };
  let service: TargetReportService;

  beforeEach(() => {
    prisma = {
      marketingClientProduct: { findMany: jest.fn().mockResolvedValue([]) },
      marketingProspectProduct: { findMany: jest.fn().mockResolvedValue([]) },
    };
    targets = {
      canViewAll: jest.fn((u: RequestUser) =>
        u.permissions.includes(P.TARGETS_VIEW_ALL),
      ),
      listOverlapping: jest
        .fn()
        .mockResolvedValue([
          target('rep-1', '10000.00', '4000.00'),
          target('rep-2', '20000.00', '25000.00'),
        ]),
      baseCurrency: jest.fn().mockResolvedValue('GHS'),
    };
    assignees = {
      namesFor: jest.fn(
        (_t: string, ids: string[]) =>
          new Map(
            ids.map((id) => [
              id,
              id === 'rep-1' ? 'Ama Mensah' : 'Kofi Boateng',
            ]),
          ),
      ),
      activeUsers: jest.fn().mockResolvedValue([
        { userId: 'rep-1', name: 'Ama Mensah', email: 'a@x.com' },
        { userId: 'rep-2', name: 'Kofi Boateng', email: 'k@x.com' },
      ]),
    };
    hr = { list: jest.fn().mockResolvedValue(people) };
    service = new TargetReportService(
      prisma as never,
      targets as never,
      assignees as never,
      hr as never,
    );
  });

  it('works out remaining, percent and totals for the team', async () => {
    prisma.marketingClientProduct.findMany.mockResolvedValue([
      { expectedValue: D('1500.00'), client: { assignedUserId: 'rep-1' } },
    ]);
    prisma.marketingProspectProduct.findMany.mockResolvedValue([
      { expectedValue: D('500.00'), prospect: { assignedUserId: 'rep-1' } },
    ]);

    const report = await service.report(manager, { year: 2026 });

    expect(report.reps[0]).toMatchObject({
      name: 'Ama Mensah',
      branch: 'Accra',
      department: 'Sales',
      target: '10000.00',
      achieved: '4000.00',
      remaining: '6000.00',
      percent: 40,
      expected: '2000.00',
    });
    // An over-achieved target has nothing remaining, but its percentage still shows.
    expect(report.reps[1]).toMatchObject({ remaining: '0.00', percent: 125 });
    expect(report.totals).toEqual({
      target: '30000.00',
      achieved: '29000.00',
      remaining: '1000.00',
      percent: 96.7,
      expected: '2000.00',
    });
  });

  it('uses overall targets over per-product ones, falling back to products', async () => {
    targets.listOverlapping.mockResolvedValue([
      target('rep-1', '10000.00', '1000.00'),
      target('rep-1', '3000.00', '500.00', 'product-1'),
      target('rep-2', '2000.00', '100.00', 'product-1'),
      target('rep-2', '3000.00', '200.00', 'product-2'),
    ]);

    const report = await service.report(manager, { year: 2026 });

    expect(report.reps.map((r) => r.target)).toEqual(['10000.00', '5000.00']);
  });

  it('leaves achievement empty when Accounting could not be reached', async () => {
    targets.listOverlapping.mockResolvedValue([
      target('rep-1', '10000.00', null),
    ]);

    const report = await service.report(manager, { year: 2026 });

    expect(report.reps[0]).toMatchObject({
      achieved: null,
      remaining: null,
      percent: null,
    });
    expect(report.totals?.achieved).toBeNull();
  });

  it('narrows to a branch or department', async () => {
    const byBranch = await service.report(manager, {
      year: 2026,
      branchId: 'b2',
    });
    const byDepartment = await service.report(manager, {
      year: 2026,
      departmentId: 'd1',
    });

    expect(byBranch.reps.map((r) => r.userId)).toEqual(['rep-2']);
    expect(byDepartment.reps.map((r) => r.userId)).toEqual(['rep-1']);
  });

  it('shows a rep only themselves and no team totals', async () => {
    const report = await service.report(rep, { year: 2026 });

    expect(report.canViewTeam).toBe(false);
    expect(report.totals).toBeNull();
    // The targets list is already scoped to the caller; the service asks it as the caller.
    expect(targets.listOverlapping).toHaveBeenCalledWith(
      rep,
      '2026-01-01',
      '2026-12-31',
    );
  });

  it('refuses a rep asking for someone else', async () => {
    await expect(
      service.report(rep, { year: 2026, userId: 'rep-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still reports when HR cannot be reached, without branch and department', async () => {
    hr.list.mockRejectedValue(new Error('down'));

    const report = await service.report(manager, { year: 2026 });

    expect(report.reps[0]).toMatchObject({ branch: null, department: null });
  });

  it('offers team viewers every rep, branch and department, and a rep only themselves', async () => {
    const team = await service.filters(manager);
    const own = await service.filters(rep);

    expect(team.reps).toHaveLength(2);
    expect(team.branches.map((b) => b.name)).toEqual(['Accra', 'Kumasi']);
    expect(team.departments.map((d) => d.name)).toEqual(['Corporate', 'Sales']);
    expect(own.reps).toEqual([{ userId: 'rep-1', name: 'Ama Mensah' }]);
    expect(own.branches).toEqual([]);
  });
});
