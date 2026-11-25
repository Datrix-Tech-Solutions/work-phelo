import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import type { RecentActivityType } from './dashboard.service';

/** A payroll, appraisal, recruitment or project event, before its actor is named. */
export interface ModuleEvent {
  id: string;
  type: RecentActivityType;
  subject: string;
  timestamp: Date;
  detail?: string | null;
  /** User id of who did it, when the record keeps one. */
  actorUserId?: string | null;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PAYSLIP_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  commission: 'Commission',
  monthly_commission: 'Monthly and commission',
};

/** Task edits are left out: they are frequent enough to push everything else off the feed. */
const PROJECT_EVENTS = {
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_CANCELLED: 'PROJECT_ARCHIVED',
  MEMBER_ADDED: 'PROJECT_MEMBER_ADDED',
  MEMBER_REMOVED: 'PROJECT_MEMBER_REMOVED',
  TASK_STATUS_CHANGED: 'PROJECT_TASK_MOVED',
} as const;

type FeedModule = 'payroll' | 'appraisals' | 'recruitment';

/** Mirrors the guards on each module's own endpoints, so the feed never shows more than they do. */
function canSee(
  user: RequestUser,
  feature: FeedModule | null,
  rules: string[],
) {
  if (feature && user.featureConfig?.hr?.[feature] !== true) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') return true;
  return rules.some((rule) => user.permissions?.includes(rule));
}

const fullName = (
  person: { firstName: string | null; lastName: string | null },
  fallback: string,
) => [person.firstName, person.lastName].filter(Boolean).join(' ') || fallback;

/** The newest events of each module the user may see; `take` caps every source. */
export async function getModuleActivity(
  prisma: PrismaService,
  user: RequestUser,
  take: number,
): Promise<ModuleEvent[]> {
  const sources: Promise<ModuleEvent[]>[] = [];
  if (
    canSee(user, 'payroll', [
      'payroll:VIEW',
      'payroll:RUN',
      'payroll:APPROVE',
      'payroll:EDIT',
    ])
  ) {
    sources.push(payrollActivity(prisma, user.tenantId, take));
  }
  if (canSee(user, 'appraisals', ['appraisals:VIEW'])) {
    sources.push(appraisalActivity(prisma, user.tenantId, take));
  }
  if (canSee(user, 'recruitment', ['recruitment.vacancies:VIEW'])) {
    sources.push(vacancyActivity(prisma, user.tenantId, take));
  }
  if (canSee(user, 'recruitment', ['recruitment.candidates:VIEW'])) {
    sources.push(candidateActivity(prisma, user.tenantId, take));
  }
  if (canSee(user, null, ['projects:VIEW'])) {
    sources.push(projectActivity(prisma, user.tenantId, take));
  }
  return (await Promise.all(sources)).flat();
}

async function payrollActivity(
  prisma: PrismaService,
  tenantId: string,
  take: number,
) {
  const runs = await prisma.payrollRun.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    take,
    select: {
      id: true,
      month: true,
      year: true,
      payslipKey: true,
      payrollCurrency: true,
      createdAt: true,
      runBy: true,
      submittedAt: true,
      submittedBy: true,
      approvedAt: true,
      approvedBy: true,
      paidAt: true,
    },
  });

  return runs.flatMap((run) => {
    const subject = `${MONTHS[run.month - 1]} ${run.year} payroll`;
    const detail = [PAYSLIP_LABELS[run.payslipKey], run.payrollCurrency]
      .filter(Boolean)
      .join(' · ');
    const stages = [
      ['PAYROLL_CREATED', run.createdAt, run.runBy],
      ['PAYROLL_SUBMITTED', run.submittedAt, run.submittedBy],
      ['PAYROLL_APPROVED', run.approvedAt, run.approvedBy],
      ['PAYROLL_PAID', run.paidAt, null],
    ] as const;
    return stages.flatMap(([type, timestamp, actorUserId]) =>
      timestamp
        ? [
            {
              id: `${type}-${run.id}`,
              type,
              subject,
              detail,
              actorUserId,
              timestamp,
            },
          ]
        : [],
    );
  });
}

async function appraisalActivity(
  prisma: PrismaService,
  tenantId: string,
  take: number,
) {
  const cycleDates = ['activatedAt', 'closedAt', 'cancelledAt'] as const;
  const appraisalDates = [
    'selfSubmittedAt',
    'managerSubmittedAt',
    'finalizedAt',
  ] as const;
  const cycleTypes = {
    activatedAt: 'APPRAISAL_CYCLE_STARTED',
    closedAt: 'APPRAISAL_CYCLE_CLOSED',
    cancelledAt: 'APPRAISAL_CYCLE_CANCELLED',
  } as const;
  const appraisalTypes = {
    selfSubmittedAt: 'SELF_ASSESSMENT_SUBMITTED',
    managerSubmittedAt: 'MANAGER_REVIEW_SUBMITTED',
    finalizedAt: 'APPRAISAL_FINALIZED',
  } as const;

  // One query per date, so the newest of each kind is never crowded out by another.
  const [cycles, appraisals] = await Promise.all([
    Promise.all(
      cycleDates.map(async (field) => {
        const rows = await prisma.appraisalCycle.findMany({
          where: { tenantId, [field]: { not: null } },
          orderBy: { [field]: 'desc' },
          take,
        });
        return rows.map((cycle) => ({
          id: `${field}-${cycle.id}`,
          type: cycleTypes[field],
          subject: cycle.title,
          timestamp: cycle[field]!,
        }));
      }),
    ),
    Promise.all(
      appraisalDates.map(async (field) => {
        const rows = await prisma.appraisal.findMany({
          where: { tenantId, [field]: { not: null } },
          orderBy: { [field]: 'desc' },
          take,
          select: {
            id: true,
            selfSubmittedAt: true,
            managerSubmittedAt: true,
            finalizedAt: true,
            finalizedBy: true,
            employee: { select: { firstName: true, lastName: true } },
            cycle: { select: { title: true } },
          },
        });
        // Scores are deliberately not read: the feed only says that something happened.
        return rows.map((row) => ({
          id: `${field}-${row.id}`,
          type: appraisalTypes[field],
          subject: fullName(row.employee, 'An employee'),
          detail: row.cycle.title,
          actorUserId: field === 'finalizedAt' ? row.finalizedBy : null,
          timestamp: row[field]!,
        }));
      }),
    ),
  ]);

  return [...cycles.flat(), ...appraisals.flat()];
}

async function vacancyActivity(
  prisma: PrismaService,
  tenantId: string,
  take: number,
) {
  const select = {
    id: true,
    title: true,
    createdAt: true,
    createdByUserId: true,
    closedAt: true,
    closedByUserId: true,
  } as const;
  const [created, closed] = await Promise.all([
    prisma.recruitmentVacancy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      select,
    }),
    prisma.recruitmentVacancy.findMany({
      where: { tenantId, status: 'CLOSED', closedAt: { not: null } },
      orderBy: { closedAt: 'desc' },
      take,
      select,
    }),
  ]);

  return [
    ...created.map((v) => ({
      id: `vacancy-created-${v.id}`,
      type: 'VACANCY_CREATED' as const,
      subject: v.title || 'Untitled job opening',
      actorUserId: v.createdByUserId,
      timestamp: v.createdAt,
    })),
    ...closed.map((v) => ({
      id: `vacancy-closed-${v.id}`,
      type: 'VACANCY_CLOSED' as const,
      subject: v.title || 'Untitled job opening',
      actorUserId: v.closedByUserId,
      timestamp: v.closedAt!,
    })),
  ];
}

async function candidateActivity(
  prisma: PrismaService,
  tenantId: string,
  take: number,
) {
  const application = {
    select: {
      firstName: true,
      lastName: true,
      vacancy: { select: { title: true } },
    },
  } as const;
  const [applications, moves, interviews] = await Promise.all([
    prisma.recruitmentApplication.findMany({
      where: { tenantId, status: 'SUBMITTED', submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take,
      select: { id: true, submittedAt: true, ...application.select },
    }),
    prisma.recruitmentStageHistory.findMany({
      // Moves of an unsubmitted draft are not something a recruiter can open.
      where: { tenantId, application: { status: 'SUBMITTED' } },
      orderBy: { changedAt: 'desc' },
      take,
      select: {
        id: true,
        changedAt: true,
        changedByUserId: true,
        newStage: { select: { name: true } },
        application,
      },
    }),
    prisma.recruitmentInterview.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        createdByUserId: true,
        application,
      },
    }),
  ]);

  return [
    ...applications.map((a) => ({
      id: `application-${a.id}`,
      type: 'APPLICATION_RECEIVED' as const,
      subject: fullName(a, 'A candidate'),
      detail: a.vacancy.title,
      timestamp: a.submittedAt!,
    })),
    ...moves.map((m) => ({
      id: `stage-${m.id}`,
      type: 'CANDIDATE_MOVED' as const,
      subject: fullName(m.application, 'A candidate'),
      detail: `${m.newStage.name}${m.application.vacancy.title ? ` · ${m.application.vacancy.title}` : ''}`,
      actorUserId: m.changedByUserId,
      timestamp: m.changedAt,
    })),
    ...interviews.map((i) => ({
      id: `interview-${i.id}`,
      type: 'INTERVIEW_SCHEDULED' as const,
      subject: fullName(i.application, 'A candidate'),
      detail: i.application.vacancy.title,
      actorUserId: i.createdByUserId,
      timestamp: i.createdAt,
    })),
  ];
}

async function projectActivity(
  prisma: PrismaService,
  tenantId: string,
  take: number,
) {
  const rows = await prisma.projectActivity.findMany({
    where: {
      tenantId,
      type: {
        in: Object.keys(PROJECT_EVENTS) as (keyof typeof PROJECT_EVENTS)[],
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      type: true,
      message: true,
      actorUserId: true,
      createdAt: true,
      project: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const type = PROJECT_EVENTS[row.type as keyof typeof PROJECT_EVENTS];
    return {
      id: `project-${row.id}`,
      type,
      subject: row.project.name,
      // For these two the message only repeats the title.
      detail:
        type === 'PROJECT_CREATED' || type === 'PROJECT_ARCHIVED'
          ? null
          : row.message.replace(/\.$/, ''),
      actorUserId: row.actorUserId,
      timestamp: row.createdAt,
    };
  });
}
