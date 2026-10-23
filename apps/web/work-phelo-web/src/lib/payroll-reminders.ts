import type { PayrollGroup } from '@/lib/payroll-groups';
import { daysFromToday } from '@/lib/reminder-dates';

/*
 * Which payday reminders are showing today. Plain data in, plain data out (no React, no browser), so
 * the same rules can run on a server later to send these as emails.
 */

export interface PayrollReminder {
  groupId: string;
  groupName: string;
  /** Local midnight of the payday this reminder is for. */
  payday: Date;
  /** Whole days from today to payday: positive ahead of it, 0 on the day, negative once it has passed. */
  daysUntil: number;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The payday falling in a given month (0-based). A fixed day is capped to the month's length. */
export function paydayInMonth(payday: PayrollGroup['payday'], year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = payday.kind === 'last_day' ? lastDay : Math.min(payday.day, lastDay);
  return new Date(year, month, day);
}

/**
 * The reminders to show now: for each monthly group with its reminder on, the payday that is within
 * `daysBefore` days, or already passed this month without payroll being run. `hasRunForMonth` says
 * whether payroll for that month (1-12) and year has been run, which clears the reminder.
 */
export function payrollReminders(
  groups: PayrollGroup[],
  hasRunForMonth: (month: number, year: number) => boolean,
  now: Date = new Date(),
): PayrollReminder[] {
  const today = startOfDay(now);
  const reminders: PayrollReminder[] = [];

  for (const group of groups) {
    // Only monthly pay is calculated so far.
    if (group.frequency !== 'monthly' || !group.reminder.enabled) continue;

    // This month's payday (which may have passed) and next month's (which may be coming up).
    for (const offset of [0, 1]) {
      const payday = paydayInMonth(group.payday, today.getFullYear(), today.getMonth() + offset);
      const daysUntil = daysFromToday(payday, now);
      const showing = daysUntil <= group.reminder.daysBefore;
      if (!showing || hasRunForMonth(payday.getMonth() + 1, payday.getFullYear())) continue;
      reminders.push({ groupId: group.id, groupName: group.name, payday, daysUntil });
    }
  }

  return reminders;
}
