import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  ProjectMemberRole,
  ProjectTaskStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectInvoicesService } from './project-invoices.service';
import { ProjectTimeService } from './project-time.service';
import { ProjectWorkService } from './project-work.service';
import { ProjectsService } from './projects.service';

const admin: RequestUser = {
  id: 'user-a',
  email: 'user@example.test',
  role: 'TENANT_ADMIN',
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  tenantName: 'Tenant A',
  firstName: 'User',
  moduleConfig: { hr: true },
  featureConfig: {},
  permissions: [],
};
const employee: RequestUser = { ...admin, role: 'EMPLOYEE' };
const permitted: RequestUser = {
  ...employee,
  permissions: ['projects:VIEW', 'project-tasks:EDIT'],
};

const delegate = () => ({
  findFirst: jest.fn(),
  findMany: jest.fn().mockResolvedValue([]),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  upsert: jest.fn(),
});

describe('Projects tenant-scoped parent validation', () => {
  const parents = [
    { id: 'project-a', tenantId: 'tenant-a', isArchived: false },
    { id: 'project-b', tenantId: 'tenant-b', isArchived: false },
    { id: 'archived-a', tenantId: 'tenant-a', isArchived: true },
  ];
  let prisma: ReturnType<typeof makePrisma>;
  let projects: ProjectsService;
  let work: ProjectWorkService;
  let time: ProjectTimeService;
  let invoices: ProjectInvoicesService;
  let related: ReturnType<typeof delegate>[];
  let memberAccess: boolean;

  function makePrisma() {
    return {
      project: delegate(),
      employee: delegate(),
      projectMember: delegate(),
      projectTask: delegate(),
      projectObjective: delegate(),
      projectSubtask: delegate(),
      projectSprint: delegate(),
      projectTimeEntry: delegate(),
      projectInvoice: delegate(),
      projectActivity: delegate(),
      $transaction: jest.fn(),
    };
  }

  beforeEach(() => {
    memberAccess = false;
    prisma = makePrisma();
    prisma.project.findFirst.mockImplementation(
      async ({ where }: { where: Prisma.ProjectWhereInput }) => {
        const parent = parents.find(
          (p) =>
            p.id === where.id &&
            p.tenantId === where.tenantId &&
            p.isArchived === where.isArchived,
        );
        return parent && (!where.OR || memberAccess) ? parent : null;
      },
    );
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-a' });
    prisma.projectMember.findFirst.mockResolvedValue(null);
    prisma.projectObjective.create.mockImplementation(
      async ({
        data,
      }: {
        data: Prisma.ProjectObjectiveUncheckedCreateInput;
      }) => ({
        id: 'objective-a',
        ...data,
      }),
    );
    related = [
      prisma.employee,
      prisma.projectMember,
      prisma.projectTask,
      prisma.projectObjective,
      prisma.projectSubtask,
      prisma.projectSprint,
      prisma.projectTimeEntry,
      prisma.projectInvoice,
      prisma.projectActivity,
    ];
    const db = prisma as unknown as PrismaService;
    projects = new ProjectsService(db, {} as NotificationsService);
    work = new ProjectWorkService(db, projects);
    time = new ProjectTimeService(db, projects);
    invoices = new ProjectInvoicesService(db, projects);
  });

  const sprint = {
    name: 'Sprint',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    taskIds: [],
  };
  const invoice = {
    id: 'invoice-a',
    transactionId: 'transaction-a',
    description: 'Work',
    amount: 100,
    lines: [],
  };
  type Operation = (projectId: string, user: RequestUser) => Promise<unknown>;
  const operations: [string, Operation][] = [
    ['access helper', (id, u) => projects.assertCanView('tenant-a', id, u)],
    ['work access', (id, u) => projects.getWorkAccess('tenant-a', id, u)],
    ['project detail', (id, u) => projects.findOne('tenant-a', id, u)],
    ['project update', (id, u) => projects.update('tenant-a', id, u, {})],
    ['project archive', (id, u) => projects.remove('tenant-a', id, u)],
    ['member list', (id, u) => projects.listMembers('tenant-a', id, u)],
    [
      'member add',
      (id, u) =>
        projects.addMember('tenant-a', id, u, { employeeId: 'employee-a' }),
    ],
    [
      'member remove',
      (id, u) => projects.removeMember('tenant-a', id, 'employee-a', u),
    ],
    ['task list', (id, u) => projects.listTasks('tenant-a', id, u)],
    [
      'task create',
      (id, u) => projects.createTask('tenant-a', id, u, { name: 'Task' }),
    ],
    [
      'task update',
      (id, u) => projects.updateTask('tenant-a', id, 'task-a', u, {}),
    ],
    [
      'task delete',
      (id, u) => projects.removeTask('tenant-a', id, 'task-a', u),
    ],
    ['activity list', (id, u) => projects.listActivities('tenant-a', id, u)],
    ['objective list', (id, u) => work.listObjectives('tenant-a', id, u)],
    [
      'objective create (original exploit)',
      (id, u) => work.createObjective('tenant-a', id, u, { name: 'Objective' }),
    ],
    [
      'objective update',
      (id, u) =>
        work.updateObjective('tenant-a', id, 'objective-a', u, {
          name: 'Objective',
        }),
    ],
    [
      'objective delete',
      (id, u) => work.removeObjective('tenant-a', id, 'objective-a', u),
    ],
    ['subtask list', (id, u) => work.listSubtasks('tenant-a', id, u)],
    [
      'subtask create',
      (id, u) =>
        work.createSubtask('tenant-a', id, u, {
          taskId: 'task-a',
          name: 'Subtask',
        }),
    ],
    [
      'subtask update',
      (id, u) =>
        work.updateSubtask('tenant-a', id, 'subtask-a', u, { done: true }),
    ],
    [
      'subtask delete',
      (id, u) => work.removeSubtask('tenant-a', id, 'subtask-a', u),
    ],
    ['sprint list', (id, u) => work.listSprints('tenant-a', id, u)],
    ['sprint create', (id, u) => work.createSprint('tenant-a', id, u, sprint)],
    [
      'sprint update',
      (id, u) => work.updateSprint('tenant-a', id, 'sprint-a', u, sprint),
    ],
    [
      'sprint delete',
      (id, u) => work.removeSprint('tenant-a', id, 'sprint-a', u),
    ],
    [
      'sprint complete',
      (id, u) =>
        work.completeSprint('tenant-a', id, 'sprint-a', u, { keepTaskIds: [] }),
    ],
    ['time summary', (id, u) => time.summary('tenant-a', id, u)],
    [
      'timer start',
      (id, u) => time.start('tenant-a', id, 'task-a', u, { pauseOthers: true }),
    ],
    ['timer pause', (id, u) => time.pause('tenant-a', id, 'task-a', u)],
    [
      'time add',
      (id, u) =>
        time.add('tenant-a', id, 'task-a', u, { hours: 1, minutes: 0 }),
    ],
    [
      'time correction',
      (id, u) =>
        time.setMine('tenant-a', id, 'task-a', u, { hours: 1, minutes: 0 }),
    ],
    ['invoice list', (id, u) => invoices.list('tenant-a', id, u)],
    ['invoice record', (id, u) => invoices.record('tenant-a', id, u, invoice)],
  ];

  describe.each([
    ['tenant admin', admin],
    ['permission holder', permitted],
    ['ordinary employee', employee],
  ])('%s cannot bypass the parent boundary', (_label, user) => {
    describe.each(['project-b', 'missing', 'archived-a'])(
      'parent %s',
      (projectId) => {
        it.each(operations)(
          '%s rejects before related queries or mutations',
          async (_name, run) => {
            await expect(run(projectId, user)).rejects.toThrow(
              new NotFoundException('Project not found'),
            );
            expect(prisma.project.findFirst).toHaveBeenCalledTimes(1);
            expect(prisma.project.findFirst).toHaveBeenCalledWith(
              expect.objectContaining({
                where: {
                  id: projectId,
                  tenantId: 'tenant-a',
                  isArchived: false,
                },
              }),
            );
            for (const model of related) {
              for (const method of Object.values(model))
                expect(method).not.toHaveBeenCalled();
            }
            expect(prisma.project.update).not.toHaveBeenCalled();
            expect(prisma.$transaction).not.toHaveBeenCalled();
          },
        );
      },
    );
  });

  it.each([admin, permitted])(
    'allows a privileged user to create work in their own tenant ($role)',
    async (user) => {
      await expect(
        work.createObjective('tenant-a', 'project-a', user, {
          name: ' Objective ',
        }),
      ).resolves.toMatchObject({
        tenantId: 'tenant-a',
        projectId: 'project-a',
        name: 'Objective',
      });
      expect(prisma.project.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.projectObjective.create.mock.invocationCallOrder[0],
      );
    },
  );

  it.each([ProjectMemberRole.OWNER, ProjectMemberRole.MANAGER])(
    'preserves %s work management',
    async (role) => {
      memberAccess = true;
      prisma.projectMember.findFirst.mockResolvedValue({
        id: 'member-a',
        role,
      });
      await expect(
        work.createObjective('tenant-a', 'project-a', employee, {
          name: 'Objective',
        }),
      ).resolves.toMatchObject({ projectId: 'project-a' });
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-a',
          projectId: 'project-a',
          employeeId: 'employee-a',
        },
        select: { id: true, role: true },
      });
    },
  );

  it('preserves ordinary member reads without granting work management', async () => {
    memberAccess = true;
    prisma.projectMember.findFirst.mockResolvedValue({
      id: 'member-a',
      role: ProjectMemberRole.MEMBER,
    });
    await expect(
      work.listObjectives('tenant-a', 'project-a', employee),
    ).resolves.toEqual([]);
    await expect(
      work.createObjective('tenant-a', 'project-a', employee, {
        name: 'Objective',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.projectObjective.create).not.toHaveBeenCalled();
  });

  it('preserves manager visibility and same-tenant employee denial', async () => {
    memberAccess = true;
    await expect(
      projects.assertCanView('tenant-a', 'project-a', employee),
    ).resolves.toBeUndefined();
    const [lastQuery] = prisma.project.findFirst.mock.lastCall as [
      { where: Prisma.ProjectWhereInput },
    ];
    expect(lastQuery.where.OR).toContainEqual({ managerId: 'employee-a' });
    memberAccess = false;
    await expect(
      work.createObjective('tenant-a', 'project-a', employee, {
        name: 'Objective',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.projectObjective.create).not.toHaveBeenCalled();
  });

  it.each([
    ['objectives', () => work.listObjectives('tenant-a', 'project-a', admin)],
    ['subtasks', () => work.listSubtasks('tenant-a', 'project-a', admin)],
    ['sprints', () => work.listSprints('tenant-a', 'project-a', admin)],
    ['time', () => time.summary('tenant-a', 'project-a', admin)],
    ['invoices', () => invoices.list('tenant-a', 'project-a', admin)],
    ['members', () => projects.listMembers('tenant-a', 'project-a', admin)],
    ['tasks', () => projects.listTasks('tenant-a', 'project-a', admin)],
  ])('preserves same-tenant %s reads', async (_name, run) => {
    await expect(run()).resolves.toEqual([]);
  });

  it('scopes a task-only status lookup to both the child and active parent tenant', async () => {
    prisma.projectTask.findFirst.mockResolvedValue(null);
    await expect(
      projects.updateTaskStatus('tenant-a', 'foreign-task', admin, {
        status: ProjectTaskStatus.DONE,
      }),
    ).rejects.toThrow(new NotFoundException('Project task not found'));
    expect(prisma.projectTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'foreign-task',
          tenantId: 'tenant-a',
          project: { tenantId: 'tenant-a', isArchived: false },
        },
      }),
    );
    expect(prisma.projectTask.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a child outside a valid project before attempting its update', async () => {
    prisma.projectObjective.findFirst.mockResolvedValue(null);
    await expect(
      work.updateObjective(
        'tenant-a',
        'project-a',
        'foreign-objective',
        admin,
        { name: 'Changed' },
      ),
    ).rejects.toThrow(new NotFoundException('Objective not found'));
    expect(prisma.projectObjective.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'foreign-objective',
        tenantId: 'tenant-a',
        projectId: 'project-a',
      },
      select: { id: true },
    });
    expect(prisma.projectObjective.update).not.toHaveBeenCalled();
  });
});
