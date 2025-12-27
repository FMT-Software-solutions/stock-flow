import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Trash2, Plus } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCreateOrder, useUpdateOrder } from '@/hooks/useOrders';
import { useInventoryEntries } from '@/hooks/useInventoryQueries';
import { BranchFormSelector } from '@/components/shared/BranchFormSelector';
import { InventorySelector } from '@/components/orders/InventorySelector';
import { CustomerSelector } from '@/components/orders/CustomerSelector';
import { RecentOrders } from '@/components/orders/RecentOrders';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  orderSchema,
  type OrderFormValues,
  PERSIST_KEYS,
} from './form-schema/order-form-schema';
import { useOrderForm } from '@/hooks/useOrderForm';
import type { Order } from '@/types/orders';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useBranchContext } from '@/contexts/BranchContext';

export function OrderForm() {
  const { id } = useParams();
  const isEditing = !!id;

  const { isLoading, order, defaultValues } = useOrderForm({ id });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <OrderFormInner
        key={isEditing ? id ?? 'new-order' : 'new-order'}
        isEditing={isEditing}
        id={id}
        defaultValues={defaultValues}
        existingOrder={order}
      />
    </div>
  );
}

interface OrderFormInnerProps {
  isEditing: boolean;
  id?: string;
  defaultValues: OrderFormValues;
  existingOrder?: Order | null;
}

function OrderFormInner({
  isEditing,
  id,
  defaultValues,
  existingOrder,
}: OrderFormInnerProps) {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { currentOrganization } = useOrganization();
  const { availableBranches } = useBranchContext();

  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();

  // Initialize selectedBranchId from defaultValues
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    defaultValues.branchId
  );

  const { data: inventory = [] } = useInventoryEntries(
    currentOrganization?.id,
    selectedBranchId ? [selectedBranchId] : undefined
  );

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema) as any,
    defaultValues,
  });

  // Update form values when defaultValues change (e.g. after data load)
  useEffect(() => {
    if (isEditing) {
      form.reset(defaultValues);
      // Also update local state for branch filtering
      if (defaultValues.branchId) {
        setSelectedBranchId(defaultValues.branchId);
      }
    }
  }, [defaultValues, form, isEditing]);

  // Watch for changes to persist (only for new orders or branch updates)
  useEffect(() => {
    if (!isEditing) {
      const subscription = form.watch((value, { name }) => {
        if (name === 'branchId') {
          const val = value.branchId || '';
          if (val) {
            sessionStorage.setItem(PERSIST_KEYS.BRANCH, val);
            setSelectedBranchId(val);
          } else {
            sessionStorage.removeItem(PERSIST_KEYS.BRANCH);
            setSelectedBranchId('');
          }
        } 
        if (name === 'status' && value.status)
          sessionStorage.setItem(PERSIST_KEYS.STATUS, value.status);
        if (name === 'paymentStatus' && value.paymentStatus)
          sessionStorage.setItem(
            PERSIST_KEYS.PAYMENT_STATUS,
            value.paymentStatus
          );
        if (name === 'paymentMethod' && value.paymentMethod)
          sessionStorage.setItem(
            PERSIST_KEYS.PAYMENT_METHOD,
            value.paymentMethod
          );
      });
      return () => subscription.unsubscribe();
    } else {
      // Just update local state for branch filtering
      const subscription = form.watch((value, { name }) => {
        if (name === 'branchId') {
          const val = value.branchId || '';
          setSelectedBranchId(val);
        } 
      });
      return () => subscription.unsubscribe();
    }
  }, [form, isEditing]);
  
  useEffect(() => {
    if (isEditing) return;
    const validIds = availableBranches.map((b) => b.id);
    const current = form.getValues('branchId') || '';
    if (!current || !validIds.includes(current)) {
      const next = availableBranches[0]?.id || '';
      form.setValue('branchId', next);
      setSelectedBranchId(next);
      if (next) {
        sessionStorage.setItem(PERSIST_KEYS.BRANCH, next);
      } else {
        sessionStorage.removeItem(PERSIST_KEYS.BRANCH);
      }
    }
  }, [availableBranches, form, isEditing]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Calculate total
  const items = form.watch('items');
  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  async function onSubmit(values: OrderFormValues) {
    if (!currentOrganization?.id) return;

    try {
      // Enrich items with product details (snapshot)
      const enrichedItems = values.items.map((item) => {
        const invItem = inventory.find((i) => i.id === item.inventoryId);
        return {
          inventory_id: item.inventoryId,
          product_id: invItem?.productId,
          variant_id: invItem?.variantId,
          product_name:
            invItem?.productName || item.productName || 'Unknown Product',
          sku: invItem?.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
        };
      });

      const orderData = {
        organization_id: currentOrganization.id,
        branch_id: values.branchId,
        customer_id: values.customerId || null,
        status: values.status,
        payment_status: values.paymentStatus,
        payment_method: values.paymentMethod,
        total_amount: totalAmount,
        subtotal: totalAmount, // For now assuming no tax/discount calculation separately
        tax: 0,
        discount: 0,
        notes: values.notes,
        items: enrichedItems,
      };

      if (isEditing && id) {
        await updateOrder.mutateAsync({
          id,
          ...orderData,
        });
        toast.success('Order updated successfully');
        navigate('/orders');
      } else {
        await createOrder.mutateAsync(orderData);
        toast.success('Order created successfully');
        
        // Reset form for next order but keep configuration values
        // This helps when processing multiple orders in a queue
        form.reset({
          branchId: values.branchId,
          customerId: '', // Reset customer
          status: values.status,
          paymentStatus: values.paymentStatus,
          paymentMethod: values.paymentMethod,
          notes: '',
          items: [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save order');
    }
  }

  return (
    <div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/orders')}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {isEditing ? 'Edit Sale or Order' : 'New Sale or Order'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? 'Update sale or order details'
                  : 'Record a new sale or order'}
              </p>
            </div>
          </div>

          <div className="w-full md:w-75">
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <div className="flex gap-2">
                  <FieldLabel>
                    Branch
                  </FieldLabel>
                  <BranchFormSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Branch"
                  />
                  {form.formState.errors.branchId && (
                    <FieldError>
                      {form.formState.errors.branchId.message}
                    </FieldError>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {fields.map((field, index) => {
                  const item = items[index];
                  const selectedItem = inventory.find(
                    (i) => i.id === item?.inventoryId
                  );

                  // Calculate max quantity available (Total stock + original order qty if editing)
                  let maxQty = selectedItem?.quantity || 0;
                  if (isEditing && existingOrder?.items) {
                    const originalItem = existingOrder.items.find(
                      (i) => i.inventory_id === item?.inventoryId
                    );
                    if (originalItem) {
                      maxQty += Number(originalItem.quantity);
                    }
                  }

                  const currentQty = Number(item?.quantity) || 0;
                  const simulatedStock = maxQty - currentQty;

                  return (
                    <div
                      key={field.id}
                      className="flex gap-4 items-end border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-50">
                        <Controller
                          control={form.control}
                          name={`items.${index}.inventoryId`}
                          render={({
                            field: { onChange, value },
                            fieldState,
                          }) => (
                            <Field data-invalid={!!fieldState.error}>
                              <InventorySelector
                                value={value}
                                onChange={(val, price) => {
                                  onChange(val);
                                  if (price !== undefined) {
                                    form.setValue(
                                      `items.${index}.unitPrice`,
                                      price
                                    );
                                  }
                                }}
                                branchId={selectedBranchId}
                                disabled={!selectedBranchId}
                                excludeIds={items
                                  .filter((_, i) => i !== index)
                                  .map((item) => item.inventoryId)
                                  .filter(Boolean)}
                                quantityOverride={simulatedStock}
                              />
                              {fieldState.error && (
                                <FieldError>
                                  {fieldState.error.message}
                                </FieldError>
                              )}
                            </Field>
                          )}
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <Controller
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field, fieldState }) => {
                            return (
                              <Field data-invalid={!!fieldState.error}>
                                <FieldLabel>Qty</FieldLabel>
                                <Input
                                  type="number"
                                  {...field}
                                  min={1}
                                  max={maxQty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val > maxQty) {
                                      field.onChange(maxQty);
                                      toast.error(
                                        `Only ${maxQty} items available in stock`
                                      );
                                    } else {
                                      field.onChange(e);
                                    }
                                  }}
                                  value={(field.value as number) ?? ''}
                                />
                              </Field>
                            );
                          }}
                        />
                      </div>
                      <div className="w-32 shrink-0">
                        <Controller
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={!!fieldState.error}>
                              <FieldLabel>Price</FieldLabel>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                readOnly
                                className="bg-muted"
                                value={(field.value as number) ?? ''}
                              />
                            </Field>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive mb-1 shrink-0"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    append({ inventoryId: '', quantity: 1, unitPrice: 0 })
                  }
                  disabled={!selectedBranchId}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
                {!selectedBranchId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a branch to add items.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <Textarea {...field} placeholder="Add notes here..." />
                  )}
                />
              </CardContent>
            </Card>

          
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Controller
                  control={form.control}
                  name="customerId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel>Customer (Optional)</FieldLabel>
                      <CustomerSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel>Status</FieldLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="paymentStatus"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel>Payment</FieldLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Payment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
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
                  name="paymentMethod"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={!!fieldState.error}>
                      <FieldLabel>Payment Method</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="mobile_money">
                            Mobile Money
                          </SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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

            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/orders')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  !selectedBranchId ||
                  createOrder.isPending ||
                  updateOrder.isPending
                }
              >
                {isEditing ? 'Update Order' : 'Create Order'}
              </Button>
            </div>
          </div>
        </div>
      </form>

  {/* Recent Orders Section */}

      <div className='mt-8'>
      <Accordion
      type="single"
      collapsible
      className="w-full"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>Recent Orders</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
      
        {!isEditing && <RecentOrders />}
        </AccordionContent>
       </AccordionItem>
       </Accordion>
      </div>
    </div>
  );
}
