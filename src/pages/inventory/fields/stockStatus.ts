import type { InventoryEntry, Product } from '@/types/inventory';

export type StockStatus = 'out' | 'low' | 'ok' | 'untracked';

/** One stock row: out at 0 or below, low at or below its alert level. */
export function rowStatus(row: Pick<InventoryEntry, 'quantity' | 'minStockLevel'>): Exclude<StockStatus, 'untracked'> {
  if (row.quantity <= 0) return 'out';
  if (row.quantity <= (row.minStockLevel ?? 0)) return 'low';
  return 'ok';
}

export interface ProductStock {
  status: StockStatus;
  units: number;
  valueAtCost: number;
  valueAtPrice: number;
}

const rowPrice = (row: InventoryEntry) => row.priceOverride ?? row.variantPrice ?? row.productPrice ?? 0;

/**
 * Each product's stock in the given rows (the selected branches): out when it
 * has none left anywhere there, low when any of its rows is low or out.
 */
export function productStockMap(products: Product[], rows: InventoryEntry[]): Map<string, ProductStock> {
  const byProduct = new Map<string, InventoryEntry[]>();
  rows.forEach((r) => byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]));

  return new Map(
    products.map((p) => {
      const own = byProduct.get(p.id) ?? [];
      const units = own.reduce((s, r) => s + Math.max(0, r.quantity), 0);
      const valueAtCost = own.reduce((s, r) => s + Math.max(0, r.quantity) * (p.costPrice || 0), 0);
      const valueAtPrice = own.reduce((s, r) => s + Math.max(0, r.quantity) * rowPrice(r), 0);
      let status: StockStatus;
      if (!p.trackStock) status = 'untracked';
      else if (units <= 0) status = 'out';
      else if (own.some((r) => rowStatus(r) !== 'ok')) status = 'low';
      else status = 'ok';
      return [p.id, { status, units, valueAtCost, valueAtPrice }];
    })
  );
}

export const entryValue = (row: InventoryEntry, costPrice = 0) => ({
  atCost: Math.max(0, row.quantity) * costPrice,
  atPrice: Math.max(0, row.quantity) * rowPrice(row),
});
