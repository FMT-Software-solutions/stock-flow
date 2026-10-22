/** A row of the low / out-of-stock lists in the Products and Inventory reports. */
export type StockListItem = {
  id: string;
  name: string;
  /** Inventory report rows: which variant / stock label / branch */
  variant?: string | null;
  label?: string | null;
  branch_name?: string | null;
  sku: string | null;
  category_name: string | null;
  quantity: number;
  min_stock_level: number;
};

/** "Black · Used" */
export const stockItemVariant = (p: StockListItem) => [p.variant, p.label].filter(Boolean).join(' · ');

/** Chart axis labels: 80000 → "80K", 1250000 → "1.3M" (tooltips keep full amounts). */
export const compactAxisNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
