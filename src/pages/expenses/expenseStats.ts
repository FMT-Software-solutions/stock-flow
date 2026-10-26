import { differenceInCalendarDays } from 'date-fns';
import { changeVs } from '@/lib/statTones';
import type { StatTile } from '@/types/stats';
import type { Expense } from '@/types/expenses';

export const UNPAID_FILTER = ['pending', 'approved'];
export const NO_RECEIPT_FILTER = ['missing'];

/** The Expenses page figures. */
export function getExpenseStatTiles({
  expenses,
  money,
  previousTotal,
  prevLabel,
  range,
  isActive,
  toggle,
}: {
  expenses: Expense[];
  money: (n: number) => string;
  previousTotal?: number | null;
  prevLabel?: string | null;
  /** The date filter, for the daily average */
  range?: { from?: Date; to?: Date } | null;
  isActive: (id: string, values: string[]) => boolean;
  toggle: (id: string, values: string[]) => void;
}): StatTile[] {
  const amount = (e: Expense) => Number(e.amount) || 0;
  const total = expenses.reduce((s, e) => s + amount(e), 0);
  const unpaid = expenses.filter((e) => UNPAID_FILTER.includes(e.status));
  const unpaidTotal = unpaid.reduce((s, e) => s + amount(e), 0);
  const missing = expenses.filter((e) => !e.attachmentUrl).length;

  const byCategory = new Map<string, number>();
  expenses.forEach((e) => {
    const name = e.categoryName || 'Uncategorised';
    byCategory.set(name, (byCategory.get(name) ?? 0) + amount(e));
  });
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const largest = [...expenses].sort((a, b) => amount(b) - amount(a))[0];

  const dates = expenses.map((e) => new Date(e.date).getTime()).filter((t) => !Number.isNaN(t));
  const from = range?.from ?? (dates.length ? new Date(Math.min(...dates)) : null);
  const to = range?.to ?? (dates.length ? new Date(Math.max(...dates)) : null);
  const days = from && to ? Math.max(1, differenceInCalendarDays(to, from) + 1) : 0;

  const change = changeVs(total, previousTotal, prevLabel, true);

  return [
    { id: 'spent', label: 'Spent', value: money(total), valueTone: 'expense', sub: change?.text ?? `${expenses.length} expenses`, subTone: change?.tone },
    {
      id: 'unpaid',
      label: 'Not yet paid',
      value: money(unpaidTotal),
      valueTone: unpaidTotal > 0 ? 'warn' : undefined,
      sub: unpaid.length ? `${unpaid.length} ${unpaid.length === 1 ? 'expense' : 'expenses'}` : 'All paid',
      onClick: () => toggle('status', UNPAID_FILTER),
      active: isActive('status', UNPAID_FILTER),
    },
    {
      id: 'top',
      label: 'Top category',
      value: top ? top[0] : '—',
      sub: top && total > 0 ? `${money(top[1])} · ${Math.round((top[1] / total) * 100)}%` : undefined,
    },
    {
      id: 'largest',
      label: 'Largest expense',
      value: largest ? money(amount(largest)) : '—',
      sub: largest ? largest.description || largest.categoryName : undefined,
    },
    { id: 'daily', label: 'Per day', value: money(days ? total / days : 0), sub: days ? `over ${days} ${days === 1 ? 'day' : 'days'}` : undefined },
    {
      id: 'receipts',
      label: 'No receipt',
      value: missing.toLocaleString(),
      valueTone: missing > 0 ? 'warn' : undefined,
      sub: expenses.length ? `of ${expenses.length} expenses` : undefined,
      onClick: () => toggle('receipt', NO_RECEIPT_FILTER),
      active: isActive('receipt', NO_RECEIPT_FILTER),
    },
  ];
}
