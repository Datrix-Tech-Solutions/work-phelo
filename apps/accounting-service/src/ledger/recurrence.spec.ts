import {
  addRecurrenceInterval,
  calculateNextRunDate,
  dateOnly,
  isoDay,
} from './recurrence';

describe('recurrence', () => {
  describe('addRecurrenceInterval', () => {
    it('steps days and weeks', () => {
      expect(addRecurrenceInterval('2026-01-31', 'DAILY')).toBe('2026-02-01');
      expect(addRecurrenceInterval('2026-12-28', 'WEEKLY')).toBe('2027-01-04');
    });

    it('clamps a month-end start to shorter months and returns to it afterwards', () => {
      const anchor = '2026-01-31';
      const feb = addRecurrenceInterval(anchor, 'MONTHLY', anchor);
      expect(feb).toBe('2026-02-28');
      // Anchored to the 31st, so March is the 31st again, not the 28th.
      expect(addRecurrenceInterval(feb, 'MONTHLY', anchor)).toBe('2026-03-31');
    });

    it('handles quarters and years, including leap days', () => {
      expect(addRecurrenceInterval('2026-11-30', 'QUARTERLY')).toBe(
        '2027-02-28',
      );
      const anchor = '2028-02-29';
      expect(addRecurrenceInterval(anchor, 'ANNUALLY', anchor)).toBe(
        '2029-02-28',
      );
      expect(addRecurrenceInterval('2029-02-28', 'ANNUALLY', anchor)).toBe(
        '2030-02-28',
      );
    });
  });

  describe('calculateNextRunDate', () => {
    it('is the start date while it is still ahead', () => {
      expect(calculateNextRunDate('2026-10-01', 'MONTHLY', '2026-09-21')).toBe(
        '2026-10-01',
      );
    });

    it('is the start date when it is today', () => {
      expect(calculateNextRunDate('2026-09-21', 'MONTHLY', '2026-09-21')).toBe(
        '2026-09-21',
      );
    });

    it('skips dates that already passed instead of backfilling them', () => {
      expect(calculateNextRunDate('2026-06-15', 'MONTHLY', '2026-09-21')).toBe(
        '2026-10-15',
      );
      expect(calculateNextRunDate('2026-09-01', 'WEEKLY', '2026-09-21')).toBe(
        '2026-09-22',
      );
    });
  });

  describe('date helpers', () => {
    it('round-trips a calendar date through a UTC-midnight Date', () => {
      expect(isoDay(dateOnly('2026-09-21'))).toBe('2026-09-21');
      expect(dateOnly('2026-09-21T13:45:00.000Z').toISOString()).toBe(
        '2026-09-21T00:00:00.000Z',
      );
    });
  });
});
