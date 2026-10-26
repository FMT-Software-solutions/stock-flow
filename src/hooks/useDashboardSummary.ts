import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { DashboardPeriod } from '@/pages/dashboard/period';

// --- Types (get_dashboard_summary) ---

export interface PeriodFigures {
  net: number;
  orders: number;
  discounts: number;
  owed: number;
  collected: number;
  expenses: number;
}

export interface SeriesPoint {
  slot: string;
  net: number;
  orders: number;
}

export interface DashboardSummary {
  first_sale: string | null;
  current: PeriodFigures;
  previous: PeriodFigures | null;
  series: SeriesPoint[];
  previous_series: SeriesPoint[];
  top_products: { product_id: string | null; name: string; quantity: number; net: number }[];
  payments: { method: string; amount: number; payments: number }[];
  branches: { id: string; name: string; net: number; orders: number }[];
  recent: {
    id: string;
    order_number: string;
    date: string;
    total: number;
    paid: number;
    payment_status: string;
    status: string;
    branch: string | null;
    customer: string | null;
  }[];
  attention: {
    stock: { branch_id: string; branch: string; out: number; low: number }[];
    owed: { amount: number; sales: number; customers: number; top: { name: string; amount: number }[] };
    pending: number;
    discounts_ending: { id: string; name: string; ends_at: string }[];
  };
  counts: { customers: number; products: number; suppliers: number; branches: number; users: number };
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const toNumbers = (f: PeriodFigures | null): PeriodFigures | null =>
  f && {
    net: Number(f.net),
    orders: Number(f.orders),
    discounts: Number(f.discounts),
    owed: Number(f.owed),
    collected: Number(f.collected),
    expenses: Number(f.expenses),
  };

function periodArgs(period: DashboardPeriod) {
  return {
    start: period.start?.toISOString() ?? null,
    end: period.end.toISOString(),
    prevStart: period.prevStart?.toISOString() ?? null,
    prevEnd: period.prevEnd?.toISOString() ?? null,
  };
}

/** Everything the dashboard shows, in one call. */
export function useDashboardSummary(organizationId: string | undefined, branchIds: string[], period: DashboardPeriod) {
  const branches = branchIds.length > 0 ? branchIds : null;
  const args = periodArgs(period);
  return useQuery({
    queryKey: ['dashboard_summary', organizationId, branches, args, period.bucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_summary', {
        p_organization_id: organizationId,
        p_branch_ids: branches,
        p_start: args.start,
        p_end: args.end,
        p_prev_start: args.prevStart,
        p_prev_end: args.prevEnd,
        p_bucket: period.bucket,
        p_tz: timeZone(),
      });
      if (error) throw error;
      const d = data as DashboardSummary;
      return {
        ...d,
        current: toNumbers(d.current)!,
        previous: toNumbers(d.previous),
        series: d.series.map((p) => ({ ...p, net: Number(p.net), orders: Number(p.orders) })),
        previous_series: d.previous_series.map((p) => ({ ...p, net: Number(p.net), orders: Number(p.orders) })),
        top_products: d.top_products.map((p) => ({ ...p, net: Number(p.net), quantity: Number(p.quantity) })),
        payments: d.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
        branches: d.branches.map((b) => ({ ...b, net: Number(b.net), orders: Number(b.orders) })),
        recent: d.recent.map((r) => ({ ...r, total: Number(r.total), paid: Number(r.paid ?? 0) })),
      } satisfies DashboardSummary;
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
  });
}

export interface AiSummary {
  lines: string[];
  createdAt: string;
  cached: boolean;
}

interface AiSummaryInput {
  organizationId?: string;
  branchIds: string[];
  branchLabel: string;
  period: DashboardPeriod;
  currency: string;
}

async function fetchAiSummary(input: AiSummaryInput, refresh: boolean): Promise<AiSummary> {
  const { data, error } = await supabase.functions.invoke('dashboard-summary', {
    body: {
      organizationId: input.organizationId,
      branchIds: input.branchIds.length > 0 ? input.branchIds : null,
      ...periodArgs(input.period),
      bucket: input.period.bucket,
      timeZone: timeZone(),
      periodLabel: input.period.label,
      previousLabel: input.period.prevLabel,
      branchLabel: input.branchLabel,
      currency: input.currency,
      refresh,
    },
  });
  if (error) {
    // The function's own message (limit reached, not configured…) is in the body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error || error.message);
  }
  return data as AiSummary;
}

/**
 * The AI summary of the dashboard. Only fetched while `enabled` (the card is
 * open); the function reuses a recent summary of the same view.
 */
export function useAiSummary(input: AiSummaryInput, enabled: boolean) {
  const queryClient = useQueryClient();
  const key = [
    'dashboard_ai_summary',
    input.organizationId,
    input.branchIds,
    periodArgs(input.period),
  ];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchAiSummary(input, false),
    enabled: enabled && !!input.organizationId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const refresh = useMutation({
    mutationFn: () => fetchAiSummary(input, true),
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  return { query, refresh };
}
