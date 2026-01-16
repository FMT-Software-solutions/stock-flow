import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Discount } from '@/types/discounts';

export interface DiscountInventoryRow {
  id: string;
  inventory_number?: string | null;
  product_id: string;
  variant_id?: string | null;
  branch_id?: string | null;
  quantity: number;
  min_stock_level: number;
  location?: string | null;
  organization_id: string;
  last_updated: string;
  custom_label?: string | null;
  price_override?: number | null;
  type?: 'variant' | 'custom' | null;
  image_url?: string | null;
  product_name: string;
  product_sku?: string | null;
  product_unit?: string | null;
  product_price?: number | null;
  product_image?: string | null;
  product_status?: string | null;
  variant_sku?: string | null;
  variant_price?: number | null;
  variant_attributes?: Record<string, string> | null;
  branch_name?: string | null;
}

export interface DiscountDetailsResult {
  discount: Discount | null;
  inventories: DiscountInventoryRow[];
}

export function useDiscountDetails(organizationId?: string, discountId?: string) {
  return useQuery({
    queryKey: ['discount_details', organizationId, discountId],
    queryFn: async () => {
      if (!organizationId || !discountId) return { discount: null, inventories: [] } as DiscountDetailsResult;
      const { data, error } = await supabase.rpc('get_discount_details', {
        p_organization_id: organizationId,
        p_discount_id: discountId,
      });
      if (error) throw error;
      const d = (data?.discount ?? null) as any;
      const discount: Discount | null = d
        ? {
          id: d.id,
          organizationId: d.organization_id,
          name: d.name,
          code: d.code ?? undefined,
          createdBy: d.created_by ?? undefined,
          updatedBy: d.updated_by ?? undefined,
          description: d.description ?? undefined,
          type: d.type,
          value: Number(d.value),
          startAt: d.start_at ?? undefined,
          expiresAt: d.expires_at ?? undefined,
          customerIds: d.customer_ids ?? null,
          branchIds: d.branch_ids ?? null,
          targetMode: d.target_mode ?? undefined,
          usageMode: d.usage_mode as 'automatic' | 'manual' | undefined,
          usageLimit: d.usage_limit ?? null,
          timesUsed: typeof d.times_used === 'number' ? d.times_used : 0,
          isActive: d.is_active,
          isExpired: !!d.expires_at && new Date(d.expires_at).getTime() < Date.now(),
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }
        : null;
      const inventories = Array.isArray(data?.inventories) ? (data.inventories as DiscountInventoryRow[]) : [];
      return { discount, inventories } as DiscountDetailsResult;
    },
    enabled: !!organizationId && !!discountId,
  });
}
