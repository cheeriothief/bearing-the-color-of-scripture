import type { LocalDate } from "../services/clock";
import { localDateToISO } from "../services/clock";

/**
 * Whether the Threshold screen should show, given when it was last shown
 * and today's date. Pure and testable independent of storage or React.
 *
 * Per the spec, Threshold "can recur every launch, once per day, or after
 * a configurable amount of time away from the app" — this implements the
 * "once per day" option, the middle ground between showing it so often it
 * becomes an annoyance and so rarely it stops doing its job as a
 * transition into the reading practice.
 */
export function shouldShowThreshold(lastShownISO: string | null, today: LocalDate): boolean {
  if (!lastShownISO) return true;
  return lastShownISO !== localDateToISO(today);
}
