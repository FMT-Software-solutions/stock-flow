import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import {
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
} from '@/hooks/useCustomerQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { BranchFormSelector } from '@/components/shared/BranchFormSelector';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '@/utils/cloudinary';

const customerSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional(),
  images: z.array(z.string()).max(3, 'Maximum 3 images allowed').optional(),
});

export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { currentOrganization } = useOrganization();

  const { data: customer } = useCustomer(id);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const [isUploading, setIsUploading] = useState(false);

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      branchId: '',
      images: [],
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        branchId: customer.branchId || '',
        images: customer.images || [],
      });
    }
  }, [customer, form]);

  const handleImagesUpload = async (
    files: File[],
    currentImages: string[],
    onChange: (urls: string[]) => void
  ) => {
    try {
      setIsUploading(true);
      const remainingSlots = 3 - currentImages.length;
      const filesToUpload = files.slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        toast.warning(`Only ${remainingSlots} more image(s) can be added. Maximum is 3.`);
      }

      const uploadPromises = filesToUpload.map((file) => uploadImageToCloudinary(file));
      const newUrls = await Promise.all(uploadPromises);

      onChange([...currentImages, ...newUrls]);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error('Failed to upload some images');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async (
    urlToRemove: string,
    currentImages: string[],
    onChange: (urls: string[]) => void
  ) => {
    const newImages = currentImages.filter((url) => url !== urlToRemove);
    onChange(newImages);

    try {
      await deleteImageFromCloudinary(urlToRemove);
    } catch (error) {
      console.error('Failed to delete image from Cloudinary', error);
    }
  };

  async function onSubmit(values: z.infer<typeof customerSchema>) {
    if (!currentOrganization?.id) return;

    try {
      if (isEditing && id) {
        await updateCustomer.mutateAsync({
          id,
          updates: values,
        });
        toast.success('Customer updated successfully');
      } else {
        await createCustomer.mutateAsync({
          ...values,
          organizationId: currentOrganization.id,
        });
        toast.success('Customer created successfully');
      }
      navigate('/customers');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save customer');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/customers')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Customer' : 'New Customer'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update customer information'
              : 'Add a new customer to your database'}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Controller
                control={form.control}
                name="firstName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                    <Input id="firstName" placeholder="John" {...field} />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="lastName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                    <Input id="lastName" placeholder="Doe" {...field} />
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
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@example.com"
                      {...field}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={!!fieldState.error}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input
                      id="phone"
                      placeholder="+233456765678"
                      {...field}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Branch</FieldLabel>
                  <BranchFormSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select branch (optional)"
                  />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="address"
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor="address">Address / Location</FieldLabel>
                  <Textarea
                    id="address"
                    placeholder="123 Main St, City, Country"
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
            <CardTitle>Customer Pictures</CardTitle>
            <CardDescription>
              Upload up to 3 pictures for this customer (e.g., store front, ID, profile).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="images"
              render={({ field, fieldState }) => {
                const currentImages = field.value || [];
                return (
                  <Field data-invalid={!!fieldState.error}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {currentImages.map((url: string, index: number) => (
                        <div
                          key={index}
                          className="relative aspect-square w-full overflow-hidden rounded-lg border"
                        >
                          <img
                            src={url}
                            alt={`Customer picture ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 h-5 w-5"
                            onClick={() =>
                              handleRemoveImage(url, currentImages, field.onChange)
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {currentImages.length < 3 && (
                        <div className="relative aspect-square h-full w-full">
                          <ModernFileUpload
                            variant="compact"
                            className="h-full w-full"
                            multiple={true}
                            onFilesSelect={(files) =>
                              handleImagesUpload(files, currentImages, field.onChange)
                            }
                            onFileSelect={(file) =>
                              handleImagesUpload([file], currentImages, field.onChange)
                            }
                            disabled={isUploading}
                            maxSize={5}
                          />

                          {isUploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-xs font-medium text-center p-2 rounded-lg">
                              <Loader2 className="h-5 w-5 animate-spin mb-1" />
                              <span>Uploading...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                );
              }}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/customers')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || isUploading}>
            {(form.formState.isSubmitting || isUploading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? 'Update Customer' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
