import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, User, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCreateCustomer } from '@/hooks/useCustomerQueries';
import { toast } from 'sonner';
import { ModernFileUpload } from '@/components/shared/ModernFileUpload';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '@/utils/cloudinary';

const customerSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  images: z.array(z.string()).max(3, 'Maximum 3 images allowed').optional(),
});

function QuickCustomerForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (customerId: string) => void;
  onCancel: () => void;
}) {
  const { currentOrganization } = useOrganization();
  const createCustomer = useCreateCustomer();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      images: [] as string[],
    },
  });

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

  const handleImageDelete = async (
    urlToDelete: string,
    currentImages: string[],
    onChange: (urls: string[]) => void
  ) => {
    try {
      await deleteImageFromCloudinary(urlToDelete);
      onChange(currentImages.filter(url => url !== urlToDelete));
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Failed to delete image');
    }
  };

  async function onSubmit(values: z.infer<typeof customerSchema>) {
    if (!currentOrganization?.id) return;
    try {
      const newCustomer = await createCustomer.mutateAsync({
        ...values,
        organizationId: currentOrganization.id,
      });
      toast.success('Customer created successfully');
      onSuccess(newCustomer.id);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create customer');
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="firstName"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel>First Name</FieldLabel>
              <Input {...field} />
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
              <FieldLabel>Last Name</FieldLabel>
              <Input {...field} />
              {fieldState.error && (
                <FieldError>{fieldState.error.message}</FieldError>
              )}
            </Field>
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Email</FieldLabel>
            <Input type="email" {...field} />
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
            <FieldLabel>Phone</FieldLabel>
            <Input {...field} />
            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel>Address / Location</FieldLabel>
            <Input {...field} />
            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="images"
        render={({ field, fieldState }) => {
          const currentImages = field.value || [];
          return (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel>Customer Pictures (Max 3)</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {currentImages.map((url: string, index: number) => (
                  <div
                    key={index}
                    className="relative aspect-square w-full overflow-hidden rounded-md border"
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
                      className="absolute right-1 top-1 h-4 w-4"
                      onClick={() =>
                        handleImageDelete(url, currentImages, field.onChange)
                      }
                    >
                      <X className="h-2 w-2" />
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-[10px] font-medium text-center p-1 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin mb-1" />
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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={createCustomer.isPending || isUploading}
          onClick={() => form.handleSubmit(onSubmit)()}
        >
          {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
        </Button>
      </div>
    </div>
  );
}

interface CustomerSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CustomerSelector({
  value,
  onChange,
  disabled,
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { currentOrganization } = useOrganization();
  const { data: customers = [], isLoading } = useCustomers(
    currentOrganization?.id
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value]
  );

  return (
    <>
      <div className="flex items-center gap-2 w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between flex-1"
              disabled={disabled || isLoading}
            >
              {selectedCustomer ? (
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Select customer...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search customer..." />
              <CommandList>
                <CommandEmpty>
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No customer found.
                  </div>
                </CommandEmpty>
                <CommandGroup heading="Customers">
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={`${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone}`}
                      onSelect={() => {
                        onChange(customer.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === customer.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>
                          {customer.firstName} {customer.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {customer.phone || customer.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new customer
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Create new customer"
          onClick={() => setShowCreateDialog(true)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <QuickCustomerForm
            onSuccess={(newId) => {
              onChange(newId);
              setShowCreateDialog(false);
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
