/**
 * Injectable Clock service.
 *
 * Every part of the app that needs "today" or "now" should ask a Clock
 * instance rather than calling `new Date()` directly. This lets tests pin
 * time deterministically (leap years, month boundaries, timezone edges)
 * without scattering fake-timer setup everywhere, and lets the app itself
 * be reasoned about consistently.
 */
export interface Clock {
  /** The device's current local calendar date, with time-of-day stripped. */
  today(): LocalDate;
  /** The device's current local date and time. */
  now(): Date;
}

/**
 * A calendar date with no time-of-day or timezone component, represented
 * as plain integers. This is intentionally NOT a `Date` object: `Date`
 * carries a time and an implicit timezone, which is exactly the ambiguity
 * the spec's "device-local calendar dates" rule wants to avoid. Two devices
 * showing "August 12" should agree on what that means, independent of what
 * hour it is or what timezone produced it.
 */
export interface LocalDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export function localDateFromJsDate(d: Date): LocalDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function jsDateFromLocalDate(d: LocalDate): Date {
  return new Date(d.year, d.month - 1, d.day);
}

export function localDateToISO(d: LocalDate): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return jsDateFromLocalDate(a).getTime() - jsDateFromLocalDate(b).getTime();
}

export function addDays(d: LocalDate, days: number): LocalDate {
  const jsD = jsDateFromLocalDate(d);
  jsD.setDate(jsD.getDate() + days);
  return localDateFromJsDate(jsD);
}

/** The real, device-backed Clock used in production. */
export class SystemClock implements Clock {
  today(): LocalDate {
    return localDateFromJsDate(new Date());
  }
  now(): Date {
    return new Date();
  }
}

/** A fixed Clock for tests and deterministic scenarios. */
export class FixedClock implements Clock {
  private fixed: LocalDate;

  constructor(fixed: LocalDate) {
    this.fixed = fixed;
  }
  today(): LocalDate {
    return this.fixed;
  }
  now(): Date {
    return jsDateFromLocalDate(this.fixed);
  }
  set(fixed: LocalDate) {
    this.fixed = fixed;
  }
}
