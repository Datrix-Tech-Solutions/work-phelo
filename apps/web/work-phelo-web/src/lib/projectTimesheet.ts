import { accruedAmount } from '@/lib/taskTime';

/** One piece of a person's time on a task, as the server sends it. */
export interface TimeEntry {
  taskId: string;
  taskName: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  source: 'TIMER' | 'MANUAL';
  startedAt: string | null;
  endedAt: string | null;
  /** Negative for a correction that takes time off. */
  seconds: number;
  note: string | null;
  createdAt: string;
}

/** YYYY-MM-DD, both days included; an empty end is open. */
export interface TimesheetPeriod {
  from: string;
  to: string;
}

/** Midnight at the start of a YYYY-MM-DD day, local time, `add` days on. */
function dayStart(day: string, add = 0): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + add).getTime();
}

/**
 * The seconds of an entry that fall inside the period. A timer session is cut at the period's edges;
 * time entered by hand counts whole on the day it was worked, or the day it was added when that
 * wasn't recorded.
 */
export function secondsInPeriod(entry: TimeEntry, { from, to }: TimesheetPeriod): number {
  const first = from ? dayStart(from) : -Infinity;
  const end = to ? dayStart(to, 1) : Infinity;
  if (entry.source === 'TIMER' && entry.startedAt) {
    const start = new Date(entry.startedAt).getTime();
    const overlap = Math.min(start + entry.seconds * 1000, end) - Math.max(start, first);
    return Math.max(0, Math.floor(overlap / 1000));
  }
  let day: number;
  if (entry.startedAt) {
    day = dayStart(entry.startedAt.slice(0, 10));
  } else {
    const added = new Date(entry.createdAt);
    day = new Date(added.getFullYear(), added.getMonth(), added.getDate()).getTime();
  }
  return day >= first && day < end ? entry.seconds : 0;
}

interface Person {
  employeeId: string;
  name: string;
  department?: string | null;
  hourlyRate?: number | null;
}

interface Input {
  entries: TimeEntry[];
  members: Person[];
  /** Whose time to include. */
  employeeIds: string[];
  period: TimesheetPeriod;
}

/** The two lists of the timesheet: each person's time per task, and each person's total. */
export function timesheetRows({ entries, members, employeeIds, period }: Input) {
  const wanted = new Set(employeeIds);
  const byTask = new Map<
    string,
    { employeeId: string; member: string; department: string; task: string; seconds: number }
  >();
  for (const e of entries) {
    if (!wanted.has(e.employeeId)) continue;
    const seconds = secondsInPeriod(e, period);
    if (seconds === 0) continue;
    const key = `${e.employeeId}:${e.taskId}`;
    const member = members.find((m) => m.employeeId === e.employeeId);
    const row = byTask.get(key) ?? {
      employeeId: e.employeeId,
      member: member?.name ?? e.employeeName,
      department: member?.department ?? e.department ?? '—',
      task: e.taskName,
      seconds: 0,
    };
    row.seconds += seconds;
    byTask.set(key, row);
  }
  // A correction can cancel a task's time out altogether.
  const tasks = [...byTask.values()]
    .filter((r) => r.seconds !== 0)
    .sort((a, b) => a.member.localeCompare(b.member) || a.task.localeCompare(b.task));

  const byPerson = new Map<string, (typeof tasks)[number]>();
  for (const row of tasks) {
    const total = byPerson.get(row.employeeId);
    if (total) total.seconds += row.seconds;
    else byPerson.set(row.employeeId, { ...row });
  }
  const totals = [...byPerson.values()].map(({ employeeId, member, department, seconds }) => {
    const rate = members.find((m) => m.employeeId === employeeId)?.hourlyRate ?? 0;
    return {
      member,
      department,
      seconds,
      /** At the person's current rate, to the whole minute; null without a rate. */
      amount: rate > 0 ? accruedAmount(seconds * 1000, rate) : null,
    };
  });
  return { tasks, totals };
}

/** A workbook of the rows: a Timesheet tab by task, and a Totals tab by person. */
export async function buildTimesheetWorkbook(
  { tasks, totals }: ReturnType<typeof timesheetRows>,
  /** Whether the totals carry an amount, which they do on a project billed by time. */
  withAmount: boolean,
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Timesheet');
  sheet.columns = [
    { header: 'Member', key: 'member', width: 30 },
    { header: 'Department', key: 'department', width: 24 },
    { header: 'Task', key: 'task', width: 44 },
    { header: 'Hours', key: 'hours', width: 12, style: { numFmt: '0.00' } },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of tasks) {
    sheet.addRow({
      member: r.member,
      department: r.department,
      task: r.task,
      hours: r.seconds / 3600,
    });
  }

  const summary = workbook.addWorksheet('Totals');
  summary.columns = [
    { header: 'Member', key: 'member', width: 30 },
    { header: 'Department', key: 'department', width: 24 },
    { header: 'Hours', key: 'hours', width: 12, style: { numFmt: '0.00' } },
    ...(withAmount
      ? [{ header: 'Amount (GHS)', key: 'amount', width: 18, style: { numFmt: '#,##0.00' } }]
      : []),
  ];
  summary.getRow(1).font = { bold: true };
  for (const r of totals) {
    summary.addRow({
      member: r.member,
      department: r.department,
      hours: r.seconds / 3600,
      ...(withAmount ? { amount: r.amount ?? 'No rate' } : {}),
    });
  }
  summary.addRow({
    member: 'Total',
    hours: totals.reduce((sum, r) => sum + r.seconds, 0) / 3600,
    ...(withAmount ? { amount: totals.reduce((sum, r) => sum + (r.amount ?? 0), 0) } : {}),
  }).font = { bold: true };

  return workbook;
}

/** e.g. `Website-timesheet-2026-12-01-to-2026-12-05.xlsx`. */
export function timesheetFileName(projectName: string, { from, to }: TimesheetPeriod) {
  const period = from || to ? `-${from || 'start'}-to-${to || 'today'}` : '';
  return `${projectName.replace(/[^\p{L}\p{N}]+/gu, '-')}-timesheet${period}.xlsx`;
}

export async function downloadWorkbook(workbook: import('exceljs').Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
