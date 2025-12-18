import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
} from '@/hooks/useCustomerQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { BranchFormSelector } from '@/components/shared/BranchFormSelector';

const customerSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional(),
});

export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { currentOrganization } = useOrganization();

  const { data: customer } = useCustomer(id);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      branchId: '',
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
      });
    }
  }, [customer, form]);

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
                      placeholder="+1 (555) 000-0000"
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
                  <FieldLabel htmlFor="address">Address</FieldLabel>
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

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate('/customers')}
          >
            Cancel
          </Button>
          <Button type="submit">
            {isEditing ? 'Update Customer' : 'Create Customer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
