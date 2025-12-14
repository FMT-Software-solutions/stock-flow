import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { X } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(2, {
    message: 'Product name must be at least 2 characters.',
  }),
  sku: z.string().min(1, {
    message: 'SKU is required.',
  }),
  category: z.string().min(1, {
    message: 'Category is required.',
  }),
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

export function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      description: '',
      sellingPrice: 0,
      costPrice: 0,
      quantity: 0,
      minStockLevel: 5,
      unit: 'pcs',
      status: 'published',
      imageUrl: '',
      additionalImages: [],
      discount: {
        enabled: false,
        type: 'percentage',
        value: 0,
      },
    },
  });

  function onSubmit(values: z.infer<typeof productSchema>) {
    // In a real app, we would send this to the backend
    console.log(values);
    navigate('/inventory');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/inventory')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Product' : 'New Product'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Make changes to your product details'
              : 'Add a new product to your inventory'}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>
                Basic information about the product
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="name">Product Name</FieldLabel>
                    <Input id="name" placeholder="iPhone 14 Pro" {...field} />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="sku"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel htmlFor="sku">SKU</FieldLabel>
                      <Input id="sku" placeholder="IP14PRO-128" {...field} />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel>Category</FieldLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electronics">
                            Electronics
                          </SelectItem>
                          <SelectItem value="clothing">Clothing</SelectItem>
                          <SelectItem value="home">Home & Garden</SelectItem>
                          <SelectItem value="toys">Toys</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
              </div>
              <Controller
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      id="description"
                      placeholder="Product description..."
                      className="resize-none"
                      {...field}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
              <CardDescription>Upload your product images.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <div className="space-y-2">
                    <FieldLabel>Main Image</FieldLabel>
                    {field.value ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                        <img
                          src={field.value}
                          alt="Product"
                          className="h-full w-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute right-2 top-2 h-6 w-6"
                          onClick={() => field.onChange('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <ModernFileUpload
                        onFileSelect={(file) =>
                          field.onChange(URL.createObjectURL(file))
                        }
                      />
                    )}
                  </div>
                )}
              />

              <Controller
                control={form.control}
                name="additionalImages"
                render={({ field }) => (
                  <div className="space-y-2">
                    <FieldLabel>Additional Images</FieldLabel>
                    <div className="grid grid-cols-3 gap-4">
                      {field.value?.map((url, index) => (
                        <div
                          key={index}
                          className="relative aspect-square w-full overflow-hidden rounded-lg border"
                        >
                          <img
                            src={url}
                            alt={`Additional ${index}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 h-5 w-5"
                            onClick={() => {
                              const newImages = [...(field.value || [])];
                              newImages.splice(index, 1);
                              field.onChange(newImages);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <ModernFileUpload
                        variant="compact"
                        className="aspect-square h-full w-full"
                        onFileSelect={(file) => {
                          field.onChange([
                            ...(field.value || []),
                            URL.createObjectURL(file),
                          ]);
                        }}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center text-xs text-muted-foreground">
                          <span>Add</span>
                        </div>
                      </ModernFileUpload>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <div className="space-y-6 col-span-2 grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    control={form.control}
                    name="sellingPrice"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="sellingPrice">
                          Selling Price
                        </FieldLabel>
                        <Input
                          id="sellingPrice"
                          type="number"
                          step="0.01"
                          {...field}
                          value={(field.value as number) ?? ''}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="costPrice"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="costPrice">Cost Price</FieldLabel>
                        <Input
                          id="costPrice"
                          type="number"
                          step="0.01"
                          {...field}
                          value={(field.value as number) ?? ''}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    control={form.control}
                    name="quantity"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="quantity">
                          Current Stock
                        </FieldLabel>
                        <Input
                          id="quantity"
                          type="number"
                          {...field}
                          value={(field.value as number) ?? ''}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="minStockLevel"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel htmlFor="minStockLevel">
                          Low Stock Alert
                        </FieldLabel>
                        <Input
                          id="minStockLevel"
                          type="number"
                          {...field}
                          value={(field.value as number) ?? ''}
                        />
                        <FieldDescription>
                          Alert when stock reaches this level
                        </FieldDescription>
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discount</CardTitle>
                <CardDescription>
                  Apply discounts to this product
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                  control={form.control}
                  name="discount.enabled"
                  render={({ field }) => (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FieldLabel className="text-base">
                          Enable Discount
                        </FieldLabel>
                        <FieldDescription>
                          Apply a discount to the selling price.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />

                {form.watch('discount.enabled') && (
                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      control={form.control}
                      name="discount.type"
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Type</FieldLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage (%)
                              </SelectItem>
                              <SelectItem value="fixed">
                                Fixed Amount
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="discount.value"
                      render={({ field }) => (
                        <Field>
                          <FieldLabel>Value</FieldLabel>
                          <Input
                            type="number"
                            {...field}
                            value={(field.value as number) ?? ''}
                          />
                        </Field>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel>Product Status</FieldLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/inventory')}
          >
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
