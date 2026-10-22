import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Discount, DiscountInput } from '@/types/discounts';

/** What list_discounts shows instead of a code the user may not see. */
export const MASKED_CODE = '••••';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

/** A list_discounts row (snake_case discounts columns plus computed fields). */
interface DiscountRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  method: Discount['method'];
  code: string | null;
  target: Discount['target'];
  value_type: Discount['valueType'];
  value: number | string;
  once_per_order: boolean;
  applies_to: Discount['appliesTo'];
  targets: { category_id: string | null; product_id: string | null; variant_id: string | null; name: string }[] | null;
  min_subtotal: number | string | null;
  min_quantity: number | string | null;
  branch_ids: string[] | null;
  customer_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  combinable: boolean;
  is_active: boolean;
  status: Discount['status'];
  uses: number | string | null;
  amount_given: number | string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapDiscount(d: DiscountRow): Discount {
  return {
    id: d.id,
    organizationId: d.organization_id,
    name: d.name,
    description: d.description,
    method: d.method,
    code: d.code,
    target: d.target,
    valueType: d.value_type,
    value: Number(d.value),
    oncePerOrder: !!d.once_per_order,
    appliesTo: d.applies_to,
    targets: (d.targets ?? []).map((t) => ({
      categoryId: t.category_id,
      productId: t.product_id,
      variantId: t.variant_id,
      name: t.name,
    })),
    minSubtotal: num(d.min_subtotal),
    minQuantity: num(d.min_quantity),
    branchIds: d.branch_ids,
    customerIds: d.customer_ids,
    startsAt: d.starts_at,
    endsAt: d.ends_at,
    usageLimit: num(d.usage_limit),
    usageLimitPerCustomer: num(d.usage_limit_per_customer),
    combinable: !!d.combinable,
    isActive: !!d.is_active,
    status: d.status,
    uses: Number(d.uses ?? 0),
    amountGiven: Number(d.amount_given ?? 0),
    createdBy: d.created_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

/** Every discount with status, targets and usage (list_discounts RPC). */
export function useDiscounts(organizationId?: string, enabled = true) {
  return useQuery({
    queryKey: ['discounts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as Discount[];
      const { data, error } = await supabase.rpc('list_discounts', { p_org: organizationId });
      if (error) throw error;
      return ((data as DiscountRow[] | null) ?? []).map(mapDiscount);
    },
    enabled: !!organizationId && enabled,
  });
}

function invalidateDiscounts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['discounts'] });
  queryClient.invalidateQueries({ queryKey: ['sale_pricing'] });
}

export function useSaveDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ organizationId, discount }: { organizationId: string; discount: DiscountInput }) => {
      const keepCode = discount.method === 'code' && discount.code === MASKED_CODE;
      const { data, error } = await supabase.rpc('save_discount', {
        p_org: organizationId,
        p_discount: {
          id: discount.id ?? null,
          name: discount.name,
          description: discount.description ?? null,
          method: discount.method,
          code: discount.method === 'code' && !keepCode ? discount.code?.trim() || null : null,
          keep_code: keepCode,
          target: discount.target,
          value_type: discount.valueType,
          value: discount.value,
          once_per_order: discount.oncePerOrder,
          applies_to: discount.target === 'order' ? 'all' : discount.appliesTo,
          targets: discount.targets.map((t) => ({
            category_id: t.categoryId ?? null,
            product_id: t.productId ?? null,
            variant_id: t.variantId ?? null,
          })),
          min_subtotal: discount.minSubtotal ?? null,
          min_quantity: discount.minQuantity ?? null,
          branch_ids: discount.branchIds,
          customer_ids: discount.customerIds,
          starts_at: discount.startsAt ?? null,
          ends_at: discount.endsAt ?? null,
          usage_limit: discount.usageLimit ?? null,
          usage_limit_per_customer: discount.usageLimitPerCustomer ?? null,
          combinable: discount.combinable,
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateDiscounts(queryClient),
  });
}

export function useSetDiscountActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('set_discount_active', { p_id: id, p_active: active });
      if (error) throw error;
    },
    onSuccess: () => invalidateDiscounts(queryClient),
  });
}

/** Deleting archives: past sales keep pointing at the discount. */
export function useDeleteDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('archive_discount', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => invalidateDiscounts(queryClient),
  });
}
