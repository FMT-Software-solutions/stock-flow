import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { dateToBucketKey, startOfUnit, nextBucket } from './utils';
import type { GroupUnit } from './utils';

interface OrderLike {
  date?: string;
  created_at?: string;
  total_amount?: number;
  paid_amount?: number;
  payment_status?: string | null;
}

interface SalesSummaryProps {
  orders: OrderLike[];
  groupUnit: GroupUnit;
  dateRange?: DateRange;
}

export function SalesSummary({
  orders,
  groupUnit,
  dateRange,
}: SalesSummaryProps) {
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
    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
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
  }, [orders, dateRange, groupUnit]);

  const bucketAgg = useMemo(() => {
    const agg: Record<string, { paid: number; due: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const total = o.total_amount || 0;
      const paid = o.paid_amount || 0;
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      const cur = agg[key] || { paid: 0, due: 0 };
      cur.paid += paid;
      cur.due += due;
      agg[key] = cur;
    });
    return agg;
  }, [orders, groupUnit]);

  return (
    <Card className="bg-card/20">
      <CardHeader>
        <CardTitle>Sales Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-130 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 min-w-50">Time</th>
                <th className="text-right p-2">Revenue</th>
                <th className="text-right p-2">Owings</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const c = bucketAgg[b] || { paid: 0, due: 0 };
                return (
                  <tr key={b} className="border-t">
                    <td className="p-2">{b}</td>
                    <td className="p-2 text-right">
                      <CurrencyDisplay amount={c.paid} />
                    </td>
                    <td className="p-2 text-right">
                      <CurrencyDisplay amount={c.due} />
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const grand = Object.values(bucketAgg).reduce(
                  (acc, v) => ({
                    paid: acc.paid + v.paid,
                    due: acc.due + v.due,
                  }),
                  { paid: 0, due: 0 }
                );
                return (
                  <tr className="border-t font-bold">
                    <td className="p-2 sticky bottom-0 bg-card min-w-30">
                      Total
                    </td>
                    <td className="p-2 text-right sticky bottom-0 bg-card">
                      <CurrencyDisplay amount={grand.paid} />
                    </td>
                    <td className="p-2 text-right sticky bottom-0 bg-card">
                      <CurrencyDisplay amount={grand.due} />
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
