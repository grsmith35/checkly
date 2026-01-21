import { ISODate, RecurrenceRule } from "../types";
import { addDays, addMonths, addYears, fromISODate, toISODate } from "./date";

type RecurrenceConstraint = {
  month?: number; // 1-12
  week?: number; // 1-5
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function weekStartDay(year: number, month: number, week: number) {
  const day = 1 + (Math.max(1, week) - 1) * 7;
  return Math.min(day, daysInMonth(year, month));
}

function advanceConstrained(
  baseDue: ISODate,
  rule: RecurrenceRule,
  constraint: RecurrenceConstraint
): ISODate {
  const interval = Math.max(1, rule.interval);
  const base = fromISODate(baseDue);

  if (rule.unit === "year") {
    const targetYear = base.getFullYear() + interval;
    const month = constraint.month ?? base.getMonth() + 1;
    const day = constraint.week ? weekStartDay(targetYear, month, constraint.week) : 1;
    return toISODate(new Date(targetYear, month - 1, day, 12, 0, 0, 0));
  }

  // month
  const advanced = addMonths(base, interval);
  const year = advanced.getFullYear();
  const month = advanced.getMonth() + 1;
  const day = constraint.week ? weekStartDay(year, month, constraint.week) : advanced.getDate();
  return toISODate(new Date(year, month - 1, day, 12, 0, 0, 0));
}

export function computeNextDueDate(
  currentDue: ISODate,
  rule: RecurrenceRule,
  completionDate: ISODate,
  constraint?: RecurrenceConstraint
): ISODate | undefined {
  if (rule.kind === "none") return undefined;

  const hasConstraint = !!(constraint?.month || constraint?.week);
  const constraintApplies =
    hasConstraint && (rule.unit === "year" || (rule.unit === "month" && !!constraint?.week));

  if (constraintApplies) {
    let next = advanceConstrained(currentDue, rule, constraint ?? {});
    while (next <= completionDate) {
      next = advanceConstrained(next, rule, constraint ?? {});
    }
    return next;
  }

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
    return computeNextDueDate(nextIso, rule, nextIso, constraint);
  }
  return nextIso;
}

export function computeInitialDueDate(
  startDate: ISODate,
  rule: RecurrenceRule,
  constraint?: RecurrenceConstraint
): ISODate | undefined {
  if (rule.kind === "none") return undefined;

  const hasConstraint = !!(constraint?.month || constraint?.week);
  const constraintApplies =
    hasConstraint && (rule.unit === "year" || (rule.unit === "month" && !!constraint?.week));

  if (!constraintApplies) return startDate;

  const base = fromISODate(startDate);

  if (rule.unit === "year") {
    const month = constraint?.month ?? base.getMonth() + 1;
    const day = constraint?.week ? weekStartDay(base.getFullYear(), month, constraint.week) : 1;
    let candidate = toISODate(new Date(base.getFullYear(), month - 1, day, 12, 0, 0, 0));
    while (candidate < startDate) {
      candidate = advanceConstrained(candidate, rule, constraint ?? {});
    }
    return candidate;
  }

  // month with week constraint
  const day = constraint?.week
    ? weekStartDay(base.getFullYear(), base.getMonth() + 1, constraint.week)
    : base.getDate();
  let candidate = toISODate(new Date(base.getFullYear(), base.getMonth(), day, 12, 0, 0, 0));
  while (candidate < startDate) {
    candidate = advanceConstrained(candidate, rule, constraint ?? {});
  }
  return candidate;
}
