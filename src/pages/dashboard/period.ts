import {
  addDays,
  addHours,
  addMonths,
  differenceInCalendarDays,
  differenceInMilliseconds,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfHour,
  startOfMonth,
  subMilliseconds,
  subMonths,
  subYears,
} from 'date-fns';

export type Bucket = 'hour' | 'day' | 'month';

/** What the dashboard shows: a period, the one it is compared with, and how the chart splits it. */
export interface DashboardPeriod {
  start: Date | null;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
  bucket: Bucket;
  label: string;
  prevLabel: string | null;
}

/** Hours for a single day, days up to about three months, months beyond. */
export function bucketFor(start: Date | null, end: Date): Bucket {
  if (!start) return 'month';
  const days = differenceInCalendarDays(end, start) + 1;
  if (days <= 1) return 'hour';
  if (days <= 92) return 'day';
  return 'month';
}

/** "1–26 Oct"; the year only when it isn't the current one. */
export function rangeLabel(start: Date | null, end: Date, now = new Date()): string {
  if (!start) return 'All time';
  const y = isSameYear(start, now) && isSameYear(end, now) ? '' : ' yyyy';
  if (isSameDay(start, end)) return format(start, `d MMM${y}`);
  if (isSameMonth(start, end)) return `${format(start, 'd')}–${format(end, `d MMM${y}`)}`;
  if (isSameYear(start, end)) return `${format(start, 'd MMM')} – ${format(end, `d MMM${y}`)}`;
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

/**
 * The period before, the same length: a range starting on the 1st of a month
 * compares with the same days of the month before, one starting on 1 January
 * with the same days of the year before, anything else with the stretch just
 * before it. None when it would reach back past what the user may see.
 */
function previousRange(start: Date, end: Date, minDate?: Date): { start: Date; end: Date } | null {
  let prev: { start: Date; end: Date };
  if (start.getDate() === 1 && start.getMonth() === 0 && differenceInCalendarDays(end, start) > 31) {
    prev = { start: subYears(start, 1), end: subYears(end, 1) };
  } else if (start.getDate() === 1 && isSameMonth(start, end)) {
    const prevStart = subMonths(start, 1);
    // 1–31 Oct compares with all of September, not "1 Oct" spilling over.
    const prevEnd = subMonths(end, 1);
    prev = { start: prevStart, end: isSameMonth(prevEnd, prevStart) ? prevEnd : endOfDay(subMilliseconds(start, 1)) };
  } else {
    const length = differenceInMilliseconds(end, start);
    const prevEnd = subMilliseconds(start, 1);
    prev = { start: subMilliseconds(prevEnd, length), end: prevEnd };
  }
  if (minDate && prev.start < minDate) return null;
  return prev;
}

export function buildPeriod(range: { from?: Date; to?: Date } | undefined, now: Date, minDate?: Date): DashboardPeriod {
  const start = range?.from ? startOfDay(range.from) : null;
  const end = range?.to ? endOfDay(range.to) : endOfDay(now);
  const prev = start ? previousRange(start, end, minDate) : null;
  return {
    start,
    end,
    prevStart: prev?.start ?? null,
    prevEnd: prev?.end ?? null,
    bucket: bucketFor(start, end),
    label: rangeLabel(start, end, now),
    prevLabel: prev ? rangeLabel(prev.start, prev.end, now) : null,
  };
}

/** Slot keys as the database writes them: local "yyyy-MM-ddTHH". */
export const slotKey = (d: Date) => format(d, "yyyy-MM-dd'T'HH");

export function slotsBetween(start: Date, end: Date, bucket: Bucket): Date[] {
  const out: Date[] = [];
  let d = bucket === 'hour' ? startOfHour(start) : bucket === 'day' ? startOfDay(start) : startOfMonth(start);
  const step = bucket === 'hour' ? (x: Date) => addHours(x, 1) : bucket === 'day' ? (x: Date) => addDays(x, 1) : (x: Date) => addMonths(x, 1);
  while (d <= end && out.length < 400) {
    out.push(d);
    d = step(d);
  }
  return out;
}

export function slotLabel(d: Date, bucket: Bucket): string {
  if (bucket === 'hour') return format(d, 'HH:00');
  if (bucket === 'day') return format(d, 'd MMM');
  return format(d, 'MMM yyyy');
}
