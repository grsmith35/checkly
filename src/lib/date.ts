import { ISODate } from "../types";

export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}` as ISODate;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // clamp (e.g. Jan 31 + 1 month => Feb 28/29)
  while (d.getDate() < day) d.setDate(d.getDate() - 1);
  return d;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return a < b;
}

export function formatNice(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
