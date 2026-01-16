import { useMemo, useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { DatePicker } from '@/components/shared/DatePicker';
import { TimePicker } from '@/components/shared/TimePicker';
import { format } from 'date-fns';

import {
  discountFormSchema,
  type DiscountFormValues,
} from '../form-schema/discount-form-schema';
import { useManageInventoryDiscount } from '@/hooks/useDiscountQueries';
import {
  useCategories,
  useProducts,
  useInventoryEntries,
} from '@/hooks/useInventoryQueries';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { DiscountTarget, Discount } from '@/types/discounts';
import { useAuth } from '@/contexts/AuthContext';

interface CreateDiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  discount?: Discount;
}

export function CreateDiscountSheet({
  open,
  onOpenChange,
  onSuccess,
  discount,
}: CreateDiscountSheetProps) {
  const { currentOrganization } = useOrganization();
  const { availableBranches, isOwner } = useBranchContext();
  const { user } = useAuth();
  const { data: categories } = useCategories(currentOrganization?.id);
  const { data: products } = useProducts(currentOrganization?.id);
  const { data: inventoryEntries } = useInventoryEntries(
    currentOrganization?.id
  );
  const { data: customers } = useCustomers(currentOrganization?.id);
  const { mutate: manageDiscount, isPending } = useManageInventoryDiscount();

  const isEditing = !!discount;
  const [step, setStep] = useState<number>(0);

  const form = useForm<DiscountFormValues>({
    resolver: zodResolver(discountFormSchema) as any,
    defaultValues: {
      name: discount?.name ?? '',
      code: discount?.code ?? '',
      description: discount?.description ?? '',
      type: discount?.type ?? 'percentage',
      value: discount?.value ?? 0,
      usageMode: discount?.usageMode ?? 'manual',
      usageLimit: discount?.usageLimit ?? null,
      customerIds: (discount?.customerIds ?? []) as string[],
      branchIds: (discount?.branchIds ??
        (!isEditing && !isOwner && availableBranches.length === 1
          ? [availableBranches[0].id]
          : [])) as string[],
      startAt: discount?.startAt ? format(new Date(discount.startAt), 'yyyy-MM-dd') : undefined,
      startTime: discount?.startAt ? format(new Date(discount.startAt), 'HH:mm') : '00:00',
      expiresAt: discount?.expiresAt ? format(new Date(discount.expiresAt), 'yyyy-MM-dd') : undefined,
      endTime: discount?.expiresAt ? format(new Date(discount.expiresAt), 'HH:mm') : '23:59',
      targetType: discount?.targetMode ?? 'all',
      targetIds: [],
      targetBranchIds: [],
    },
  });

  useEffect(() => {
    if (discount && open) {
      form.reset({
        name: discount.name,
        code: discount.code ?? '',
        description: discount.description ?? '',
        type: discount.type,
        value: discount.value,
        usageMode: discount.usageMode ?? 'manual',
        usageLimit: discount.usageLimit ?? null,
        customerIds: (discount.customerIds ?? []) as string[],
        branchIds: (discount.branchIds ?? []) as string[],
        startAt: discount.startAt ? format(new Date(discount.startAt), 'yyyy-MM-dd') : undefined,
        startTime: discount.startAt ? format(new Date(discount.startAt), 'HH:mm') : '00:00',
        expiresAt: discount.expiresAt ? format(new Date(discount.expiresAt), 'yyyy-MM-dd') : undefined,
        endTime: discount.expiresAt ? format(new Date(discount.expiresAt), 'HH:mm') : '23:59',
        targetType: discount.targetMode ?? 'all',
        targetIds: [],
        targetBranchIds: [],
      } as any);
      setStep(0);
    }
  }, [discount, open]); 

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!isEditing && !isOwner && availableBranches.length === 1) {
      const current = form.getValues('branchIds') || [];
      if (current.length === 0) {
        form.setValue('branchIds', [availableBranches[0].id]);
      }
    }
  }, [isEditing, isOwner, availableBranches, form]);

  const targetType = form.watch('targetType');

  // Options for Selectors
  const categoryOptions: Option[] = useMemo(
    () =>
      categories?.map((c) => ({
        label: c.name,
        value: c.id,
      })) || [],
    [categories]
  );

  const productOptions: Option[] = useMemo(
    () =>
      products?.map((p) => ({
        label: p.name,
        value: p.id,
      })) || [],
    [products]
  );

  const customerOptions: Option[] = useMemo(
    () =>
      customers?.map((c) => ({
        label: `${c.firstName} ${c.lastName}`.trim(),
        value: c.id,
      })) || [],
    [customers]
  );

  const branchOptions: Option[] = useMemo(
    () =>
      availableBranches.map((b) => ({
        label: b.name,
        value: b.id,
      })),
    [availableBranches]
  );

  const inventoryOptions: Option[] = useMemo(
    () =>
      inventoryEntries?.map((i) => ({
        label: `${i.productName} - ${i.branchName || 'No Branch'} (${
          i.quantity
        })`,
        value: i.id,
      })) || [],
    [inventoryEntries]
  );

  const combineDateTimeToIso = (date?: string, time?: string) => {
    if (!date) return undefined;
    const t = time || '00:00';
    const dateTime = new Date(`${date}T${t}:00`);
    return dateTime.toISOString();
  };

  const onSubmit: SubmitHandler<DiscountFormValues> = (values) => {
    if (!currentOrganization?.id) return;

    const computedBranchIds =
      isOwner
        ? (values.branchIds || [])
        : (values.branchIds && values.branchIds.length > 0
            ? values.branchIds
            : availableBranches.map((b) => b.id));

    const targets: DiscountTarget & { apply_to_all?: boolean } = {
      targetBranchIds: computedBranchIds,
    };

    if (values.targetType === 'all') {
      targets.apply_to_all = true;
    } else if (values.targetType === 'category') {
      targets.categoryIds = values.targetIds;
    } else if (values.targetType === 'product') {
      targets.productIds = values.targetIds;
    } else if (values.targetType === 'inventory') {
      targets.inventoryIds = values.targetIds;
    }

    manageDiscount(
      {
        organizationId: currentOrganization.id,
        action: 'apply',
        discount: {
          id: discount?.id,
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          type: values.type,
          value: values.value,
          usageMode: values.usageMode,
          usageLimit: values.usageLimit ?? null,
          startAt: combineDateTimeToIso(values.startAt, values.startTime),
          expiresAt: combineDateTimeToIso(values.expiresAt, values.endTime),
          customerIds: values.customerIds || [],
          branchIds: computedBranchIds,
          createdBy: !isEditing ? user?.id : undefined,
        },
        targets: (targets as any),
      },
      {
        onSuccess: () => {
          toast.success(isEditing ? 'Discount updated successfully' : 'Discount created and applied successfully');
          form.reset();
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error((isEditing ? 'Failed to update discount: ' : 'Failed to apply discount: ') + error.message);
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Discount' : 'Create Discount'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update discount details.' : 'Create a new discount rule and apply it to your inventory.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit as any)}
            className="space-y-6 py-6"
          >
            {(
              <div className="grid w-full grid-cols-2">
                <div className={`text-center py-2 cursor-pointer ${step === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`} onClick={() => setStep(0)}>
                  Details
                </div>
                <div
                  className={`text-center py-2 ${step === 1 ?  'bg-primary text-primary-foreground' : 'bg-muted/50'} cursor-pointer`}
                  onClick={async () => {
                    const ok = await form.trigger(['name', 'type', 'value'] as any);
                    if (ok) setStep(1);
                  }}
                >
                  Application & Rules
                </div>
              </div>
            )}

            {step === 0 && (
              <div className="space-y-4 pt-4">
                <FormField
                  control={form.control as any}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Summer Sale" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control as any}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="SUMMER2025" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control as any}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage (%)
                              </SelectItem>
                              <SelectItem value="fixed">
                                Fixed Amount
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as any}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control as any}
                    name="startAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value ? new Date(field.value) : undefined}
                            setDate={(date) =>
                              field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control as any}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value ? new Date(field.value) : undefined}
                            setDate={(date) =>
                              field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control as any}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <TimePicker
                            value={field.value}
                            onChange={(val) => field.onChange(val)}
                            placeholder="Pick time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control as any}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <TimePicker
                            value={field.value}
                            onChange={(val) => field.onChange(val)}
                            placeholder="Pick time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 pt-4">
                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <h3 className="font-medium text-sm">Eligibility Rules</h3>
                  <FormField
                    control={form.control as any}
                    name="customerIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limit to Specific Customers</FormLabel>
                        <FormControl>
                          <MultipleSelector
                            value={customerOptions.filter((o) =>
                              field.value?.includes(o.value)
                            )}
                            defaultOptions={customerOptions}
                            triggerSearchOnFocus
                            onSearchSync={(term: string) => {
                              const t = term?.toLowerCase() ?? '';
                              if (!t) return customerOptions;
                              return customerOptions.filter((o) =>
                                o.label.toLowerCase().includes(t)
                              );
                            }}
                            onChange={(options: Option[]) =>
                              field.onChange(options.map((o) => o.value))
                            }
                            placeholder="Select customers..."
                            emptyIndicator={
                              <p className="text-center text-sm text-gray-500">
                                No customers found.
                              </p>
                            }
                          />
                        </FormControl>
                        <FormDescription className='text-xs'>
                          Leave empty for all customers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="branchIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Only in Branches</FormLabel>
                      <MultipleSelector
                        value={branchOptions.filter((o) =>
                          field.value?.includes(o.value)
                        )}
                        defaultOptions={branchOptions}
                        disabled={!isOwner && availableBranches.length === 1}
                        triggerSearchOnFocus
                        onSearchSync={(term: string) => {
                          const t = term?.toLowerCase() ?? '';
                          if (!t) return branchOptions;
                          return branchOptions.filter((o) =>
                              o.label.toLowerCase().includes(t)
                            );
                          }}
                          onChange={(options: Option[]) =>
                            field.onChange(options.map((o) => o.value))
                          }
                          placeholder="Select branches..."
                          emptyIndicator={
                            <p className="text-center text-sm text-gray-500">
                              No branches found.
                            </p>
                          }
                        />
                      <FormDescription className='text-xs'>
                         {isOwner ? 'Leave empty for all branches' : 'Leave empty to make valid in all your assigned branches.' } 
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control as any}
                    name="usageMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage Mode</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className='w-full'>
                              <SelectValue placeholder="Select usage mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="automatic">Automatic</SelectItem>
                            <SelectItem value="manual">Manual (Discount Code Required)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control as any}
                    name="usageLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage Limit</FormLabel>
                        <FormControl>
                          <Input 
                          type="number" 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          placeholder='Leave empty for unlimited usage'
                          min={1}
                          />
                        </FormControl>
                        
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <h3 className="font-medium text-sm">Apply To Inventory</h3>
                  <FormField
                    control={form.control as any}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Targeting Mode</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(val) => {
                                field.onChange(val);
                                form.setValue('targetIds', []);
                            }}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                                <SelectValue placeholder="Select target..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Inventory (Storewide)</SelectItem>
                                <SelectItem value="category">Specific Categories</SelectItem>
                                <SelectItem value="product">Specific Products</SelectItem>
                                <SelectItem value="inventory">Specific Inventory Items</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {targetType === 'category' && (
                    <FormField
                      control={form.control as any}
                      name="targetIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Categories</FormLabel>
                          <MultipleSelector
                            value={categoryOptions.filter((o) =>
                              field.value?.includes(o.value)
                            )}
                            defaultOptions={categoryOptions}
                            triggerSearchOnFocus
                            onSearchSync={(term: string) => {
                              const t = term?.toLowerCase() ?? '';
                              if (!t) return categoryOptions;
                              return categoryOptions.filter((o) =>
                                o.label.toLowerCase().includes(t)
                              );
                            }}
                            onChange={(options: Option[]) =>
                              field.onChange(options.map((o) => o.value))
                            }
                            placeholder="Select categories..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {targetType === 'product' && (
                    <FormField
                      control={form.control as any}
                      name="targetIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Products</FormLabel>
                          <MultipleSelector
                            value={productOptions.filter((o) =>
                              field.value?.includes(o.value)
                            )}
                            defaultOptions={productOptions}
                            triggerSearchOnFocus
                            onSearchSync={(term: string) => {
                              const t = term?.toLowerCase() ?? '';
                              if (!t) return productOptions;
                              return productOptions.filter((o) =>
                                o.label.toLowerCase().includes(t)
                              );
                            }}
                            onChange={(options: Option[]) =>
                              field.onChange(options.map((o) => o.value))
                            }
                            placeholder="Select products..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {targetType === 'inventory' && (
                    <FormField
                      control={form.control as any}
                      name="targetIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Inventory Items</FormLabel>
                          <MultipleSelector
                            value={inventoryOptions.filter((o) =>
                              field.value?.includes(o.value)
                            )}
                            defaultOptions={inventoryOptions}
                            triggerSearchOnFocus
                            onSearchSync={(term: string) => {
                              const t = term?.toLowerCase() ?? '';
                              if (!t) return inventoryOptions;
                              return inventoryOptions.filter((o) =>
                                o.label.toLowerCase().includes(t)
                              );
                            }}
                            onChange={(options: Option[]) =>
                              field.onChange(options.map((o) => o.value))
                            }
                            placeholder="Select inventory..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  
                </div>
              </div>
            )}

            <SheetFooter>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {step === 0 ? (
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await form.trigger(['name', 'type', 'value'] as any);
                      if (ok) setStep(1);
                    }}
                  >
                    Continue
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStep(0)}
                    >
                      Back
                    </Button>
                    {isEditing ? (
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    ) : (
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create & Apply
                      </Button>
                    )}
                  </>
                )}
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
