import { useMemo } from 'react';
import type { SeriesPoint } from '@/hooks/useDashboardSummary';
import { slotKey, slotLabel, slotsBetween, type DashboardPeriod } from './period';

export interface ChartRow {
  label: string;
  prevLabel: string | null;
  net: number;
  orders: number;
  prevNet: number | null;
  prevOrders: number | null;
}

/** One row per chart slot; the previous period lines up slot by slot. */
export function useChartData(
  period: DashboardPeriod,
  firstSale: string | null | undefined,
  series: SeriesPoint[],
  previous: SeriesPoint[]
): ChartRow[] {
  return useMemo(() => {
    const start = period.start ?? (firstSale ? new Date(firstSale) : period.end);
    const slots = slotsBetween(start, period.end, period.bucket);
    const prevSlots = period.prevStart && period.prevEnd ? slotsBetween(period.prevStart, period.prevEnd, period.bucket) : [];
    const byKey = new Map(series.map((p) => [p.slot, p]));
    const prevByKey = new Map(previous.map((p) => [p.slot, p]));
    return slots.map((d, i) => {
      const cur = byKey.get(slotKey(d));
      const prevSlot = prevSlots[i];
      const prev = prevSlot ? prevByKey.get(slotKey(prevSlot)) : undefined;
      return {
        label: slotLabel(d, period.bucket),
        prevLabel: prevSlot ? slotLabel(prevSlot, period.bucket) : null,
        net: cur?.net ?? 0,
        orders: cur?.orders ?? 0,
        prevNet: prevSlot ? prev?.net ?? 0 : null,
        prevOrders: prevSlot ? prev?.orders ?? 0 : null,
      };
    });
  }, [period, firstSale, series, previous]);
}
