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
  /** Planned return (HH:mm). Null when none was given: the trip then holds its vehicle until completed. */
  returnTime: string | null;
  /** Someone has started the trip. Only a started trip is on route. */
  started: boolean;
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
 * A trip is started by a person, never by the clock, and then stays on route until a person
 * completes, cancels or reschedules it.
 * - BOOKED: not started yet, whatever the departure time says.
 * - ON_ROUTE: started.
 */
export function tripState(trip: Pick<TripWindow, 'started'>): TripState {
  return trip.started ? 'ON_ROUTE' : 'BOOKED';
}

/**
 * True once the return time has passed while the trip is still unresolved (meaningful for a started trip). A trip with no
 * planned return time can't be overdue: it simply stays on route until someone completes it.
 */
export function isOverdue(now: WallClock, trip: TripWindow): boolean {
  if (!trip.returnTime) return false;
  if (trip.travelDate < now.date) return true;
  if (trip.travelDate > now.date) return false;
  return now.time >= trip.returnTime;
}

/**
 * A trip can be completed once it has been started and either its return time has passed, or it
 * never had one.
 */
export function canComplete(now: WallClock, trip: TripWindow): boolean {
  return trip.started && (!trip.returnTime || isOverdue(now, trip));
}

/** Whole minutes from one HH:mm to another on the same day (negative if `to` is earlier). */
export function minutesBetween(from: string, to: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(to) - toMinutes(from);
}

/** The strongest state across a resource's trips: on route beats booked. */
export function strongestState(states: TripState[]): TripState | null {
  if (states.includes('ON_ROUTE')) return 'ON_ROUTE';
  if (states.includes('BOOKED')) return 'BOOKED';
  return null;
}
