export const PAY_FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const;
export type PayFrequencyKey = (typeof PAY_FREQUENCIES)[number];

export const PAYDAY_KINDS = ['day_of_month', 'last_day'] as const;
export type PaydayKindKey = (typeof PAYDAY_KINDS)[number];

/** Payday is capped at the 28th so every month has it; the last day covers the rest. */
export const MAX_PAYDAY_DAY = 28;
export const MAX_REMINDER_DAYS = 30;
