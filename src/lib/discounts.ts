import type { Discount, DiscountStatus, DiscountValueType } from '@/types/discounts';
import type { Order } from '@/types/orders';

/**
 * The discount rows to show under a sale's subtotal. Sales from before
 * discounts were recorded per sale only have orders.discount.
 */
export function orderDiscountLines(order: Pick<Order, 'discount' | 'discounts'>) {
  if (order.discounts && order.discounts.length > 0) {
    return order.discounts.map((d) => ({
      key: d.id,
      label: d.code ? `${d.name} (${d.code})` : d.reason ? `${d.name}: ${d.reason}` : d.name,
      amount: Number(d.amount),
    }));
  }
  const amount = Number(order.discount ?? 0);
  return amount > 0 ? [{ key: 'discount', label: 'Discount', amount }] : [];
}

/** "10% off", "GHS 5.00 off", "GHS 20.00 each" */
export function describeDiscountValue(
  d: { valueType: DiscountValueType; value: number },
  formatCurrency: (n: number) => string
) {
  if (d.valueType === 'percentage') return `${d.value}% off`;
  if (d.valueType === 'fixed_price') return `${formatCurrency(d.value)} each`;
  return `${formatCurrency(d.value)} off`;
}

/** What a discount covers, in a few words. */
export function describeDiscountScope(d: Pick<Discount, 'target' | 'appliesTo' | 'targets' | 'valueType' | 'oncePerOrder'>) {
  if (d.target === 'order') return 'Whole sale';
  const per = d.valueType === 'fixed_amount' ? (d.oncePerOrder ? ', once per sale' : ', per item') : '';
  if (d.appliesTo === 'all') return `All products${per}`;
  const names = d.targets.map((t) => t.name).filter(Boolean);
  const shown = names.slice(0, 2).join(', ');
  return `${shown}${names.length > 2 ? ` +${names.length - 2}` : ''}${per}`;
}

export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  paused: 'Paused',
  used_up: 'Used up',
};

/** Item discounts that can reach a stock row (branch and product rules only). */
export function discountCoversStock(
  d: Discount,
  stock: { productId: string; variantId?: string | null; branchId?: string | null; categoryName?: string | null }
) {
  if (d.target !== 'items') return false;
  if (d.branchIds?.length && (!stock.branchId || !d.branchIds.includes(stock.branchId))) return false;
  if (d.appliesTo === 'all') return true;
  if (d.appliesTo === 'products') {
    return d.targets.some(
      (t) => t.productId === stock.productId && (!t.variantId || t.variantId === stock.variantId)
    );
  }
  return !!stock.categoryName && d.targets.some((t) => t.name === stock.categoryName);
}
