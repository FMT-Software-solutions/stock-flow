import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TrendData {
  date: string;
  value: number;
}

export interface InventoryStats {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
}

export interface ProductStats {
  total_products: number;
  active_products: number;
  inactive_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  top_categories: { category: string; count: number }[];
  least_categories: { category: string; count: number }[];
}

export interface SalesStats {
  total_orders: number;
  total_revenue: number;
  owings?: number;
  refunds?: number;
  breakdown: Record<string, number>;
  trend: TrendData[];
}

export interface ExpenseStats {
  total_records: number;
  total_expenditure: number;
  top_category: { category: string; amount: number } | null;
  trend: TrendData[];
}

export interface CustomerStats {
  total_customers: number;
  new_this_period: number;
  trend: TrendData[];
}

export interface SupplierStats {
  total_suppliers: number;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
}

export interface BranchStats {
  total_branches: number;
  active_branches: number;
  inactive_branches: number;
}

interface DashboardStatsParams {
  organizationId: string | undefined;
  branchIds?: string[];
  salesDateRange?: { from: Date | undefined; to?: Date | undefined };
  expensesDateRange?: { from: Date | undefined; to?: Date | undefined };
  customersDateRange?: { from: Date | undefined; to?: Date | undefined };
}

export function useDashboardStats({
  organizationId,
  branchIds,
  salesDateRange,
  expensesDateRange,
  customersDateRange,
}: DashboardStatsParams) {
  const enabled = !!organizationId;

  // Helper to normalize branchIds: if empty or null, pass null to RPC to signify "all"
  const normalizedBranchIds = branchIds && branchIds.length > 0 ? branchIds : null;

  const inventory = useQuery({
    queryKey: ['dashboard', 'inventory', organizationId, normalizedBranchIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
      });
      if (error) throw error;
      return data as InventoryStats;
    },
    enabled,
  });

  const products = useQuery({
    queryKey: ['dashboard', 'products', organizationId, normalizedBranchIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
      });
      if (error) throw error;
      return data as ProductStats;
    },
    enabled,
  });

  const sales = useQuery({
    queryKey: ['dashboard', 'sales', organizationId, normalizedBranchIds, salesDateRange?.from?.toISOString(), salesDateRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sales_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: salesDateRange?.from?.toISOString() || null,
        p_end_date: salesDateRange?.to?.toISOString() || null,
      });
      if (error) throw error;
      return data as SalesStats;
    },
    enabled,
  });

  const expenses = useQuery({
    queryKey: ['dashboard', 'expenses', organizationId, normalizedBranchIds, expensesDateRange?.from?.toISOString(), expensesDateRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_expense_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: expensesDateRange?.from?.toISOString() || null,
        p_end_date: expensesDateRange?.to?.toISOString() || null,
      });
      if (error) throw error;
      return data as ExpenseStats;
    },
    enabled,
  });

  const customers = useQuery({
    queryKey: ['dashboard', 'customers', organizationId, normalizedBranchIds, customersDateRange?.from?.toISOString(), customersDateRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: customersDateRange?.from?.toISOString() || null,
        p_end_date: customersDateRange?.to?.toISOString() || null,
      });
      if (error) throw error;
      return data as CustomerStats;
    },
    enabled,
  });

  const suppliers = useQuery({
    queryKey: ['dashboard', 'suppliers', organizationId, normalizedBranchIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_supplier_stats', {
        p_organization_id: organizationId,
        p_branch_ids: normalizedBranchIds,
      });
      if (error) throw error;
      return data as SupplierStats;
    },
    enabled,
  });

  const users = useQuery({
    queryKey: ['dashboard', 'users', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return data as UserStats;
    },
    enabled,
  });

  const branches = useQuery({
    queryKey: ['dashboard', 'branches', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_branch_stats', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return data as BranchStats;
    },
    enabled,
  });

  return {
    inventory,
    products,
    sales,
    expenses,
    customers,
    suppliers,
    users,
    branches,
  };
}
