import * as z from 'zod';

export const orderSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional(),
  status: z.enum([
    'pending',
    'processing',
    'completed',
    'cancelled',
    'refunded',
  ]),
  paymentStatus: z.enum(['paid', 'unpaid', 'partial', 'refunded']),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z
    .enum(['cash', 'card', 'mobile_money', 'bank_transfer', 'other'])
    .optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        inventoryId: z.string().min(1, 'Product is required'),
        quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
        unitPrice: z.coerce.number().min(0, 'Price must be non-negative'),
        originalPrice: z.coerce.number().optional(),
        productName: z.string().optional(), // For optimistic UI or passing data
      })
    )
    .min(1, 'At least one item is required'),
  // Discounts the cashier asked for; the server decides what applies.
  discountCodes: z.array(z.string()).optional(),
  skippedDiscountIds: z.array(z.string()).optional(),
  manualDiscount: z
    .object({
      valueType: z.enum(['percentage', 'fixed_amount']),
      value: z.coerce.number().min(0),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export const PERSIST_KEYS = {
  BRANCH: 'order_form_branch',
  STATUS: 'order_form_status',
  PAYMENT_STATUS: 'order_form_payment_status',
  PAYMENT_METHOD: 'order_form_payment_method',
};
