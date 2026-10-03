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
 * A trip starts by itself at its departure time and then stays on route until a
 * person completes, cancels or reschedules it. It never ends on the clock alone.
 * - BOOKED: the departure time has not come yet.
 * - ON_ROUTE: departure has passed (even if the return time has too).
 */
export function tripState(now: WallClock, trip: TripWindow): TripState {
  if (trip.travelDate > now.date) return 'BOOKED';
  if (trip.travelDate < now.date) return 'ON_ROUTE';
  return now.time >= trip.departureTime ? 'ON_ROUTE' : 'BOOKED';
}

/** True once the return time has passed while the trip is still unresolved. */
export function isOverdue(now: WallClock, trip: TripWindow): boolean {
  if (trip.travelDate < now.date) return true;
  if (trip.travelDate > now.date) return false;
  return now.time >= trip.returnTime;
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
