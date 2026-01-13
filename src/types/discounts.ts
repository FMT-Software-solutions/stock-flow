export interface Discount {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  type: 'percentage' | 'fixed';
  value: number;
  startAt?: string;
  expiresAt?: string;
  customerIds?: string[] | null;
  branchIds?: string[] | null;
  targetMode?: 'all' | 'category' | 'product' | 'inventory';
  usageMode?: 'automatic' | 'manual';
  usageLimit?: number | null;
  timesUsed?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountTarget {
  inventoryIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
  targetBranchIds?: string[];
}

export interface ManageDiscountParams {
  action: 'apply' | 'remove';
  discount?: Partial<Discount>;
  targets?: DiscountTarget;
}
