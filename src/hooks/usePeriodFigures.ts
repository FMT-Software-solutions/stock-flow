import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { PeriodFigures } from '@/hooks/useDashboardSummary';

/**
 * Sales and expense figures of one period (dashboard_period_figures), for
 * comparing a page's date-filtered stats with the period before.
 */
export function usePeriodFigures(
  organizationId: string | undefined,
  branchIds: string[],
  range: { start: Date; end: Date } | null
) {
  const branches = branchIds.length > 0 ? branchIds : null;
  const start = range?.start.toISOString();
  const end = range?.end.toISOString();
  return useQuery({
    queryKey: ['period_figures', organizationId, branches, start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_period_figures', {
        p_organization_id: organizationId,
        p_branch_ids: branches,
        p_start: start,
        p_end: end,
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      if (error) throw error;
      const f = data as PeriodFigures;
      return {
        net: Number(f.net),
        orders: Number(f.orders),
        discounts: Number(f.discounts),
        owed: Number(f.owed),
        collected: Number(f.collected),
        expenses: Number(f.expenses),
      } satisfies PeriodFigures;
    },
    enabled: !!organizationId && !!range,
    staleTime: 5 * 60 * 1000,
  });
}
