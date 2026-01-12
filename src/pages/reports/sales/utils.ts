import { format, addDays, addWeeks, addMonths, addQuarters, addYears, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';

export type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type RowGroup = 'order' | 'branch' | 'payment_status' | 'payment_method' | 'status' | 'customer';

export function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMM, dd yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMM yyyy');
  if (unit === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

export function nextBucket(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return addDays(date, 1);
  if (unit === 'week') return addWeeks(date, 1);
  if (unit === 'month') return addMonths(date, 1);
  if (unit === 'quarter') return addQuarters(date, 1);
  return addYears(date, 1);
}

export function startOfUnit(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return startOfDay(date);
  if (unit === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  if (unit === 'month') return startOfMonth(date);
  if (unit === 'quarter') return startOfQuarter(date);
  return startOfYear(date);
}

export function formatStatusLabel(s?: string | null) {
  if (!s) return 'Unknown';
  return s
    .toString()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function paymentStatusDisplay(s?: string | null) {
  const k = (s || '').toLowerCase();
  if (k === 'paid') return 'Fully Paid';
  if (k === 'partial') return 'Partially Paid';
  if (k === 'refunded') return 'Refunded';
  if (k === 'unpaid') return 'Unpaid';
  return formatStatusLabel(s);
}
