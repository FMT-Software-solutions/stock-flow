import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useInventoryEntries, useProducts } from '@/hooks/useInventoryQueries';
import { lineProductName, untrackedLineKey } from '@/lib/saleLines';

/** One thing a cashier can put on a sale line. */
export interface SellableOption {
  /** Sale line key: inventory id, or untrackedLineKey() for untracked products */
  key: string;
  /** Variant and/or stock label, '' for a plain product */
  label: string;
  /** Snapshot name stored on the order item */
  lineName: string;
  price: number;
  /** Stock in the branch; null when the product doesn't track stock */
  stock: number | null;
  sku?: string;
  inventoryNumber?: string;
  productId: string;
  variantId: string | null;
  inventoryId: string | null;
}

export interface SellableProduct {
  productId: string;
  name: string;
  imageUrl?: string;
  trackStock: boolean;
  options: SellableOption[];
}

interface VariantRecord {
  id: string;
  product_id: string;
  attributes: Record<string, string> | null;
  custom_label: string | null;
  price: number | string | null;
  sku: string | null;
}

/** Active variants of every product in the organization. */
export function useOrganizationVariants(organizationId?: string) {
  return useQuery({
    queryKey: ['organization_variants', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, attributes, custom_label, price, sku')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false);
      if (error) throw error;
      return (data ?? []) as VariantRecord[];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

const variantName = (v: VariantRecord) => v.custom_label || Object.values(v.attributes ?? {}).join(' / ');

/**
 * Active products as they can be sold in one branch, grouped by product.
 * Tracked products offer their stock rows in that branch; untracked products
 * offer themselves or their variants, always available.
 */
export function useSellableProducts(organizationId?: string, branchId?: string) {
  const { data: products = [], isLoading: productsLoading } = useProducts(organizationId);
  const { data: entries = [], isLoading: entriesLoading } = useInventoryEntries(
    organizationId,
    branchId ? [branchId] : undefined
  );
  const { data: variants = [], isLoading: variantsLoading } = useOrganizationVariants(organizationId);

  const sellable = useMemo<SellableProduct[]>(() => {
    if (!branchId) return [];
    const variantById = new Map(variants.map((v) => [v.id, v]));

    return products
      .filter((p) => p.status === 'published')
      .map((p): SellableProduct => {
        let options: SellableOption[];

        if (p.trackStock) {
          options = entries
            .filter((e) => e.productId === p.id && e.branchId === branchId)
            .map((e) => {
              const variant = e.variantId ? variantById.get(e.variantId) : undefined;
              return {
                key: e.id,
                // A custom option's rows carry its name; don't repeat it.
                label: variant?.custom_label
                  ? variant.custom_label
                  : [variant ? variantName(variant) : null, e.customLabel || null].filter(Boolean).join(' · '),
                lineName: e.productName,
                price: e.priceOverride ?? e.variantPrice ?? e.productPrice ?? p.sellingPrice ?? 0,
                stock: e.quantity,
                sku: e.sku,
                inventoryNumber: e.inventoryNumber,
                productId: p.id,
                variantId: e.variantId ?? null,
                inventoryId: e.id,
              };
            });
        } else {
          const productVariants = variants.filter((v) => v.product_id === p.id);
          options =
            productVariants.length > 0
              ? productVariants.map((v) => ({
                  key: untrackedLineKey(p.id, v.id),
                  label: variantName(v),
                  lineName: lineProductName(p.name, v.attributes, v.custom_label),
                  price: v.price === null ? p.sellingPrice : Number(v.price),
                  stock: null,
                  sku: v.sku ?? p.sku,
                  productId: p.id,
                  variantId: v.id,
                  inventoryId: null,
                }))
              : [
                  {
                    key: untrackedLineKey(p.id),
                    label: '',
                    lineName: p.name,
                    price: p.sellingPrice,
                    stock: null,
                    sku: p.sku,
                    productId: p.id,
                    variantId: null,
                    inventoryId: null,
                  },
                ];
        }

        // A nameless row only needs a name when it sits beside others: stock
        // from before variants were added, or a duplicate row (older data).
        if (options.length > 1) {
          options.forEach((o) => {
            if (!o.label) o.label = p.hasVariations ? 'No variant' : `#${o.inventoryNumber ?? ''}`;
          });
        }

        options.sort((a, b) => a.label.localeCompare(b.label));
        return { productId: p.id, name: p.name, imageUrl: p.imageUrl, trackStock: p.trackStock, options };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, entries, variants, branchId]);

  const optionByKey = useMemo(
    () => new Map(sellable.flatMap((p) => p.options.map((o) => [o.key, o] as const))),
    [sellable]
  );

  return {
    products: sellable,
    optionByKey,
    isLoading: productsLoading || entriesLoading || variantsLoading,
  };
}
