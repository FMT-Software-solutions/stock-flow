import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

export interface LedgerPayment {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  recorded_by: string;
}

export interface LedgerOrder {
  id: string;
  order_number: string;
  date: string;
  created_at: string;
  updated_at: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  customer: {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
  period_collected: number;
  payments: LedgerPayment[];
}

export interface SalesLedgerReport {
  orders: LedgerOrder[];
}

export function useSalesLedgerReport(
  organizationId: string | undefined,
  branchIds?: string[],
  startDate?: string | null,
  endDate?: string | null
) {
  return useQuery({
    queryKey: [
      'reports',
      'sales_ledger',
      organizationId,
      branchIds,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID is required');

      const { data, error } = await supabase.rpc('get_sales_report_ledger', {
        p_organization_id: organizationId,
        p_branch_ids: branchIds || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) {
        throw error;
      }

      return data as SalesLedgerReport;
    },
    enabled: !!organizationId,
  });
}
