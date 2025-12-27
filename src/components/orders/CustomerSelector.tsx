import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react';
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

const customerSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
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

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
  });

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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={createCustomer.isPending}
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoading}
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select customer...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-75 p-0" align="start">
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
                        {customer.email || customer.phone}
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
