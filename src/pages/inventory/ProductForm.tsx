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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Loader2, Wand2 } from 'lucide-react';

import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import {
  useCreateProduct,
  useUpdateProduct,
} from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from '@/utils/cloudinary';
import { useState } from 'react';
import type { Product, Category, Supplier } from '@/types/inventory';
import { toast } from 'sonner';
import { useProductForm } from './hooks/useProductForm';
import { productSchema } from './form-schema/product-form-schema';
import { AiGeneratorButton } from '@/components/shared/AiGeneratorButton';

interface ProductFormInnerProps {
  isEditing: boolean;
  id?: string;
  orgId?: string;
  product: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  defaultValues: z.infer<typeof productSchema>;
}

export function ProductForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  const orgId = currentOrganization?.id;

  const {
    isLoading,
    product,
    categories,
    suppliers,
    defaultValues,
  } = useProductForm({ id, organizationId: orgId, isOrgLoading });

  if (isEditing && isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <ProductFormInner
      key={isEditing ? id ?? 'new-product' : 'new-product'}
      isEditing={isEditing}
      id={id}
      orgId={orgId}
      product={product ?? null}
      categories={categories}
      suppliers={suppliers}
      defaultValues={defaultValues}
    />
  );
}

function ProductFormInner({
  isEditing,
  id,
  orgId,
  product,
  categories,
  suppliers,
  defaultValues,
}: ProductFormInnerProps) {
  const navigate = useNavigate();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);

  const isUploading = isUploadingMain || isUploadingAdditional;

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  async function onSubmit(values: z.infer<typeof productSchema>) {
    if (!orgId) return;

    try {
      if (isEditing && id) {
        await updateProduct.mutateAsync({
          id,
          updates: {
            ...values,
            organizationId: orgId,
          },
          oldImageUrl: product?.imageUrl,
        });
        toast.success('Product updated successfully');
      } else {
        await createProduct.mutateAsync({
          ...values,
          organizationId: orgId,
        });
        toast.success('Product created successfully');
      }
      navigate('/inventory');
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Failed to save product');
    }
  }

  const handleMainImageUpload = async (
    file: File,
    onChange: (url: string) => void
  ) => {
    try {
      setIsUploadingMain(true);
      const url = await uploadImageToCloudinary(file);
      onChange(url);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingMain(false);
    }
  };

  const handleAdditionalImagesUpload = async (
    files: File[],
    currentImages: string[],
    onChange: (urls: string[]) => void
  ) => {
    try {
      setIsUploadingAdditional(true);
      // Upload all images concurrently
      const uploadPromises = files.map((file) => uploadImageToCloudinary(file));
      const newUrls = await Promise.all(uploadPromises);

      onChange([...currentImages, ...newUrls]);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Failed to upload some images');
    } finally {
      setIsUploadingAdditional(false);
    }
  };

  const handleRemoveImage = async (
    urlToRemove: string,
    currentImages: string[],
    onChange: (urls: string[]) => void
  ) => {
    // Optimistically update the UI first? Or wait for deletion?
    // User requested: "even if we've not saved the images to our db yet, we can still delete them"
    // So we should try to delete from cloudinary.

    // Remove from UI immediately to feel responsive
    const newImages = currentImages.filter((url) => url !== urlToRemove);
    onChange(newImages);

    // Delete from Cloudinary in background
    try {
      await deleteImageFromCloudinary(urlToRemove);
    } catch (error) {
      console.error('Failed to delete image from Cloudinary', error);
      // We don't necessarily need to revert the UI change if it fails,
      // but logging it is good.
    }
  };

  const handleRemoveMainImage = async (
    urlToRemove: string,
    onChange: (url: string) => void
  ) => {
    onChange('');
    try {
      await deleteImageFromCloudinary(urlToRemove);
    } catch (error) {
      console.error('Failed to delete image from Cloudinary', error);
    }
  };

  const generateSku = () => {
    const name = form.getValues('name');
    if (!name) {
      toast.error('Please enter a product name first to generate SKU');
      return;
    }

    // Generate SKU: First 3 letters of name (or first letter of each word) + Random 4 digits
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
    const words = cleanName.split(/\s+/);
    let prefix = '';

    if (words.length > 1) {
      prefix = words
        .slice(0, 3)
        .map((w) => w[0])
        .join('');
    } else {
      prefix = cleanName.substring(0, 3);
    }

    // Ensure prefix is at least 3 chars
    prefix = prefix.padEnd(3, 'X').substring(0, 3);

    const random = Math.floor(1000 + Math.random() * 9000);
    const sku = `${prefix}-${random}`;

    form.setValue('sku', sku, { shouldValidate: true, shouldDirty: true });
    toast.success(`Generated SKU: ${sku}`);
  };

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
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? 'Edit Product' : 'Create New Product'}
          </h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
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
                        <div className="flex gap-2">
                          <Input
                            id="sku"
                            placeholder="IP14PRO-128"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Generate SKU from Name"
                            onClick={generateSku}
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel>Category</FieldLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
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
                </div>

                <Controller
                  control={form.control}
                  name="supplierId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel>Supplier</FieldLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  control={form.control}
                  name="description"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="description" className="mb-0">
                          Description
                        </FieldLabel>
                        <AiGeneratorButton
                          context={{
                            productName: form.watch('name'),
                            categoryName: categories.find(
                              (c) => c.id === form.watch('categoryId')
                            )?.name,
                          }}
                          onGenerate={(text) => field.onChange(text)}
                        />
                      </div>
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
                <CardTitle>Pricing</CardTitle>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FieldLabel>Status</FieldLabel>
                        <FieldDescription>
                          Product visibility status
                        </FieldDescription>
                      </div>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger className="w-35">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
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
                          onClick={() =>
                            handleRemoveMainImage(field.value!, field.onChange)
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <ModernFileUpload
                          onFileSelect={(file) =>
                            handleMainImageUpload(file, field.onChange)
                          }
                          disabled={isUploadingMain}
                        />
                        {isUploadingMain && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-sm font-medium">
                            <Loader2 className="h-6 w-6 animate-spin mb-2" />
                            <span>Uploading...</span>
                          </div>
                        )}
                      </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            onClick={() =>
                              handleRemoveImage(
                                url,
                                field.value || [],
                                field.onChange
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="relative aspect-square h-full w-full">
                        <ModernFileUpload
                          variant="compact"
                          className="h-full w-full"
                          multiple={true}
                          onFilesSelect={(files) =>
                            handleAdditionalImagesUpload(
                              files,
                              field.value || [],
                              field.onChange
                            )
                          }
                          onFileSelect={(file) =>
                            handleAdditionalImagesUpload(
                              [file],
                              field.value || [],
                              field.onChange
                            )
                          }
                          disabled={isUploadingAdditional}
                        />

                        {isUploadingAdditional && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-xs font-medium text-center p-2">
                            <Loader2 className="h-5 w-5 animate-spin mb-1" />
                            <span>Uploading...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/inventory')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isUploading ||
              createProduct.isPending ||
              updateProduct.isPending ||
              form.formState.isSubmitting
            }
          >
            {(createProduct.isPending || updateProduct.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
