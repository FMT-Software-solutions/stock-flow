import type { StatTile } from '@/types/stats';
import type { InventoryEntry } from '@/types/inventory';
import { entryValue, rowStatus, type StockStatus } from './stockStatus';

export type InventoryRow = InventoryEntry & { stockStatus?: StockStatus };

/** The Inventory page figures, over the rows shown (or all rows). */
export function getInventoryStatTiles({
  rows,
  costOf,
  money,
  showValue,
  isActive,
  toggle,
}: {
  rows: InventoryRow[];
  /** The product's cost price, by product id */
  costOf: (productId: string) => number;
  money: (n: number) => string;
  showValue: boolean;
  isActive: (id: string, values: string[]) => boolean;
  toggle: (id: string, values: string[]) => void;
}): StatTile[] {
  const tracked = rows.filter((r) => r.stockStatus !== 'untracked');
  const units = tracked.reduce((s, r) => s + Math.max(0, r.quantity), 0);
  const out = tracked.filter((r) => rowStatus(r) === 'out').length;
  const low = tracked.filter((r) => rowStatus(r) === 'low').length;
  const value = tracked.reduce(
    (acc, r) => {
      const v = entryValue(r, costOf(r.productId));
      return { cost: acc.cost + v.atCost, price: acc.price + v.atPrice };
    },
    { cost: 0, price: 0 }
  );

  // Branch with the most items out or low.
  const gaps = new Map<string, { out: number; low: number }>();
  tracked.forEach((r) => {
    const status = rowStatus(r);
    if (status === 'ok' || !r.branchName) return;
    const g = gaps.get(r.branchName) ?? { out: 0, low: 0 };
    g[status] += 1;
    gaps.set(r.branchName, g);
  });
  const worst = [...gaps.entries()].sort((a, b) => b[1].out + b[1].low - (a[1].out + a[1].low))[0];

  return [
    { id: 'rows', label: 'Stock items', value: tracked.length.toLocaleString(), sub: `${units.toLocaleString()} units` },
    {
      id: 'out',
      label: 'Out of stock',
      value: out.toLocaleString(),
      valueTone: out > 0 ? 'debt' : undefined,
      onClick: () => toggle('stockStatus', ['out']),
      active: isActive('stockStatus', ['out']),
    },
    {
      id: 'low',
      label: 'Running low',
      value: low.toLocaleString(),
      valueTone: low > 0 ? 'warn' : undefined,
      onClick: () => toggle('stockStatus', ['low']),
      active: isActive('stockStatus', ['low']),
    },
    {
      id: 'value',
      label: 'Stock value at cost',
      value: money(value.cost),
      sub: `${money(value.price)} at selling price`,
      hidden: !showValue,
    },
    {
      id: 'gaps',
      label: 'Most gaps',
      value: worst ? worst[0].replace(/ Branch$/i, '') : '—',
      sub: worst ? `${worst[1].out} out · ${worst[1].low} low` : 'None',
      hidden: new Set(tracked.map((r) => r.branchName)).size < 2,
    },
  ];
}
