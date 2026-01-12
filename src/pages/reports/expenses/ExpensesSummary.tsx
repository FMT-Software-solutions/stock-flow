import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
} from 'date-fns';
import type { Expense } from '@/types/expenses';

type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

function startOfUnit(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return startOfDay(date);
  if (unit === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  if (unit === 'month') return startOfMonth(date);
  if (unit === 'quarter') return startOfQuarter(date);
  return startOfYear(date);
}

function nextBucket(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return addDays(date, 1);
  if (unit === 'week') return addWeeks(date, 1);
  if (unit === 'month') return addMonths(date, 1);
  if (unit === 'quarter') return addQuarters(date, 1);
  return addYears(date, 1);
}

function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMM dd, yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMM yyyy');
  if (unit === 'quarter')
    return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

interface ExpensesSummaryProps {
  expenses: Expense[];
  groupUnit: GroupUnit;
  dateRange?: DateRange;
}

export function ExpensesSummary({
  expenses,
  groupUnit,
  dateRange,
}: ExpensesSummaryProps) {
  const buckets = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      const start = startOfUnit(dateRange.from, groupUnit);
      const end = startOfUnit(dateRange.to, groupUnit);
      const cols: string[] = [];
      let cur = start;
      while (cur <= end) {
        cols.push(dateToBucketKey(cur.toISOString(), groupUnit));
        cur = nextBucket(cur, groupUnit);
      }
      return cols.reverse();
    }
    const bucketDates = new Map<string, number>();
    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const start = startOfUnit(d, groupUnit);
      const key = dateToBucketKey(start.toISOString(), groupUnit);
      const ts = start.getTime();
      if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
        bucketDates.set(key, ts);
      }
    });
    return Array.from(bucketDates.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [expenses, dateRange, groupUnit]);

  const bucketAgg = useMemo(() => {
    const agg: Record<string, { amount: number }> = {};
    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const amt = e.amount || 0;
      const cur = agg[key] || { amount: 0 };
      cur.amount += amt;
      agg[key] = cur;
    });
    return agg;
  }, [expenses, groupUnit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-130 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 min-w-50">Time</th>
                <th className="text-right p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const c = bucketAgg[b] || { amount: 0 };
                return (
                  <tr key={b} className="border-t">
                    <td className="p-2">{b}</td>
                    <td className="p-2 text-right">
                      <CurrencyDisplay amount={c.amount} />
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const grand = Object.values(bucketAgg).reduce(
                  (acc, v) => ({ amount: acc.amount + v.amount }),
                  { amount: 0 }
                );
                return (
                  <tr className="border-t font-bold">
                    <td className="p-2 sticky bottom-0 bg-card min-w-30">
                      Total
                    </td>
                    <td className="p-2 text-right sticky bottom-0 bg-card">
                      <CurrencyDisplay amount={grand.amount} />
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
