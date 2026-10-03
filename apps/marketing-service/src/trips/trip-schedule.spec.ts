import { strongestState, tripState, wallClockNow } from './trip-schedule';

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
    ['one minute before it ends', '2026-10-20', '11:59', 'ON_ROUTE'],
    ['the minute it is due back', '2026-10-20', '12:00', 'ENDED'],
    ['later the same day', '2026-10-20', '18:00', 'ENDED'],
    ['the next day', '2026-10-21', '00:00', 'ENDED'],
  ])('is %s → %s', (_label, date, time, expected) => {
    expect(tripState(clock(date, time), trip)).toBe(expected);
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
