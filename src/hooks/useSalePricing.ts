import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { useDebounceValue } from '@/hooks/useDebounce';
import type { AppliedSaleDiscount, SaleDiscountRequest, SalePricing } from '@/types/discounts';

/** One sale line as the pricing RPC (and order_items) sees it. */
export interface PricedLineInput {
  inventory_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
}

export function toDiscountPayload(request: SaleDiscountRequest, expectedTotal?: number) {
  return {
    codes: request.codes,
    skip: request.skip,
    manual: request.manual
      ? { value_type: request.manual.valueType, value: request.manual.value, reason: request.manual.reason ?? null }
      : null,
    ...(expectedTotal !== undefined ? { expected_total: expectedTotal } : {}),
  };
}

/** compute_sale_discounts result as returned by preview_sale */
interface PricingRow {
  subtotal: number;
  discount_total: number;
  total: number;
  lines: { i: number; gross: number; discount: number; item_discount_id: string | null }[];
  discounts: {
    discount_id: string | null;
    kind: AppliedSaleDiscount['kind'];
    name: string;
    code: string | null;
    target: AppliedSaleDiscount['target'];
    value_type: AppliedSaleDiscount['valueType'];
    value: number;
    amount: number;
    reason: string | null;
  }[];
  rejected: { code: string; reason: string }[];
  manual_error: string | null;
}

function mapPricing(data: PricingRow | null): SalePricing {
  return {
    subtotal: Number(data?.subtotal ?? 0),
    discountTotal: Number(data?.discount_total ?? 0),
    total: Number(data?.total ?? 0),
    lines: (data?.lines ?? []).map((l) => ({
      i: Number(l.i),
      gross: Number(l.gross),
      discount: Number(l.discount),
      itemDiscountId: l.item_discount_id ?? null,
    })),
    discounts: (data?.discounts ?? []).map((d) => ({
      discountId: d.discount_id ?? null,
      kind: d.kind,
      name: d.name,
      code: d.code,
      target: d.target,
      valueType: d.value_type,
      value: Number(d.value),
      amount: Number(d.amount),
      reason: d.reason,
    })),
    rejected: data?.rejected ?? [],
    manualError: data?.manual_error ?? null,
  };
}

/**
 * Discounts for the sale being rung up, priced by the server with the same
 * rules create_order / update_order apply (preview_sale RPC).
 */
export function useSalePricing(params: {
  organizationId?: string;
  branchId?: string;
  customerId?: string;
  lines: PricedLineInput[];
  request: SaleDiscountRequest;
  /** Set when editing a sale: its discounts stay valid */
  orderId?: string;
}) {
  const key = JSON.stringify([
    params.organizationId,
    params.branchId,
    params.customerId || null,
    params.lines,
    params.request,
    params.orderId ?? null,
  ]);
  const debouncedKey = useDebounceValue(key, 250);

  const query = useQuery({
    queryKey: ['sale_pricing', debouncedKey],
    queryFn: async () => {
      const [organizationId, branchId, customerId, lines, request, orderId] = JSON.parse(debouncedKey);
      const { data, error } = await supabase.rpc('preview_sale', {
        p_order: { organization_id: organizationId, branch_id: branchId, customer_id: customerId },
        p_items: lines,
        p_discounts: toDiscountPayload(request),
        p_order_id: orderId,
      });
      if (error) throw error;
      return mapPricing(data as PricingRow | null);
    },
    enabled: !!params.organizationId && params.lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });

  return {
    pricing: params.lines.length > 0 ? query.data : undefined,
    // True while the shown numbers may not match the current cart yet
    isPending: params.lines.length > 0 && (key !== debouncedKey || query.isFetching),
    error: query.error,
    refetch: query.refetch,
  };
}
