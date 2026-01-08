import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Order, CreateOrderInput, UpdateOrderInput } from '@/types/orders';

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
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq('organization_id', organizationId)
        .order('date', { ascending: false });

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data as Order[];
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
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq('customer_id', customerId)
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
          branch:branches(id, name, abbreviation),
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { items, ...orderData } = input;

      // 1. Create Order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Failed to create order');

      // 2. Create Order Items
      if (items.length > 0) {
        const itemsWithIds = items.map(item => ({
          ...item,
          order_id: order.id,
          organization_id: order.organization_id,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsWithIds);

        if (itemsError) {
          // In a real app we might want to rollback the order here
          console.error('Failed to create items', itemsError);
          throw itemsError;
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Invalidate inventory queries to reflect stock changes immediately (handled by DB trigger)
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOrderInput) => {
      const { items, id, ...orderData } = input;

      // 1. Update Order Details
      const { error: orderError } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', id);

      if (orderError) throw orderError;

      // 2. Update Items (Replace strategy for simplicity)
      if (items) {
        // Delete existing - Trigger should restore stock
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', id);

        if (deleteError) throw deleteError;

        // Insert new - Trigger should deduct stock
        if (items.length > 0) {
          // Query order to get org_id
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('organization_id')
            .eq('id', id)
            .single();

          if (!existingOrder) throw new Error('Order not found');

          const itemsWithIds = items.map(item => ({
            ...item,
            order_id: id,
            organization_id: existingOrder.organization_id,
          }));

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsWithIds);

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
    },
  });
}
