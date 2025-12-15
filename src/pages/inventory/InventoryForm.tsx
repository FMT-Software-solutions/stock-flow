import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react';
import { BranchFormSelector } from '@/components/shared/BranchFormSelector';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useProducts,
  useProduct,
  useCreateInventoryEntry,
  useProductInventory,
} from '@/hooks/useInventoryQueries';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const inventoryItemSchema = z.object({
  productId: z.string().min(1, { message: 'Product is required.' }),
  variantId: z.string().optional(),
  branchId: z.string().min(1, { message: 'Branch is required.' }),
  quantity: z.coerce.number().min(0),
  minStockLevel: z.coerce.number().min(0).default(0),
  location: z.string().optional(),
});

const inventoryFormSchema = z.object({
  branchId: z.string().min(1, { message: 'Branch is required.' }),
  productId: z.string().min(1, { message: 'Product is required.' }),
  items: z.array(inventoryItemSchema),
});

type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

const EMPTY_ARRAY: any[] = [];

export function InventoryForm() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: products = [], isLoading: isLoadingProducts } = useProducts(
    orgId
  );

  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >(undefined);

  const { data: selectedProduct, isLoading: isLoadingProduct } = useProduct(
    selectedProductId
  );

  const { data: existingInventoryData } = useProductInventory(
    selectedProductId
  );

  const existingInventory = existingInventoryData || EMPTY_ARRAY;

  const createEntry = useCreateInventoryEntry();

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema) as any,
    defaultValues: {
      branchId: '',
      productId: '',
      items: [],
    },
  });

  const { fields, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    form.setValue('productId', productId);
    // Items will be populated via useEffect when selectedProduct changes
  };

  const watchedBranchId = form.watch('branchId');

  useEffect(() => {
    if (selectedProduct && watchedBranchId) {
      const existingInBranch = existingInventory.filter(
        (inv: any) => inv.branch_id === watchedBranchId
      );

      if (selectedProduct.hasVariations && selectedProduct.variants) {
        // Filter variants that don't have inventory in this branch
        const availableVariants = selectedProduct.variants.filter(
          (variant: any) =>
            !existingInBranch.some((inv: any) => inv.variant_id === variant.id)
        );

        const newItems = availableVariants.map((variant: any) => ({
          productId: selectedProduct.id,
          variantId: variant.id,
          branchId: watchedBranchId,
          quantity: 0,
          minStockLevel: 0,
          location: '',
        }));
        replace(newItems);
      } else {
        // Check if simple product already has inventory in this branch
        const exists = existingInBranch.some(
          (inv: any) => inv.product_id === selectedProduct.id && !inv.variant_id
        );

        if (!exists) {
          replace([
            {
              productId: selectedProduct.id,
              variantId: undefined,
              branchId: watchedBranchId,
              quantity: 0,
              minStockLevel: 0,
              location: '',
            },
          ]);
        } else {
          replace([]); // Already exists
        }
      }
    } else {
      replace([]);
    }
  }, [selectedProduct, watchedBranchId, existingInventory, replace]);

  const onSubmit = async (values: InventoryFormValues) => {
    if (!orgId) return;

    try {
      for (const item of values.items) {
        await createEntry.mutateAsync({
          productId: item.productId,
          variantId: item.variantId || undefined,
          branchId: values.branchId, // Use top level branch ID
          quantity: item.quantity,
          minStockLevel: item.minStockLevel,
          location: item.location,
          organizationId: orgId,
        });
      }
      navigate('/inventory');
    } catch (error) {
      console.error('Failed to create inventory entry', error);
    }
  };

  const isSubmitting =
    createEntry.isPending ||
    form.formState.isSubmitting ||
    isLoadingProducts ||
    isLoadingProduct;

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
          <h1 className="text-3xl font-bold tracking-tight">New Inventory</h1>
          <p className="text-muted-foreground">
            Create stock entries for your branches
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={form.control}
                name="branchId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel>Branch</FieldLabel>
                    <BranchFormSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="productId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel>Product</FieldLabel>
                    <Select
                      onValueChange={handleProductChange}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Inventory Items</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select a product to view and configure inventory items.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant / Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Min Stock</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="w-[30px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const variant = selectedProduct?.variants?.find(
                        (v: any) => v.id === field.variantId
                      );

                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {selectedProduct?.name}
                              </span>
                              {variant && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(variant.attributes).map(
                                    ([key, value]) => (
                                      <Badge
                                        key={key}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {key}: {value}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              )}
                              {!variant && (
                                <span className="text-xs text-muted-foreground">
                                  Standard Item
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field: inputField, fieldState }) => (
                                <div>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-24"
                                    {...inputField}
                                    value={inputField.value ?? 0}
                                  />
                                  {fieldState.error && (
                                    <p className="text-xs text-red-500 mt-1">
                                      {fieldState.error.message}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`items.${index}.minStockLevel`}
                              render={({ field: inputField }) => (
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-24"
                                  {...inputField}
                                  value={inputField.value ?? 0}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`items.${index}.location`}
                              render={({ field: inputField }) => (
                                <Input
                                  placeholder="Location"
                                  className="w-full"
                                  {...inputField}
                                  value={inputField.value ?? ''}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell className="w-[30px]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/inventory')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || fields.length === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Inventory ({fields.length} items)
          </Button>
        </div>
      </form>
    </div>
  );
}
