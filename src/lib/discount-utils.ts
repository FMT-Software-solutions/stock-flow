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
}

export interface AppliedDiscount {
  discount: Discount;
  amount: number;
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
  const limit = d.usageLimit ?? null;
  if (limit === null || typeof limit !== 'number') return true;
  const used = currentUsageCounts?.[d.id] ?? d.timesUsed ?? 0;
  return used < limit;
}

function eligibleItemsForDiscount(d: Discount, items: DiscountOrderItem[]) {
  if (d.targetMode === 'all') return items;
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

function computeAmount(d: Discount, items: DiscountOrderItem[]) {
  const eligible = eligibleItemsForDiscount(d, items);
  const subtotal = eligible.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  if (d.type === 'percentage') return Math.max(0, (subtotal * d.value) / 100);
  return Math.max(0, d.value);
}

export function validateAndApplyDiscounts(input: ApplyDiscountInput): {
  applicable: Discount[];
  applied?: AppliedDiscount;
} {
  const { discounts, items, branchId, customerId, code, currentUsageCounts } = input;
  const nowEligible = discounts.filter(
    (d) =>
      isWithinPeriod(d) &&
      isEligible(d, branchId, customerId) &&
      respectsUsage(d, currentUsageCounts)
  );

  const manual = code
    ? nowEligible.find((d) => d.code && d.code === code && (d.usageMode ?? 'manual') === 'manual')
    : undefined;

  if (manual) {
    const amount = computeAmount(manual, items);
    return { applicable: nowEligible, applied: { discount: manual, amount } };
  }

  const automaticEligible = nowEligible.filter((d) => (d.usageMode ?? 'manual') === 'automatic');
  let best: AppliedDiscount | undefined = undefined;
  for (const d of automaticEligible) {
    const amount = computeAmount(d, items);
    if (!best || amount > best.amount) {
      best = { discount: d, amount };
    }
  }
  return { applicable: nowEligible, applied: best };
}

