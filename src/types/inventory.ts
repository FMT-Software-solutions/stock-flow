export interface Product {
  id: string;
  name: string;
  sku: string;
  branchId?: string;
  categoryId?: string;
  category?: { id: string; name: string };
  description?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number;
  unit: string;
  status: 'published' | 'draft' | 'inactive';
  imageUrl?: string;
  additionalImages?: string[];
  discount?: {
    enabled: boolean;
    type: 'percentage' | 'fixed';
    value: number;
  };
  supplierId?: string;
  supplier?: { id: string; name: string };
  taxRate?: number;
  barcode?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  hasVariations?: boolean;
  variants?: ProductVariant[];
  organizationId?: string;
  createdByName?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  image?: string;
  productCount: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  organizationId?: string;
}

export interface VariationType {
    id: string;
    name: string;
    isDefault: boolean;
    organizationId?: string;
}

export interface VariationOption {
    id: string;
    variationTypeId: string;
    value: string;
    organizationId?: string;
}

export interface ProductVariant {
    id: string;
    productId: string;
    sku: string;
    price: number;
    attributes: Record<string, string>;
    organizationId: string;
    quantity?: number;
    minStockLevel?: number;
    location?: string;
}

export interface ProductVariantInput {
    id?: string;
    sku: string;
    price: number;
    quantity: number;
    attributes: Record<string, string>;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string; // Or link to Customer entity
  customerId?: string;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial' | 'refunded';
  paymentMethod?: string;
  items: OrderItem[];
}

export interface InventoryEntry {
  id: string;
  productId: string;
  variantId?: string;
  branchId?: string;
  productName: string;
  sku: string;
  unit?: string;
  branchName?: string;
  quantity: number;
  minStockLevel: number;
  location?: string;
  organizationId: string;
  lastUpdated: string;
  createdByName?: string;
}

export interface InventoryEntryInput {
  productId: string;
  variantId?: string;
  branchId: string;
  quantity: number;
  minStockLevel?: number;
  location?: string;
  organizationId: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string; // e.g. "Purchase Order", "Sale", "Damage", "Theft"
  reference?: string; // Order ID or PO Number
  date: string;
  performedBy: string; // User ID
}
