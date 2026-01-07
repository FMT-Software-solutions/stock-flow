export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other';

export interface OrderItem {
  id: string;
  organization_id: string;
  order_id: string;
  inventory_id?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  order_number: string;
  date: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod | null;
  total_amount: number;
  paid_amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;

  // Relations
  items?: OrderItem[];
  customer?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    name?: string; // Fallback or computed
  } | null;
  branch?: {
    id: string;
    name: string;
    abbreviation?: string;
  } | null;
  creator?: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface CreateOrderInput {
  organization_id: string;
  branch_id?: string;
  customer_id?: string | null; // Allow null
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod;
  total_amount: number;
  paid_amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  notes?: string;
  items: Omit<OrderItem, 'id' | 'created_at' | 'organization_id' | 'order_id'>[];
}

export interface UpdateOrderInput extends Partial<Omit<CreateOrderInput, 'items'>> {
  id: string;
  items?: Omit<OrderItem, 'id' | 'created_at' | 'organization_id' | 'order_id'>[]; // Replaces all items if provided
}
