import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Order, CreateOrderInput, UpdateOrderInput } from '@/types/orders';
import type { SaleDiscountRequest } from '@/types/discounts';
import { toDiscountPayload } from '@/hooks/useSalePricing';

export function useOrders(organizationId?: string, branchIds?: string[]) {
  return useQuery({
    queryKey: ['orders', organizationId, branchIds],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          discounts:order_discounts(*),
          payments:order_payments(*, creator:profiles!order_payments_created_by_fkey1(first_name, last_name)),
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone),
          creator:profiles!orders_created_by_fkey1(first_name, last_name)
        `)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as Order[];
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev ?? [],
  });
}

export function useInventoryOrders(inventoryId?: string) {
  return useQuery({
    queryKey: ['orders', 'inventory', inventoryId],
    queryFn: async () => {
      if (!inventoryId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items!inner(*),
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq('items.inventory_id', inventoryId)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!inventoryId,
  });
}

export function useCustomerOrders(
  customerId?: string,
  organizationId?: string,
  branchIds?: string[]
) {
  return useQuery({
    queryKey: ['orders', 'customer', customerId, organizationId, branchIds],
    queryFn: async () => {
      if (!customerId) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          discounts:order_discounts(*),
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!customerId,
  });
}

export function useOrder(orderId?: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          discounts:order_discounts(*),
          payments:order_payments(*, creator:profiles!order_payments_created_by_fkey1(first_name, last_name)),
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone),
          creator:profiles!orders_created_by_fkey1(first_name, last_name)
        `)
        .eq('id', orderId)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });
}

function invalidateAfterSale(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order'] });
  queryClient.invalidateQueries({ queryKey: ['discounts'] });
  queryClient.invalidateQueries({ queryKey: ['sale_pricing'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['reports'] });
  // Stock changes are made by DB triggers
  queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ discounts, ...input }: CreateOrderInput & { discounts: SaleDiscountRequest; expectedTotal: number }) => {
      const { items, expectedTotal, ...orderData } = input;

      // One transaction: stock is locked and checked, discounts are validated
      // and priced, the order and its items are inserted together. Any failure
      // (not enough stock, a code that just ran out) leaves nothing behind.
      const { data: order, error } = await supabase.rpc('create_order', {
        p_order: orderData,
        p_items: items,
        p_discounts: toDiscountPayload(discounts, expectedTotal),
      });

      if (error) throw error;
      if (!order) throw new Error('Failed to create order');

      return order as Order;
    },
    onSuccess: () => invalidateAfterSale(queryClient),
  });
}

/** Edits a whole sale (items, discounts, details) in one transaction. */
export function useEditOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      items,
      discounts,
      expectedTotal,
      ...orderData
    }: UpdateOrderInput & { items: CreateOrderInput['items']; discounts: SaleDiscountRequest; expectedTotal: number }) => {
      const { data, error } = await supabase.rpc('update_order', {
        p_order_id: id,
        p_order: orderData,
        p_items: items,
        p_discounts: toDiscountPayload(discounts, expectedTotal),
      });
      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => invalidateAfterSale(queryClient),
  });
}

/** Changes order fields only (status, payment status...). Items: useEditOrder. */
export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<UpdateOrderInput, 'items'>) => {
      const { id, ...orderData } = input;
      const patchedOrderData = { ...orderData };

      if (patchedOrderData.payment_status === 'refunded') {
        patchedOrderData.status = 'refunded';
        patchedOrderData.paid_amount = 0;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(patchedOrderData)
        .eq('id', id);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useAddOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      amount: number;
      paymentMethod?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('add_order_payment', {
        p_order_id: params.orderId,
        p_amount: params.amount,
        p_payment_method: params.paymentMethod || null,
        p_notes: params.notes || null,
        p_user_id: user.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ is_deleted: true })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
