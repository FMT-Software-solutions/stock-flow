import type { StockRow } from '@/hooks/useProductStock';

// Stored values stay published/draft/inactive; users see Active/Draft/Archived.
const STATUS_LABEL: Record<string, string> = {
  published: 'Active',
  draft: 'Draft',
  inactive: 'Archived',
};

export const productStatusLabel = (status: string) =>
  STATUS_LABEL[status?.toLowerCase()] ?? status;

/** "ZZ Test Soap" → "ZTS-4821": initials (or first 3 letters) + 4 random digits. */
export function generateSku(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase().trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const prefix = (words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : clean.slice(0, 3))
    .padEnd(3, 'X')
    .slice(0, 3);
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Attribute order is not significant; compare variants by sorted pairs. */
export function attributesKey(attributes: Record<string, string>): string {
  return JSON.stringify(Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b)));
}

export function variantLabel(attributes: Record<string, string>): string {
  return Object.values(attributes).join(' / ');
}

/** A variant's name: its custom option name, or its option values. */
export function variantName(variant: { attributes: Record<string, string> | null; customLabel?: string | null }): string {
  return variant.customLabel || variantLabel(variant.attributes ?? {});
}

export const isCustomOption = (variant: { customLabel?: string | null }) => !!variant.customLabel;

/** Readable message for a save that hit the one-name-per-product rule. */
export function customOptionError(error: unknown): string {
  const message = (error as { message?: string })?.message ?? '';
  if (message.includes('product_variants_custom_label_key')) return 'An option with this name already exists';
  return message || 'Could not save';
}

export interface OptionGroup {
  /** variation_types id, or the attribute name for legacy types not in the list */
  typeId: string;
  name: string;
  values: string[];
}

/** Every combination of the selected values, in the groups' order. */
export function combineOptions(groups: OptionGroup[]): Record<string, string>[] {
  const active = groups.filter((g) => g.values.length > 0);
  if (active.length === 0) return [];
  return active.reduce<Record<string, string>[]>(
    (combos, group) => combos.flatMap((combo) => group.values.map((value) => ({ ...combo, [group.name]: value }))),
    [{}]
  );
}

/** Option groups implied by existing variants, keeping first-seen order. */
export function groupsFromVariants(
  variants: { attributes: Record<string, string> }[],
  typeIdByName: Map<string, string>
): OptionGroup[] {
  const groups = new Map<string, OptionGroup>();
  variants.forEach((v) =>
    Object.entries(v.attributes ?? {}).forEach(([name, value]) => {
      const group = groups.get(name) ?? { typeId: typeIdByName.get(name) ?? name, name, values: [] };
      if (!group.values.includes(value)) group.values.push(value);
      groups.set(name, group);
    })
  );
  return [...groups.values()];
}

export const cellKey = (variantId: string | null, branchId: string) => `${variantId ?? ''}:${branchId}`;

/**
 * Splits active stock rows into the grid's cells and "other stock".
 *
 * A cell is the unlabelled row for (variant, branch). When a branch has more
 * than one unlabelled row (possible with older data), the one with the most
 * stock is the cell, matching find_or_create_stock_row() in the database;
 * the rest are listed under other stock with their inventory number.
 * Rows of a custom option carry its name as their label and are cells too.
 */
export function splitStockRows(
  rows: StockRow[],
  variants: { id: string; customLabel?: string | null }[],
  hasVariants: boolean
) {
  const cells = new Map<string, StockRow>();
  const others: StockRow[] = [];
  const variantIds = new Set(variants.map((v) => v.id));
  const customIds = new Set(variants.filter(isCustomOption).map((v) => v.id));

  [...rows]
    .filter((r) => !r.isDeleted && r.branchId)
    .sort((a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id))
    .forEach((row) => {
      const isCustomRow = !!row.variantId && customIds.has(row.variantId);
      const belongsInGrid =
        (!row.label || isCustomRow) &&
        (hasVariants ? !!row.variantId && variantIds.has(row.variantId) : !row.variantId);
      const key = cellKey(row.variantId, row.branchId!);
      if (belongsInGrid && !cells.has(key)) {
        cells.set(key, row);
      } else {
        others.push(row);
      }
    });

  return { cells, others };
}

export function otherStockLabel(row: StockRow, variantName: string | undefined, hasVariants: boolean): string {
  // Stock without a variant on a product that now has variants (e.g. stock
  // added before options were set up) is named as such.
  // A second row of a custom option in one branch: its name and number.
  if (row.label && row.label === variantName) {
    return [row.label, row.inventoryNumber ? `#${row.inventoryNumber}` : null].filter(Boolean).join(' · ');
  }
  if (row.label) return variantName ? `${variantName} · ${row.label}` : row.label;
  const owner = variantName ?? (hasVariants && !row.variantId ? 'No variant' : undefined);
  return [owner, row.inventoryNumber ? `#${row.inventoryNumber}` : null].filter(Boolean).join(' · ') || 'Stock';
}

export function stockTone(quantity: number, min: number): 'out' | 'low' | 'ok' {
  if (quantity <= 0) return 'out';
  if (quantity <= min) return 'low';
  return 'ok';
}
