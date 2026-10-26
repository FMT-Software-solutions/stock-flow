import type { StatTile } from '@/types/stats';
import type { Product } from '@/types/inventory';
import type { ProductStock, StockStatus } from './stockStatus';

export type ProductRow = Product & { stockStatus?: StockStatus };

/** The Products page figures; stock follows the selected branches. */
export function getProductStatTiles({
  products,
  stock,
  money,
  showValue,
  isActive,
  toggle,
}: {
  products: ProductRow[];
  stock: Map<string, ProductStock>;
  money: (n: number) => string;
  showValue: boolean;
  isActive: (id: string, values: string[]) => boolean;
  toggle: (id: string, values: string[]) => void;
}): StatTile[] {
  const count = (s: StockStatus) => products.filter((p) => p.stockStatus === s).length;
  const tracked = products.filter((p) => p.trackStock).length;
  const byStatus = (status: string) => products.filter((p) => p.status === status).length;
  const active = byStatus('published');
  const draft = byStatus('draft');
  const archived = byStatus('inactive');

  const value = products.reduce(
    (acc, p) => {
      const s = stock.get(p.id);
      return { cost: acc.cost + (s?.valueAtCost ?? 0), price: acc.price + (s?.valueAtPrice ?? 0) };
    },
    { cost: 0, price: 0 }
  );
  const profit = value.price - value.cost;
  const out = count('out');
  const low = count('low');
  const untracked = count('untracked');

  const statusTile = (id: StockStatus, label: string, n: number, tone: StatTile['valueTone']): StatTile => ({
    id,
    label,
    value: n.toLocaleString(),
    valueTone: n > 0 ? tone : undefined,
    sub: tracked ? `of ${tracked} tracked` : undefined,
    onClick: () => toggle('stockStatus', [id]),
    active: isActive('stockStatus', [id]),
  });

  return [
    {
      id: 'products',
      label: 'Products',
      value: products.length.toLocaleString(),
      sub: [`${active} active`, draft ? `${draft} draft` : null, archived ? `${archived} archived` : null].filter(Boolean).join(' · '),
    },
    statusTile('out', 'Out of stock', out, 'debt'),
    statusTile('low', 'Running low', low, 'warn'),
    {
      id: 'untracked',
      label: 'Stock not tracked',
      value: untracked.toLocaleString(),
      onClick: () => toggle('stockStatus', ['untracked']),
      active: isActive('stockStatus', ['untracked']),
      hidden: untracked === 0,
    },
    {
      id: 'value',
      label: 'Stock value at cost',
      value: money(value.cost),
      sub: `${money(value.price)} at selling price`,
      hidden: !showValue,
    },
    {
      id: 'profit',
      label: 'Potential profit',
      value: money(profit),
      valueTone: profit > 0 ? 'cash' : profit < 0 ? 'debt' : undefined,
      sub: value.price > 0 ? `${Math.round((profit / value.price) * 100)}% margin` : undefined,
      hidden: !showValue || value.cost === 0,
    },
  ];
}
