/**
 * Payroll groups: the user's own sets of employees who are paid the same way. A group picks how
 * often it is paid, the day, the payroll configuration it uses and when to remind the payroll
 * managers. Front-end only for now; the backend follows once the screens are settled.
 */

export type PayFrequency = 'monthly' | 'weekly' | 'biweekly';

/** A day of the month (1 to 28, so every month has it) or the last day of the month. */
export type Payday = { kind: 'day_of_month'; day: number } | { kind: 'last_day' };

export interface PayrollGroup {
  id: string;
  name: string;
  frequency: PayFrequency;
  payday: Payday;
  /** The configuration (see the payroll engine) this group is calculated with. */
  configurationId: string | null;
  reminder: { enabled: boolean; daysBefore: number };
  /** How many employees are in the group. */
  employeeCount: number;
}

export type PayrollGroupInput = Omit<PayrollGroup, 'id' | 'employeeCount'> & { id?: string };

export const FREQUENCY_OPTIONS: {
  value: PayFrequency;
  label: string;
  /** The calculation only handles monthly pay so far. */
  available: boolean;
}[] = [
  { value: 'monthly', label: 'Monthly', available: true },
  { value: 'biweekly', label: 'Every two weeks', available: false },
  { value: 'weekly', label: 'Weekly', available: false },
];

export const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Every two weeks',
  weekly: 'Weekly',
};

export const REMINDER_DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14];

export const DEFAULT_REMINDER_DAYS = 3;

export const ordinal = (n: number) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

export function describePayday(payday: Payday): string {
  return payday.kind === 'last_day'
    ? 'Last day of every month'
    : `${ordinal(payday.day)} of every month`;
}

export function describeReminder(reminder: PayrollGroup['reminder']): string {
  if (!reminder.enabled) return 'Off';
  return reminder.daysBefore === 1
    ? '1 day before payday'
    : `${reminder.daysBefore} days before payday`;
}

/** Why a group can't be saved yet, or null when it can. */
export function checkGroup(
  group: Pick<PayrollGroup, 'name' | 'configurationId'>,
  others: PayrollGroup[],
): string | null {
  const name = group.name.trim();
  if (!name) return 'Give the group a name.';
  if (others.some((g) => g.name.trim().toLowerCase() === name.toLowerCase())) {
    return 'Another group already has that name.';
  }
  if (!group.configurationId) return 'Choose the configuration this group is calculated with.';
  return null;
}
