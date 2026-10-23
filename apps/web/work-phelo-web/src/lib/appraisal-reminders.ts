/*
 * When appraisal deadlines turn into reminders. The hr-service already emails and notifies people 7
 * days, 3 days and on the day of a deadline; the reminders list starts at the same 7 days so what is
 * emailed is also there, and keeps it until the work is done, since an email is only sent once.
 */
export const APPRAISAL_REMINDER_DAYS = 7;
