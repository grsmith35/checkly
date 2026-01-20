import { ISODate, RecurrenceRule } from "../types";
import { addDays, addMonths, addYears, fromISODate, toISODate } from "./date";

export function computeNextDueDate(
  currentDue: ISODate,
  rule: RecurrenceRule,
  completionDate: ISODate
): ISODate | undefined {
  if (rule.kind === "none") return undefined;

  // Anchor from completion date (best for chores)
  const base = fromISODate(completionDate);

  const interval = Math.max(1, rule.interval);
  const unit = rule.unit;

  let next: Date;
  if (unit === "day") next = addDays(base, interval);
  else if (unit === "week") next = addDays(base, 7 * interval);
  else if (unit === "month") next = addMonths(base, interval);
  else next = addYears(base, interval);

  const nextIso = toISODate(next);
  if (nextIso <= currentDue) {
    // bump once more if something odd happened
    return computeNextDueDate(nextIso, rule, nextIso);
  }
  return nextIso;
}
