import { useCorrectionRequests } from '@/hooks/hr/useTimeClock';
import { usePendingManagerShiftSwaps } from '@/hooks/hr/useScheduling';
import { formatDate, formatTime } from '@/lib/formatters';
import { usePendingActions } from '@/hooks/hr/useEmployeeDashboard';
import { useMyAppraisals, useTeamAppraisals } from '@/hooks/hr/useAppraisals';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import { usePayrollRuns } from '@/hooks/hr/usePayroll';
import { APPRAISAL_REMINDER_DAYS } from '@/lib/appraisal-reminders';
import { payrollReminders } from '@/lib/payroll-reminders';
import { daysFromToday, describeDaysUntil } from '@/lib/reminder-dates';
import { useLeaveRequests } from '@/hooks/hr/useLeave';
import { usePermission, usePermissionRule } from '@/hooks/hr/usePermission';
import { useTaxObligations } from '@/hooks/accounting/useTaxTypes';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';

/** The approvals that can be decided from the pop-up; the rest are only shown. */
export type ReviewType = 'leave' | 'correction' | 'swap';

export interface Reminder {
  id: string;
  /** What kind of approval this is, e.g. "Leave request". */
  kind: string;
  title: string;
  detail?: string;
  /** Labelled facts shown in the pop-up. */
  fields?: { label: string; value: string }[];
  /** Present when the pop-up can approve or reject it. `id` is the record to decide. */
  review?: { type: ReviewType; id: string };
  /** Days until it falls due, for ones with a date; negative once overdue. Overdue ones go first. */
  dueInDays?: number;
  /** Present on a tax payment: the tax type to pay, which the pop-up opens the payment form for. */
  payTax?: string;
  /** A made-up entry: deciding it is pretended, nothing is sent. */
  dummy?: boolean;
}

// TEMPORARY: fake reminders so the badge, tab and modal can be tried without real pending items.
// Set to false (or delete) to go back to the real ones.
const USE_DUMMY_DATA = false;
const DUMMY_REMINDERS: Reminder[] = [
  {
    id: 'l1',
    kind: 'Leave request',
    title: 'Ama Mensah',
    detail: 'Annual leave · 03 Nov – 07 Nov',
    fields: [
      { label: 'Leave type', value: 'Annual leave' },
      { label: 'Dates', value: '03 Nov 2026 – 07 Nov 2026' },
      { label: 'Working days', value: '5 days' },
      { label: 'Employee notes', value: 'Family trip, arranged months ago.' },
    ],
    review: { type: 'leave', id: 'l1' },
    dummy: true,
  },
  {
    id: 'l2',
    kind: 'Leave request',
    title: 'Kofi Boateng',
    detail: 'Sick leave · 20 Oct – 21 Oct',
    fields: [
      { label: 'Leave type', value: 'Sick leave' },
      { label: 'Dates', value: '20 Oct 2026 – 21 Oct 2026' },
      { label: 'Working days', value: '2 days' },
    ],
    review: { type: 'leave', id: 'l2' },
    dummy: true,
  },
  {
    id: 't1',
    kind: 'Time correction',
    title: 'Yaw Asante',
    detail: '14 Oct · Forgot to clock out',
    fields: [
      { label: 'Date', value: '14 Oct 2026' },
      { label: 'Requested in', value: '08:00 AM' },
      { label: 'Requested out', value: '05:00 PM' },
      { label: 'Reason', value: 'Forgot to clock out' },
    ],
    review: { type: 'correction', id: 't1' },
    dummy: true,
  },
  {
    id: 's1',
    kind: 'Shift swap',
    title: 'Efua Quartey ⇄ Kwame Ofori',
    detail: '22 Oct ⇄ 24 Oct',
    fields: [
      { label: 'Requested by', value: 'Efua Quartey' },
      { label: 'Swap with', value: 'Kwame Ofori' },
      { label: 'Their shift', value: '22 Oct 2026' },
      { label: 'Swapped for', value: '24 Oct 2026' },
      { label: 'Reason', value: 'Medical appointment' },
    ],
    review: { type: 'swap', id: 's1' },
    dummy: true,
  },
  {
    id: 'pr1',
    kind: 'Payroll reminder',
    title: 'Payroll for Monthly Staff',
    detail: 'Payday 28 Oct · due in 3 days',
    fields: [
      { label: 'Group', value: 'Monthly Staff' },
      { label: 'Payday', value: '28 Oct 2026' },
      { label: 'Status', value: 'Due in 3 days' },
    ],
    dueInDays: 3,
  },
  { id: 'a1', kind: 'Team appraisal', title: 'Nana Adjei', detail: 'Q3 2026 appraisal' },
  { id: 'p1', kind: 'Payroll', title: 'Payroll run awaiting approval', detail: 'October 2026' },
  { id: 'f1', kind: 'Appraisal', title: 'Appraisal to finalise' },
];

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** The pending-actions endpoint only counts, so each one becomes an entry without detail. */
function fromCount(prefix: string, kind: string, title: string, count: number): Reminder[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, kind, title }));
}

/** Everything waiting on the signed-in user for approval or review, only for what they may act on. */
export function useReminders(): Reminder[] {
  const user = useAuthStore((s) => s.user);
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canApproveTimeCorrection = usePermission(Permission.APPROVE_TIME_CORRECTION);
  const canApproveShiftSwap = usePermission(Permission.APPROVE_SHIFT_SWAP);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canFinalizeAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);

  const { data: leave = [] } = useLeaveRequests('PENDING', { enabled: !!user && canApproveLeave });
  const { data: corrections = [] } = useCorrectionRequests('PENDING', {
    enabled: !!user && canApproveTimeCorrection,
  });
  // Gated on the permission inside the hook.
  const { data: team = [] } = useTeamAppraisals();
  const { data: swaps = [] } = usePendingManagerShiftSwaps('PENDING_MANAGER', {
    enabled: !!user && canApproveShiftSwap,
  });
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  const { data: myAppraisals = [] } = useMyAppraisals({ enabled: !!user && canReadOwnProfile });
  // Paying a tax is a direct payment, so it is for those who can make one.
  const canPayTaxes = usePermissionRule('accounting.cashbook:CREATE');
  const { data: taxObligations = [] } = useTaxObligations({ enabled: !!user && canPayTaxes });
  const canRunPayroll = usePermission(Permission.RUN_PAYROLL);
  const { groups } = usePayrollGroups({ enabled: !!user && canRunPayroll });
  const { data: runs = [] } = usePayrollRuns({ enabled: !!user && canRunPayroll });
  const needsPendingActions = canApprovePayroll || canFinalizeAppraisal;
  const { data: pending } = usePendingActions({ enabled: !!user && needsPendingActions });

  if (USE_DUMMY_DATA) return DUMMY_REMINDERS;

  const paydayReminders: Reminder[] = canRunPayroll
    ? payrollReminders(groups, (month, year) =>
        runs.some((run) => run.month === month && run.year === year),
      ).map((r) => ({
        id: `payday-${r.groupId}-${r.payday.getFullYear()}-${r.payday.getMonth()}`,
        kind: 'Payroll reminder',
        title: `Payroll for ${r.groupName}`,
        detail: `Payday ${formatDay(r.payday.toISOString())} · ${describeDaysUntil(r.daysUntil)}`,
        fields: [
          { label: 'Group', value: r.groupName },
          { label: 'Payday', value: formatDate(r.payday.toISOString()) },
          { label: 'Status', value: describeDaysUntil(r.daysUntil) },
        ],
        dueInDays: r.daysUntil,
      }))
    : [];

  // The employee's own self assessments: same rules as the emails (cycle running, not yet submitted).
  const selfAssessmentReminders: Reminder[] = canReadOwnProfile
    ? myAppraisals.flatMap((a) => {
        const deadline = a.selfAssessmentDeadline;
        if (
          a.cycleStatus !== 'IN_PROGRESS' ||
          a.overallStatus !== 'NotStarted' ||
          typeof deadline !== 'string'
        ) {
          return [];
        }
        const daysUntil = daysFromToday(deadline);
        if (daysUntil > APPRAISAL_REMINDER_DAYS) return [];
        const cycle = typeof a.cycleName === 'string' ? a.cycleName : '';
        return [
          {
            id: `self-assessment-${String(a.id)}`,
            kind: 'Self assessment',
            title: cycle ? `Self assessment for ${cycle}` : 'Self assessment',
            detail: `Deadline ${formatDay(deadline)} · ${describeDaysUntil(daysUntil)}`,
            fields: [
              ...(cycle ? [{ label: 'Appraisal cycle', value: cycle }] : []),
              { label: 'Deadline', value: formatDate(deadline) },
              { label: 'Status', value: describeDaysUntil(daysUntil) },
            ],
            dueInDays: daysUntil,
          },
        ];
      })
    : [];

  const taxReminders: Reminder[] = canPayTaxes
    ? taxObligations.map((t) => ({
        id: `tax-${t.taxTypeId}-${t.periodEnd}`,
        kind: 'Tax payment',
        title: `${t.name} payment`,
        detail: `${t.currency} ${Number(t.amountOutstanding).toLocaleString('en-GB', {
          minimumFractionDigits: 2,
        })} · ${describeDaysUntil(t.daysUntil)}`,
        fields: [
          { label: 'Tax', value: `${t.code} — ${t.name}` },
          { label: 'Period', value: `${formatDate(t.periodStart)} – ${formatDate(t.periodEnd)}` },
          { label: 'Due', value: formatDate(t.dueDate) },
          {
            label: 'Still owed',
            value: `${t.currency} ${Number(t.amountOutstanding).toLocaleString('en-GB', {
              minimumFractionDigits: 2,
            })}`,
          },
          { label: 'Status', value: describeDaysUntil(t.daysUntil) },
        ],
        dueInDays: t.daysUntil,
        payTax: t.taxTypeId,
      }))
    : [];

  const all: Reminder[] = [
    ...paydayReminders,
    ...taxReminders,
    ...selfAssessmentReminders,
    ...(canApproveLeave
      ? leave.map((r) => ({
          id: `leave-${r.id}`,
          kind: 'Leave request',
          title: r.employeeName || 'An employee',
          detail: `${r.leaveTypeName} · ${formatDay(r.startDate)} – ${formatDay(r.endDate)}`,
          fields: [
            { label: 'Leave type', value: r.leaveTypeName },
            { label: 'Dates', value: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
            {
              label: 'Working days',
              value: `${r.totalDays} ${r.totalDays === 1 ? 'day' : 'days'}`,
            },
            ...(r.reason ? [{ label: 'Employee notes', value: r.reason }] : []),
          ],
          review: { type: 'leave' as const, id: r.id },
        }))
      : []),
    ...(canApproveTimeCorrection
      ? corrections.map((r) => ({
          id: `correction-${r.id}`,
          kind: 'Time correction',
          title: r.employeeName || 'An employee',
          detail: `${formatDay(r.date)} · ${r.reason}`,
          fields: [
            { label: 'Date', value: formatDate(r.date) },
            ...(r.requestedClockIn
              ? [{ label: 'Requested in', value: formatTime(r.requestedClockIn) }]
              : []),
            ...(r.requestedClockOut
              ? [{ label: 'Requested out', value: formatTime(r.requestedClockOut) }]
              : []),
            { label: 'Reason', value: r.reason },
          ],
          review: { type: 'correction' as const, id: r.id },
        }))
      : []),
    ...team
      .filter((r) => r.overallStatus === 'SelfSubmitted')
      .map((r) => {
        const deadline =
          typeof r.managerReviewDeadline === 'string' ? r.managerReviewDeadline : null;
        const daysUntil = deadline ? daysFromToday(deadline) : undefined;
        const cycle = typeof r.cycleName === 'string' ? r.cycleName : undefined;
        return {
          id: `team-appraisal-${String(r.id)}`,
          kind: 'Team appraisal',
          title: typeof r.employeeName === 'string' ? r.employeeName : 'A team member',
          detail:
            deadline && daysUntil !== undefined
              ? `${cycle ? `${cycle} · ` : ''}${describeDaysUntil(daysUntil)}`
              : cycle,
          fields: [
            ...(cycle ? [{ label: 'Appraisal cycle', value: cycle }] : []),
            ...(deadline && daysUntil !== undefined
              ? [
                  { label: 'Review deadline', value: formatDate(deadline) },
                  { label: 'Status', value: describeDaysUntil(daysUntil) },
                ]
              : []),
          ],
          dueInDays: daysUntil,
        };
      }),
    ...(canApproveShiftSwap
      ? swaps.map((r) => {
          const requester = r.requesterEmployee
            ? `${r.requesterEmployee.firstName} ${r.requesterEmployee.lastName}`
            : 'An employee';
          const target = r.targetEmployee
            ? `${r.targetEmployee.firstName} ${r.targetEmployee.lastName}`
            : 'a colleague';
          return {
            id: `swap-${r.id}`,
            kind: 'Shift swap',
            title: `${requester} ⇄ ${target}`,
            detail: `${formatDay(r.requesterShiftDate)} ⇄ ${formatDay(r.targetShiftDate)}`,
            fields: [
              { label: 'Requested by', value: requester },
              { label: 'Swap with', value: target },
              { label: `${requester}'s shift`, value: formatDate(r.requesterShiftDate) },
              { label: `${target}'s shift`, value: formatDate(r.targetShiftDate) },
              ...(r.reason ? [{ label: 'Reason', value: r.reason }] : []),
            ],
            review: { type: 'swap' as const, id: r.id },
          };
        })
      : []),
    ...(canApprovePayroll
      ? fromCount(
          'payroll',
          'Payroll',
          'Payroll run awaiting approval',
          pending?.payrollApprovals ?? 0,
        )
      : []),
    ...(canFinalizeAppraisal
      ? fromCount(
          'appraisal-finalization',
          'Appraisal',
          'Appraisal to finalise',
          pending?.appraisalFinalizations ?? 0,
        )
      : []),
  ];

  // Overdue ones first; the sort is stable, so the rest keep their order.
  return [...all].sort((a, b) => Number((a.dueInDays ?? 0) >= 0) - Number((b.dueInDays ?? 0) >= 0));
}
