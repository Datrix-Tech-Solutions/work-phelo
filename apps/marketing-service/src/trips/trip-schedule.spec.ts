import {
  isOverdue,
  minutesBetween,
  strongestState,
  tripState,
  wallClockNow,
} from './trip-schedule';

const trip = {
  travelDate: '2026-10-20',
  departureTime: '10:00',
  returnTime: '12:00',
};
const clock = (date: string, time: string) => ({ date, time });

describe('tripState', () => {
  it.each([
    ['the day before', '2026-10-19', '23:59', 'BOOKED'],
    ['earlier the same day', '2026-10-20', '09:59', 'BOOKED'],
    ['the minute it departs', '2026-10-20', '10:00', 'ON_ROUTE'],
    ['part way through', '2026-10-20', '11:30', 'ON_ROUTE'],
    [
      'after the return time, still unresolved',
      '2026-10-20',
      '18:00',
      'ON_ROUTE',
    ],
    ['the next day, still unresolved', '2026-10-21', '00:00', 'ON_ROUTE'],
    ['long after, still unresolved', '2026-11-30', '09:00', 'ON_ROUTE'],
  ])('is %s → %s', (_label, date, time, expected) => {
    expect(tripState(clock(date, time), trip)).toBe(expected);
  });
});

describe('isOverdue', () => {
  it.each([
    ['before it departs', '2026-10-20', '09:00', false],
    ['while it is out within its window', '2026-10-20', '11:59', false],
    ['the minute it is due back', '2026-10-20', '12:00', true],
    ['later the same day', '2026-10-20', '18:00', true],
    ['on a later day', '2026-10-21', '08:00', true],
    ['a future trip', '2026-10-19', '23:59', false],
  ])('is %s → %s', (_label, date, time, expected) => {
    expect(isOverdue(clock(date, time), trip)).toBe(expected);
  });
});

describe('minutesBetween', () => {
  it('measures late, early and on time', () => {
    expect(minutesBetween('12:00', '12:40')).toBe(40);
    expect(minutesBetween('12:00', '11:45')).toBe(-15);
    expect(minutesBetween('12:00', '12:00')).toBe(0);
    expect(minutesBetween('09:30', '17:05')).toBe(455);
  });
});

describe('strongestState', () => {
  it('prefers on route over booked, and booked over nothing', () => {
    expect(strongestState(['BOOKED', 'ON_ROUTE'])).toBe('ON_ROUTE');
    expect(strongestState(['BOOKED', 'BOOKED'])).toBe('BOOKED');
    expect(strongestState([])).toBeNull();
  });
});

describe('wallClockNow', () => {
  const instant = new Date('2026-10-20T23:30:00.000Z');

  it('reads the date and time in the given timezone', () => {
    expect(wallClockNow('UTC', instant)).toEqual({
      date: '2026-10-20',
      time: '23:30',
    });
    // Accra is UTC+0 all year, so it matches UTC.
    expect(wallClockNow('Africa/Accra', instant)).toEqual({
      date: '2026-10-20',
      time: '23:30',
    });
  });

  it('rolls the date forward for zones ahead of UTC', () => {
    expect(wallClockNow('Africa/Lagos', instant)).toEqual({
      date: '2026-10-21',
      time: '00:30',
    });
  });

  it('never renders midnight as 24:00', () => {
    const midnight = new Date('2026-10-21T00:05:00.000Z');
    expect(wallClockNow('UTC', midnight).time).toBe('00:05');
  });
});
