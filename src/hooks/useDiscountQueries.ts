import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { ManageDiscountParams, Discount } from '@/types/discounts';

export interface ValidInventoryDiscountsRow {
  inventoryId: string;
  productId: string;
  variantId?: string | null;
  branchId?: string | null;
  discounts: Discount[];
}

export function useManageInventoryDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, action, discount, targets }: ManageDiscountParams & { organizationId: string }) => {
      const snakeDiscount = discount
        ? {
          id: discount.id,
          name: discount.name,
          code: discount.code,
          created_by: (discount as any).createdBy,
          updated_by: (discount as any).updatedBy,
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['valid_inventory_discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discount_details', variables.organizationId] });
      if (variables.discount?.id) {
        queryClient.invalidateQueries({
          queryKey: ['discount_details', variables.organizationId, variables.discount.id],
        });
      }
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
        createdBy: d.created_by ?? undefined,
        updatedBy: d.updated_by ?? undefined,
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
        remainingUsage: d.usage_limit !== null && d.usage_limit !== undefined
          ? Math.max(0, d.usage_limit - (typeof d.times_used === 'number' ? d.times_used : 0))
          : null,
        isActive: d.is_active,
        isExpired: !!d.expires_at && new Date(d.expires_at).getTime() < Date.now(),
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
      queryClient.invalidateQueries({ queryKey: ['valid_inventory_discounts'] });
    }
  });
}

export function useValidInventoryDiscounts(organizationId?: string, branchIds?: string[]) {
  return useQuery({
    queryKey: ['valid_inventory_discounts', organizationId, branchIds?.join(',') || 'all'],
    queryFn: async () => {
      if (!organizationId) return [] as ValidInventoryDiscountsRow[];
      const { data, error } = await supabase.rpc('get_valid_inventory_discounts', {
        p_organization_id: organizationId,
        p_branch_ids: Array.isArray(branchIds) && branchIds.length > 0 ? branchIds : null,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((r: any) => {
        const discounts: Discount[] = Array.isArray(r.discounts)
          ? r.discounts.map((d: any) => ({
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
            remainingUsage: d.usage_limit !== null && d.usage_limit !== undefined
              ? Math.max(0, d.usage_limit - (typeof d.times_used === 'number' ? d.times_used : 0))
              : null,
            isActive: d.is_active,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }))
          : [];
        return {
          inventoryId: r.inventory_id as string,
          productId: r.product_id as string,
          variantId: r.variant_id ?? null,
          branchId: r.branch_id ?? null,
          discounts,
        } as ValidInventoryDiscountsRow;
      }) as ValidInventoryDiscountsRow[];
    },
    enabled: !!organizationId,
  });
}

export interface UpdateDiscountFieldsInput {
  id: string;
  startAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  timesUsed?: number;
  usageMode?: 'automatic' | 'manual';
}

export function useUpdateDiscountFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateDiscountFieldsInput) => {
      const update: any = {};
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (payload.startAt !== undefined) update.start_at = payload.startAt;
      if (payload.expiresAt !== undefined) update.expires_at = payload.expiresAt;
      if (payload.isActive !== undefined) update.is_active = payload.isActive;
      if (payload.timesUsed !== undefined) update.times_used = payload.timesUsed;
      if (payload.usageMode !== undefined) update.usage_mode = payload.usageMode;
      if (uid) update.updated_by = uid;
      const { error } = await supabase
        .from('discounts')
        .update(update)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      queryClient.invalidateQueries({ queryKey: ['valid_inventory_discounts'] });
    },
  });
}

export function useIncrementDiscountUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (discountId: string) => {
      const { data, error } = await supabase.rpc('increment_discount_usage', { p_discount_id: discountId });
      if (error) throw error;
      if (data === false) throw new Error('Discount usage limit exceeded or discount invalid');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valid_inventory_discounts'] });
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
    }
  });
}

export function useValidateDiscountServerSide() {
  return useMutation({
    mutationFn: async (discountId: string) => {
      const { data, error } = await supabase
        .from('discounts')
        .select('usage_limit, times_used, expires_at, is_active')
        .eq('id', discountId)
        .single();

      if (error) throw error;

      if (data.is_active === false) throw new Error('Discount is not active');
      if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error('Discount has expired');
      if (data.usage_limit !== null && data.times_used >= data.usage_limit) throw new Error('Discount usage limit exceeded');
      return data;
    }
  })
}
