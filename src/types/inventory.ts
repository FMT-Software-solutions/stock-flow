export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStockLevel: number; // For low stock alerts
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
  taxRate?: number;
  barcode?: string;
  location?: string; // e.g. Aisle 3, Shelf B
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // For nested categories
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
