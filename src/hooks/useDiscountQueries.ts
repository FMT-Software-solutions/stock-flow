import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { ManageDiscountParams, Discount } from '@/types/discounts';

export function useManageInventoryDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, action, discount, targets }: ManageDiscountParams & { organizationId: string }) => {
      const snakeDiscount = discount
        ? {
          id: discount.id,
          name: discount.name,
          code: discount.code,
          description: discount.description,
          type: discount.type,
          value: discount.value,
          start_at: discount.startAt,
          expires_at: discount.expiresAt,
          customer_ids: Array.isArray(discount.customerIds) ? discount.customerIds : [],
          branch_ids: Array.isArray(discount.branchIds) ? discount.branchIds : [],
          usage_mode: discount.usageMode,
          usage_limit: discount.usageLimit,
        }
        : null;

      const snakeTargets = {
        apply_to_all: (targets as any)?.apply_to_all || undefined,
        inventory_ids: Array.isArray(targets?.inventoryIds) ? targets?.inventoryIds : [],
        product_ids: Array.isArray(targets?.productIds) ? targets?.productIds : [],
        category_ids: Array.isArray(targets?.categoryIds) ? targets?.categoryIds : [],
        target_branch_ids: Array.isArray(targets?.targetBranchIds) ? targets?.targetBranchIds : [],
      };

      const { data, error } = await supabase.rpc('manage_inventory_discount', {
        p_organization_id: organizationId,
        p_action: action,
        p_discount: snakeDiscount,
        p_targets: snakeTargets,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
  });
}

export function useDiscounts(organizationId?: string) {
  return useQuery({
    queryKey: ['discounts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((d: any) => ({
        id: d.id,
        organizationId: d.organization_id,
        name: d.name,
        code: d.code,
        description: d.description,
        type: d.type,
        value: Number(d.value),
        startAt: d.start_at,
        expiresAt: d.expires_at,
        customerIds: d.customer_ids,
        branchIds: d.branch_ids,
        targetMode: d.target_mode as 'all' | 'category' | 'product' | 'inventory' | undefined,
        usageMode: d.usage_mode as 'automatic' | 'manual' | undefined,
        usageLimit: d.usage_limit ?? null,
        timesUsed: typeof d.times_used === 'number' ? d.times_used : 0,
        isActive: d.is_active,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      })) as Discount[];
    },
    enabled: !!organizationId,
  });
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
    }
  });
}
