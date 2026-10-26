import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

// --- Types ---

/** One inventory row of a product, as the product screens need it. */
export interface StockRow {
  id: string;
  inventoryNumber?: string;
  variantId: string | null;
  branchId: string | null;
  label: string | null;
  quantity: number;
  minStockLevel: number;
  priceOverride: number | null;
  isDeleted: boolean;
}

export type StockReason =
  | 'opening'
  | 'received'
  | 'count'
  | 'damaged'
  | 'correction'
  | 'return'
  | 'sale'
  | 'sale_reversal'
  | 'edit'
  | 'other';

export interface StockMovement {
  id: string;
  inventoryId: string;
  variantId: string | null;
  branchId: string | null;
  branchName?: string;
  change: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: StockReason;
  note: string | null;
  orderId: string | null;
  orderNumber?: string;
  createdByName?: string;
  createdAt: string;
}

export interface SaveProductInput {
  product: Record<string, unknown>;
  /** Omit to leave variants unchanged; [] means the product has none. */
  variants?: {
    id?: string;
    key?: string;
    sku: string;
    price: number | null;
    attributes: Record<string, string>;
  }[];
  /** Custom options; omit to leave them unchanged, ids not listed are archived. */
  custom?: {
    id?: string;
    key?: string;
    label: string;
    price?: number | null;
  }[];
  stock?: {
    branch_id: string;
    variant_id?: string;
    variant_key?: string;
    quantity?: number;
    min_stock_level?: number;
  }[];
}

export interface StockAdjustment {
  inventory_id?: string;
  product_id?: string;
  variant_id?: string | null;
  branch_id?: string;
  label?: string | null;
  /** Adds (or with a negative value removes) stock. */
  change?: number;
  /** Sets stock to this value (a count). */
  quantity?: number;
}

// --- Mappers ---

interface StockRowRecord {
  id: string;
  inventory_number: string | null;
  variant_id: string | null;
  branch_id: string | null;
  custom_label: string | null;
  quantity: number | string | null;
  min_stock_level: number | string | null;
  price_override: number | string | null;
  is_deleted: boolean | null;
}

interface MovementRecord {
  id: string;
  inventory_id: string;
  variant_id: string | null;
  branch_id: string | null;
  change: number | string;
  quantity_before: number | string;
  quantity_after: number | string;
  reason: StockReason;
  note: string | null;
  order_id: string | null;
  created_at: string;
  branch: { name: string } | null;
  order: { order_number: string } | null;
  creator: { first_name: string | null; last_name: string | null } | null;
}

const mapStockRow = (row: StockRowRecord): StockRow => ({
  id: row.id,
  inventoryNumber: row.inventory_number ?? undefined,
  variantId: row.variant_id,
  branchId: row.branch_id,
  label: row.custom_label || null,
  quantity: Number(row.quantity ?? 0),
  minStockLevel: Number(row.min_stock_level ?? 0),
  priceOverride: row.price_override === null ? null : Number(row.price_override),
  isDeleted: !!row.is_deleted,
});

const invalidateStock = (queryClient: ReturnType<typeof useQueryClient>) => {
  [
    'products',
    'product',
    'product_stock',
    'product_inventory',
    'inventory_entries',
    'stock_movements',
    'organization_variants',
    'custom_option_stock',
  ].forEach(
    (key) => queryClient.invalidateQueries({ queryKey: [key] })
  );
};

// --- Hooks ---

/**
 * Stock rows of a product. Archived rows are included (flagged isDeleted) so
 * history entries for removed variants can still be labelled.
 */
export function useProductStock(productId?: string) {
  return useQuery({
    queryKey: ['product_stock', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('inventory')
        .select('id, inventory_number, variant_id, branch_id, custom_label, quantity, min_stock_level, price_override, is_deleted')
        .eq('product_id', productId);

      if (error) throw error;
      return ((data ?? []) as StockRowRecord[]).map(mapStockRow);
    },
    enabled: !!productId,
  });
}

export function useStockMovements(productId?: string) {
  return useQuery({
    queryKey: ['stock_movements', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id, inventory_id, variant_id, branch_id, change, quantity_before, quantity_after,
          reason, note, order_id, created_at,
          branch:branches ( name ),
          order:orders ( order_number ),
          creator:profiles!stock_movements_created_by_fkey ( first_name, last_name )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return ((data ?? []) as unknown as MovementRecord[]).map((m): StockMovement => ({
        id: m.id,
        inventoryId: m.inventory_id,
        variantId: m.variant_id,
        branchId: m.branch_id,
        branchName: m.branch?.name,
        change: Number(m.change),
        quantityBefore: Number(m.quantity_before),
        quantityAfter: Number(m.quantity_after),
        reason: m.reason,
        note: m.note,
        orderId: m.order_id,
        orderNumber: m.order?.order_number,
        createdByName: m.creator
          ? `${m.creator.first_name || ''} ${m.creator.last_name || ''}`.trim()
          : undefined,
        createdAt: m.created_at,
      }));
    },
    enabled: !!productId,
  });
}

/** Product, variants and stock in one transaction (save_product RPC). */
export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product, variants, custom, stock }: SaveProductInput) => {
      const { data, error } = await supabase.rpc('save_product', {
        p_product: product,
        p_variants: variants ?? null,
        p_stock: stock && stock.length > 0 ? stock : null,
        p_custom: custom ?? null,
      });
      if (error) throw error;
      return data as { product_id: string; variants: Record<string, string> };
    },
    onSuccess: () => invalidateStock(queryClient),
  });
}

/**
 * Replaces a product's custom options with this list: listed ones are added
 * or renamed, saved ones left out are archived with their stock rows.
 */
export function useSaveCustomOptions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, options }: { productId: string; options: { id?: string; label: string }[] }) => {
      const { error } = await supabase.rpc('save_product', {
        p_product: { id: productId },
        p_custom: options.map((o) => ({ ...(o.id ? { id: o.id } : {}), label: o.label.trim() })),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStock(queryClient),
  });
}

/** Reasoned stock changes, all-or-nothing (adjust_stock RPC). */
export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      reason,
      note,
    }: {
      items: StockAdjustment[];
      reason: Exclude<StockReason, 'opening' | 'sale' | 'sale_reversal' | 'edit'>;
      note?: string;
    }) => {
      const { data, error } = await supabase.rpc('adjust_stock', {
        p_items: items,
        p_reason: reason,
        p_note: note || null,
      });
      if (error) throw error;
      return data as { inventory_id: string; quantity: number }[];
    },
    onSuccess: () => invalidateStock(queryClient),
  });
}
