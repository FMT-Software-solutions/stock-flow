import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/utils/supabase';

/**
 * Runs a period report RPC taking (organization, branches, start, end).
 * Whole days are covered: the range runs from the start of its first day to
 * the end of its last, whichever way the dates were picked.
 */
export function useReportRpc<T>(
  rpc: string,
  orgId: string | undefined,
  branchIds: string[],
  dateRange: DateRange | undefined
) {
  const start = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
  const end = dateRange?.to
    ? endOfDay(dateRange.to).toISOString()
    : dateRange?.from
      ? endOfDay(dateRange.from).toISOString()
      : null;
  const branches = branchIds.length > 0 ? branchIds : null;

  return useQuery({
    queryKey: ['reports', rpc, orgId, branches, start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpc, {
        p_organization_id: orgId,
        p_branch_ids: branches,
        p_start_date: start,
        p_end_date: end,
      });
      if (error) throw error;
      return data as T;
    },
    enabled: !!orgId,
  });
}
