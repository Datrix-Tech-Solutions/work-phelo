/**
 * Trip timing, worked out from wall-clock strings so no date arithmetic or
 * timezone maths is needed: a request stores "2026-10-20" plus "10:00"/"12:00",
 * and "now" is read as the same kind of date and time in the business timezone.
 */
export type TripState = 'BOOKED' | 'ON_ROUTE';

export interface WallClock {
  /** YYYY-MM-DD */
  date: string;
  /** 24h HH:mm */
  time: string;
}

export interface TripWindow {
  /** YYYY-MM-DD */
  travelDate: string;
  departureTime: string;
  returnTime: string;
}

export const DEFAULT_TRANSPORT_TIMEZONE = 'Africa/Accra';

/** The current date and time as a wall clock in `timeZone`. */
export function wallClockNow(
  timeZone: string,
  at: Date = new Date(),
): WallClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/**
 * - ENDED: the return time has passed (or the date is gone).
 * - ON_ROUTE: today, from the departure time until the return time.
 * - BOOKED: still to come, later today or on a future date.
 */
export function tripState(
  now: WallClock,
  trip: TripWindow,
): TripState | 'ENDED' {
  if (trip.travelDate < now.date) return 'ENDED';
  if (trip.travelDate > now.date) return 'BOOKED';
  if (now.time >= trip.returnTime) return 'ENDED';
  if (now.time >= trip.departureTime) return 'ON_ROUTE';
  return 'BOOKED';
}

/** The strongest state across a resource's trips: on route beats booked. */
export function strongestState(states: TripState[]): TripState | null {
  if (states.includes('ON_ROUTE')) return 'ON_ROUTE';
  if (states.includes('BOOKED')) return 'BOOKED';
  return null;
}
