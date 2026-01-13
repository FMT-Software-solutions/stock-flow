import * as z from 'zod';

export const discountFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().min(0, "Value must be positive"),
  startAt: z.string().optional(),
  startTime: z.string().optional(),
  expiresAt: z.string().optional(),
  endTime: z.string().optional(),
  customerIds: z.array(z.string()).default([]),
  branchIds: z.array(z.string()).default([]),
  usageMode: z.enum(['automatic','manual']).default('manual'),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(),

  // Targeting
  targetType: z.enum(['all', 'category', 'product', 'inventory']).default('all'),
  targetIds: z.array(z.string()).default([]),
  targetBranchIds: z.array(z.string()).default([]),
});

export type DiscountFormValues = z.infer<typeof discountFormSchema>;
