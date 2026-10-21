import * as z from 'zod';

const optionalNumber = z
  .string()
  .optional()
  .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Must be 0 or more');

const optionalCount = z
  .string()
  .optional()
  .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1), 'Must be a whole number, 1 or more');

export const discountFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    method: z.enum(['automatic', 'code']),
    code: z.string().optional(),
    target: z.enum(['items', 'order']),
    valueType: z.enum(['percentage', 'fixed_amount', 'fixed_price']),
    value: z.coerce.number().min(0, 'Must be 0 or more'),
    oncePerOrder: z.boolean(),
    appliesTo: z.enum(['all', 'categories', 'products']),
    // Category ids, or "productId" / "productId:variantId"
    targetIds: z.array(z.string()),
    minSubtotal: optionalNumber,
    minQuantity: optionalNumber,
    branchIds: z.array(z.string()),
    customerIds: z.array(z.string()),
    usageLimit: optionalCount,
    usageLimitPerCustomer: optionalCount,
    combinable: z.boolean(),
    startDate: z.string().optional(),
    startTime: z.string().optional(),
    endDate: z.string().optional(),
    endTime: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === 'code' && !v.code?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Code is required' });
    }
    if (v.value <= 0) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a value' });
    }
    if (v.valueType === 'percentage' && v.value > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'At most 100%' });
    }
    if (v.target === 'order' && v.valueType === 'fixed_price') {
      ctx.addIssue({ code: 'custom', path: ['valueType'], message: 'Fixed price is for items' });
    }
    if (v.target === 'items' && v.appliesTo !== 'all' && v.targetIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['targetIds'], message: 'Pick at least one' });
    }
    if (v.startDate && v.endDate) {
      const start = new Date(`${v.startDate}T${v.startTime || '00:00'}:00`);
      const end = new Date(`${v.endDate}T${v.endTime || '23:59'}:00`);
      if (end <= start) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Must be after the start' });
      }
    }
  });

export type DiscountFormValues = z.infer<typeof discountFormSchema>;
