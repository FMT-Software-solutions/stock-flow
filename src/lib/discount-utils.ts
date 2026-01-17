import type { Discount } from '@/types/discounts';

export interface DiscountOrderItem {
  inventoryId: string;
  productId: string;
  categoryId?: string;
  branchId?: string;
  unitPrice: number;
  quantity: number;
}

export interface ApplyDiscountInput {
  discounts: Discount[];
  items: DiscountOrderItem[];
  branchId?: string;
  customerId?: string;
  code?: string;
  currentUsageCounts?: Record<string, number>;
  eligibleInventoryByDiscount?: Record<string, Set<string>>;
  selectedAutoId?: string;
}

export interface AppliedDiscount {
  discount: Discount;
  amount: number;
}

function normalizeCode(code: string) {
  return code.trim().toLowerCase();
}

function isWithinPeriod(d: Discount) {
  const now = new Date();
  const startOk = !d.startAt || new Date(d.startAt) <= now;
  const endOk = !d.expiresAt || new Date(d.expiresAt) >= now;
  return startOk && endOk && d.isActive !== false;
}

function isEligible(d: Discount, branchId?: string, customerId?: string) {
  const branchOk =
    !Array.isArray(d.branchIds) || d.branchIds.length === 0 || (branchId ? d.branchIds.includes(branchId) : true);
  const customerOk =
    !Array.isArray(d.customerIds) || d.customerIds.length === 0 || (customerId ? d.customerIds.includes(customerId) : true);
  return branchOk && customerOk;
}

function respectsUsage(d: Discount, currentUsageCounts?: Record<string, number>) {
  if (d.usageLimit === null || d.usageLimit === undefined) return true;

  // If we have currentUsageCounts override, use legacy check
  if (currentUsageCounts && typeof currentUsageCounts[d.id] === 'number') {
    return currentUsageCounts[d.id] < d.usageLimit;
  }

  // Otherwise prefer remainingUsage if available
  if (typeof d.remainingUsage === 'number') {
    return d.remainingUsage > 0;
  }

  // Fallback
  const used = d.timesUsed ?? 0;
  return used < d.usageLimit;
}

function eligibleItemsForDiscount(
  d: Discount,
  items: DiscountOrderItem[],
  eligibleInventoryByDiscount?: Record<string, Set<string>>
) {
  // Storewide discounts (targetMode 'all' or undefined) apply to all items,
  // overriding any inventory-specific restrictions from the map.
  if (!d.targetMode || d.targetMode === 'all') return items;

  // If we have a map of eligibility (from server RPC), use it as the source of truth.
  if (eligibleInventoryByDiscount) {
    if (eligibleInventoryByDiscount[d.id] && eligibleInventoryByDiscount[d.id].size > 0) {
      const allowed = eligibleInventoryByDiscount[d.id];
      return items.filter((it) => it.inventoryId && allowed.has(it.inventoryId));
    }
    // If map is provided but discount is not in it (and it's not storewide),
    // then it applies to NO items in the current context.
    return [];
  }

  if (d.targetMode === 'product') {
    return items.filter((it) => it.productId);
  }
  if (d.targetMode === 'category') {
    return items.filter((it) => it.categoryId);
  }
  if (d.targetMode === 'inventory') {
    return items.filter((it) => it.inventoryId);
  }
  return items;
}

export function computeDiscountAmount(
  d: Discount,
  items: DiscountOrderItem[],
  eligibleInventoryByDiscount?: Record<string, Set<string>>
) {
  const eligible = eligibleItemsForDiscount(d, items, eligibleInventoryByDiscount);
  const subtotal = eligible.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  if (d.type === 'percentage') return Math.max(0, (subtotal * d.value) / 100);
  // Fixed amount should not exceed the value of eligible items
  return Math.min(subtotal, Math.max(0, d.value));
}

export function distributeDiscount(
  d: Discount,
  items: DiscountOrderItem[],
  eligibleInventoryByDiscount?: Record<string, Set<string>>
): Record<string, number> {
  const eligible = eligibleItemsForDiscount(d, items, eligibleInventoryByDiscount);
  const totalDiscount = computeDiscountAmount(d, items, eligibleInventoryByDiscount);

  if (totalDiscount === 0 || eligible.length === 0) return {};

  const distribution: Record<string, number> = {};

  // Calculate eligible subtotal for proration
  const eligibleSubtotal = eligible.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  if (eligibleSubtotal <= 0) return {};

  let distributedSoFar = 0;

  eligible.forEach((item, index) => {
    // If it's the last item, assign the remainder to ensure totals match exactly
    if (index === eligible.length - 1) {
      distribution[item.inventoryId] = Math.max(0, totalDiscount - distributedSoFar);
    } else {
      const itemTotal = item.unitPrice * item.quantity;
      // Prorate based on contribution to eligible subtotal
      // This works for both Fixed (capped) and Percentage
      // For percentage: itemTotal * (value/100) is equivalent to itemTotal * (totalDiscount / subtotal)
      const share = (itemTotal / eligibleSubtotal) * totalDiscount;
      distribution[item.inventoryId] = share;
      distributedSoFar += share;
    }
  });

  return distribution;
}

export function getDiscountValidationError(
  code: string,
  allDiscounts: Discount[],
  items: DiscountOrderItem[],
  branchId?: string,
  customerId?: string,
  eligibleInventoryByDiscount?: Record<string, Set<string>>
): string | null {
  const normalizedCode = normalizeCode(code);
  const match = allDiscounts.find((d) => d.code && normalizeCode(d.code) === normalizedCode);

  if (!match) return 'Invalid Code';

  if (!isWithinPeriod(match)) return 'Code Expired or Inactive';
  if (!respectsUsage(match)) return 'Usage Limit Exceeded';
  if (!isEligible(match, branchId, customerId)) return 'Invalid Code';

  const eligible = eligibleItemsForDiscount(match, items, eligibleInventoryByDiscount);
  if (eligible.length === 0) return 'Invalid Code';

  const amount = computeDiscountAmount(match, items, eligibleInventoryByDiscount);
  if (amount <= 0) return 'Invalid Code';

  return null;
}

export function validateAndApplyDiscounts(input: ApplyDiscountInput): {
  applicable: Discount[];
  applied?: AppliedDiscount;
} {
  const { discounts, items, branchId, customerId, code, currentUsageCounts, eligibleInventoryByDiscount, selectedAutoId } = input;
  const nowEligible = discounts.filter(
    (d) =>
      isWithinPeriod(d) &&
      isEligible(d, branchId, customerId) &&
      respectsUsage(d, currentUsageCounts)
  );

  // If a code is provided, we strictly prioritize it.
  // We do not fallback to automatic discounts if a code is entered but invalid.
  if (code) {
    const normalizedCode = normalizeCode(code);
    const match = nowEligible.find((d) => d.code && normalizeCode(d.code) === normalizedCode);

    if (match) {
      const amount = computeDiscountAmount(match, items, eligibleInventoryByDiscount);
      return amount > 0
        ? { applicable: nowEligible, applied: { discount: match, amount } }
        : { applicable: nowEligible, applied: undefined };
    }

    // Code was provided but no matching eligible discount found.
    // Return no applied discount to avoid confusion (don't auto-apply something else).
    return { applicable: nowEligible, applied: undefined };
  }

  const automaticEligible = nowEligible.filter((d) => (d.usageMode ?? 'manual') === 'automatic');
  if (selectedAutoId) {
    const chosen = automaticEligible.find((d) => d.id === selectedAutoId);
    if (chosen) {
      const amount = computeDiscountAmount(chosen, items, eligibleInventoryByDiscount);
      return { applicable: nowEligible, applied: { discount: chosen, amount } };
    }
  }
  let best: AppliedDiscount | undefined = undefined;
  for (const d of automaticEligible) {
    const amount = computeDiscountAmount(d, items, eligibleInventoryByDiscount);
    if (!best || amount > best.amount) {
      best = { discount: d, amount };
    }
  }
  return { applicable: nowEligible, applied: best };
}
