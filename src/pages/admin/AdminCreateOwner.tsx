import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';

const formSchema = z.object({
  organizationId: z.string().optional().or(z.literal('')),
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters'),
  organizationEmail: z
    .email('Invalid organization email')
    .optional()
    .or(z.literal('')),
  organizationPhone: z.string().optional().or(z.literal('')),
  organizationAddress: z.string().optional().or(z.literal('')),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  userEmail: z.email('Invalid user email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  isPurchase: z.boolean().default(false).optional(),
  provisioningSecret: z.string().min(1, 'Provisioning secret is required'),
});

export default function AdminCreateOwner() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizationId: '',
      organizationName: '',
      organizationEmail: '',
      organizationPhone: '',
      organizationAddress: '',
      firstName: '',
      lastName: '',
      userEmail: '',
      password: '',
      isPurchase: false,
      provisioningSecret: '',
    },
    mode: 'onChange',
  });

  // Access control
  if (user?.email !== 'fmt.stockflow@gmail.com') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You do not have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const organizationId = values.organizationId || crypto.randomUUID();

      const payload = {
        organizationDetails: {
          id: organizationId,
          name: values.organizationName,
          email: values.organizationEmail || undefined,
          phone: values.organizationPhone || undefined,
          address: values.organizationAddress || undefined,
        },
        userDetails: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.userEmail,
          password: values.password,
        },
        isPurchase: values.isPurchase,
        provisioningSecret: values.provisioningSecret,
      };

      const { data, error } = await supabase.functions.invoke(
        'create-organization-owner',
        {
          body: payload,
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to create organization owner');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(
        (data as any).message || 'Organization and owner created successfully'
      );

      form.reset();
    } catch (error) {
      toast.error((error as Error).message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Admin: Create Organization Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Organization Details</h3>

                <FormField
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Existing Organization ID (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="uuid" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="organizationEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Email (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="contact@acme.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="organizationPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="organizationAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Owner User Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="userEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@acme.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="******"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Settings</h3>
                <FormField
                  control={form.control}
                  name="isPurchase"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Purchase Mode
                        </FormLabel>
                        <FormDescription>
                          If enabled, organization will be marked as purchased.
                          Otherwise, it will be a trial.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="provisioningSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provisioning Secret</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Secret Key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Organization Owner'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
