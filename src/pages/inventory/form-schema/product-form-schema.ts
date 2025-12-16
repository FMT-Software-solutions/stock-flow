import * as z from 'zod';


export const productSchema = z.object({
  name: z.string().min(2, {
    message: 'Product name must be at least 2 characters.',
  }),
  sku: z.string().min(1, {
    message: 'SKU is required.',
  }),
  categoryId: z.string().min(1, {
    message: 'Category is required.',
  }),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  minStockLevel: z.coerce.number().min(0),
  unit: z.string().default('pcs'),
  status: z.enum(['published', 'draft', 'inactive']).default('published'),
  imageUrl: z.string().optional(),
  additionalImages: z.array(z.string()).optional(),
  discount: z
    .object({
      enabled: z.boolean().default(false),
      type: z.enum(['percentage', 'fixed']).default('percentage'),
      value: z.coerce.number().min(0).default(0),
    })
    .optional(),
});