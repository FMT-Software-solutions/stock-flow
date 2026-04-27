import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Customer } from '@/types/customer';

const mapCustomerFromDB = (data: any): Customer => ({
  id: data.id,
  firstName: data.first_name,
  lastName: data.last_name,
  email: data.email,
  phone: data.phone,
  address: data.address,
  images: data.images,
  organizationId: data.organization_id,
  branchId: data.branch_id,
  branchName: data.branch?.name,
  isDeleted: data.is_deleted,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  // These might need to come from a view or subquery later
  totalOrders: data.total_orders || 0,
  totalSpent: data.total_spent || 0,
  lastOrderDate: data.last_order_date,
});

export function useCustomers(organizationId?: string) {
  return useQuery({
    queryKey: ['customers', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*, branch:branches(name)')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(mapCustomerFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*, branch:branches(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return mapCustomerFromDB(data);
    },
    enabled: !!id,
  });
}

export interface CustomerDebtSummary {
  total_owing: number;
  open_orders: number;
  last_owing_date: string | null;
  unpaid_orders: Array<{
    id: string;
    order_number: string;
    date: string;
    total_amount: number;
    paid_amount: number;
    owing_amount: number;
    branch_name: string | null;
    creator_name: string | null;
  }>;
}

export function useCustomerDebtSummary(params: {
  organizationId?: string;
  customerId?: string;
  branchIds?: string[];
  requestId?: number;
}) {
  const { organizationId, customerId, branchIds, requestId = 0 } = params;
  const normalizedBranchIds = branchIds && branchIds.length > 0 ? branchIds : null;

  return useQuery({
    queryKey: [
      'customers',
      'debt_summary',
      organizationId,
      customerId,
      normalizedBranchIds,
      requestId,
    ],
    queryFn: async () => {
      if (!organizationId || !customerId) return null;
      const { data, error } = await supabase.rpc('get_customer_debt_summary', {
        p_organization_id: organizationId,
        p_customer_id: customerId,
        p_branch_ids: normalizedBranchIds,
      });
      if (error) throw error;
      return data as CustomerDebtSummary;
    },
    enabled: !!organizationId && !!customerId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    placeholderData: (prev) =>
      prev ?? {
        total_owing: 0,
        open_orders: 0,
        last_owing_date: null,
        unpaid_orders: [],
      },
  });
}

export function useCustomerUnpaidOrders(params: {
  organizationId?: string;
  customerId?: string;
}) {
  const { organizationId, customerId } = params;

  return useQuery({
    queryKey: ['customers', 'unpaid_orders', organizationId, customerId],
    queryFn: async () => {
      if (!organizationId || !customerId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          date,
          total_amount,
          paid_amount,
          branch:branches(name),
          creator:profiles!orders_created_by_fkey1(first_name, last_name)
        `)
        .eq('organization_id', organizationId)
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .in('payment_status', ['unpaid', 'partial'])
        .not('status', 'in', '("cancelled","refunded")')
        .order('date', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && !!customerId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customer: Partial<Customer> & { organizationId: string }) => {
      const dbData = {
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        images: customer.images || [],
        organization_id: customer.organizationId,
        branch_id: customer.branchId === '' ? null : customer.branchId,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;
      return mapCustomerFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Customer> }) => {
      const dbData: any = {};
      if (updates.firstName !== undefined) dbData.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbData.last_name = updates.lastName;
      if (updates.email !== undefined) dbData.email = updates.email;
      if (updates.phone !== undefined) dbData.phone = updates.phone;
      if (updates.address !== undefined) dbData.address = updates.address;
      if (updates.images !== undefined) dbData.images = updates.images;
      if (updates.branchId !== undefined) {
        dbData.branch_id = updates.branchId === '' ? null : updates.branchId;
      }

      const { data, error } = await supabase
        .from('customers')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapCustomerFromDB(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
