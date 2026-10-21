/** How a discount reaches a sale: by itself, or when its code is entered. */
export type DiscountMethod = 'automatic' | 'code';
/** 'items' discounts eligible lines; 'order' discounts the sale subtotal. */
export type DiscountTarget = 'items' | 'order';
export type DiscountValueType = 'percentage' | 'fixed_amount' | 'fixed_price';
export type DiscountAppliesTo = 'all' | 'categories' | 'products';
export type DiscountStatus = 'active' | 'scheduled' | 'expired' | 'paused' | 'used_up';

export interface DiscountTargetRef {
  categoryId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  name?: string;
}

export interface Discount {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  method: DiscountMethod;
  /** Masked ('••••') for users who may not see codes */
  code?: string | null;
  target: DiscountTarget;
  valueType: DiscountValueType;
  value: number;
  oncePerOrder: boolean;
  appliesTo: DiscountAppliesTo;
  targets: DiscountTargetRef[];
  minSubtotal?: number | null;
  minQuantity?: number | null;
  branchIds?: string[] | null;
  customerIds?: string[] | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  combinable: boolean;
  isActive: boolean;
  status: DiscountStatus;
  uses: number;
  amountGiven: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What save_discount takes. */
export interface DiscountInput {
  id?: string;
  name: string;
  description?: string | null;
  method: DiscountMethod;
  code?: string | null;
  target: DiscountTarget;
  valueType: DiscountValueType;
  value: number;
  oncePerOrder: boolean;
  appliesTo: DiscountAppliesTo;
  targets: DiscountTargetRef[];
  minSubtotal?: number | null;
  minQuantity?: number | null;
  branchIds: string[];
  customerIds: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  combinable: boolean;
}

/** A cashier's one-off discount on a sale. */
export interface ManualDiscount {
  valueType: 'percentage' | 'fixed_amount';
  value: number;
  reason?: string;
}

/** What the sale screen asks for; the server decides what applies. */
export interface SaleDiscountRequest {
  codes: string[];
  /** Automatic discounts the cashier removed from this sale */
  skip: string[];
  manual?: ManualDiscount | null;
}

export interface AppliedSaleDiscount {
  discountId: string | null;
  kind: 'automatic' | 'code' | 'manual';
  name: string;
  code?: string | null;
  target: DiscountTarget;
  valueType: DiscountValueType;
  value: number;
  amount: number;
  reason?: string | null;
}

export interface SalePricing {
  subtotal: number;
  discountTotal: number;
  total: number;
  /** i is the 1-based position of the line in the items sent */
  lines: { i: number; gross: number; discount: number; itemDiscountId: string | null }[];
  discounts: AppliedSaleDiscount[];
  rejected: { code: string; reason: string }[];
  manualError: string | null;
}
