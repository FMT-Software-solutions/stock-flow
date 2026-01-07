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
import { ChevronLeft, Trash2, Plus, Save, FolderOpen, X } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCreateOrder, useUpdateOrder } from '@/hooks/useOrders';
import { useInventoryEntries } from '@/hooks/useInventoryQueries';
import { BranchFormSelector } from '@/components/shared/BranchFormSelector';
import { InventorySelector } from '@/components/orders/InventorySelector';
import { CustomerSelector } from '@/components/orders/CustomerSelector';
import { RecentOrders } from '@/components/orders/RecentOrders';
import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
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
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { format, formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

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
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  type OrderDraft = { id: string; createdAt: string; values: OrderFormValues };
  const draftsKey = `order-drafts-${currentOrganization?.id || 'global'}`;
  const [drafts, setDrafts] = useLocalStorage<OrderDraft[]>(draftsKey, []);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minTotal, setMinTotal] = useState<string>('');
  const [maxTotal, setMaxTotal] = useState<string>('');
  const [dateSelectId, setDateSelectId] = useState<string>('');
  const branchDrafts = useMemo(
    () => drafts.filter((d) => (d.values.branchId || '') === (selectedBranchId || '')),
    [drafts, selectedBranchId]
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
  const paymentStatus = form.watch('paymentStatus');
  const paidAmount = form.watch('paidAmount');
  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  // Auto-fill paid amount based on status logic
  useEffect(() => {
    if (isEditing) return; // Only auto-fill on new order creation or status change?
    
    // "If the payment status is selected as unpaid or partial but paid amount entered is same as total amount, we should save the status is paid automatically."
    // "same for when paid status is selected but amount entered is not full total amount. we should automatically save status as partial."
    // "If status changed to unpaid or refunded, it should set paid amount to zero automatically."
    // "Change to 'paid' -> update paid_amount to total_amount."

    // Let's handle status changes first
    if (paymentStatus === 'paid') {
        form.setValue('paidAmount', totalAmount);
    } else if (paymentStatus === 'unpaid' || paymentStatus === 'refunded') {
        form.setValue('paidAmount', 0);
    } 
    // partial -> do nothing, let user enter
  }, [paymentStatus, totalAmount, form, isEditing]);

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
        paid_amount: values.paidAmount ?? (values.paymentStatus === 'paid' ? totalAmount : 0),
        subtotal: totalAmount, // For now assuming no tax/discount calculation separately
        tax: 0,
        discount: 0,
        notes: values.notes,
        items: enrichedItems,
      };

      // Final check for status consistency before submitting
      if (orderData.payment_status === 'unpaid' && orderData.paid_amount > 0) {
         if (orderData.paid_amount >= totalAmount) orderData.payment_status = 'paid';
         else orderData.payment_status = 'partial';
      }
      if (orderData.payment_status === 'paid' && orderData.paid_amount < totalAmount) {
         orderData.payment_status = 'partial';
      }
      if (orderData.payment_status === 'partial' && orderData.paid_amount >= totalAmount) {
         orderData.payment_status = 'paid';
      }
      if (orderData.payment_status === 'partial' && orderData.paid_amount <= 0) {
         orderData.payment_status = 'unpaid';
      }

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
        if (currentDraftId) {
          setDrafts((prev) => prev.filter((d) => d.id !== currentDraftId));
          setCurrentDraftId(null);
        }
        
        // Reset form for next order but keep configuration values
        // This helps when processing multiple orders in a queue
        form.reset({
          branchId: values.branchId,
          customerId: '', // Reset customer
          status: values.status,
          paymentStatus: values.paymentStatus,
          paymentMethod: values.paymentMethod,
          paidAmount: 0,
          notes: '',
          items: [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save order');
    }
  }
  function handleSaveDraft() {
    const values = form.getValues();
    const draftId = currentDraftId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const updatedEntry: OrderDraft = {
      id: draftId,
      createdAt: new Date().toISOString(),
      values,
    };
    setDrafts((prev) => {
      if (currentDraftId) {
        // Replace existing and move to top
        const filtered = prev.filter((d) => d.id !== currentDraftId);
        return [updatedEntry, ...filtered];
      }
      // New draft
      return [updatedEntry, ...prev];
    });
    toast.success(currentDraftId ? 'Draft updated' : 'Draft saved');
    // Reset to new entry for next customer flow
    form.reset({
      branchId: values.branchId,
      customerId: '',
      status: values.status,
      paymentStatus: values.paymentStatus,
      paymentMethod: values.paymentMethod,
      paidAmount: 0,
      notes: '',
      items: [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
    });
    setCurrentDraftId(null);
  }
  function handleLoadDraft(draftId: string) {
    const d = drafts.find((x) => x.id === draftId);
    if (!d) return;
    form.reset(d.values);
    setSelectedBranchId(d.values.branchId || '');
    setCurrentDraftId(draftId);
    toast.success('Draft loaded');
  }
  function handleDeleteDraft(draftId: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    if (currentDraftId === draftId) setCurrentDraftId(null);
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
              <div className="flex gap-2 items-center">
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
                {!isEditing && (
                  <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraftsOpen(true)}
                >
                  Drafts
                  {branchDrafts.length > 0 && (
                    <span className="ml-2">
                      <Badge variant="secondary">{branchDrafts.length}</Badge>
                    </span>
                  )}
                </Button> 
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
                            {isEditing &&<SelectItem value="cancelled">Cancelled</SelectItem>}
                            {isEditing &&<SelectItem value="refunded">Refunded</SelectItem>}
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
                            {isEditing && <SelectItem value="refunded">Refunded</SelectItem>}
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
                
                <div className="mt-4 pt-4 border-t">
                  <Controller
                    control={form.control}
                    name="paidAmount"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={!!fieldState.error}>
                        <FieldLabel>Paid Amount</FieldLabel>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                             const val = parseFloat(e.target.value);
                             field.onChange(val);
                             // Auto-update status based on amount
                             if (!isNaN(val)) {
                                if (val >= totalAmount) {
                                   form.setValue('paymentStatus', 'paid');
                                } else if (val > 0) {
                                   form.setValue('paymentStatus', 'partial');
                                } else {
                                   form.setValue('paymentStatus', 'unpaid');
                                }
                             }
                          }}
                          readOnly={paymentStatus === 'paid'}
                          className={paymentStatus === 'paid' ? 'bg-muted' : 'bg-white/80'}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                  {/* Show arrears/remaining */}
                  {(paidAmount !== undefined && paidAmount < totalAmount) && (
                     <div className="flex justify-between items-center text-sm text-red-600 mt-2">
                       <span>Remaining (Arrears)</span>
                       <span>{formatCurrency(totalAmount - (paidAmount || 0))}</span>
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
              <SheetContent side="right" className="w-full sm:max-w-md p-0">
                <SheetHeader className="flex items-center justify-between border-b p-4">
                  <SheetTitle className="text-lg">Drafts</SheetTitle>
                  <div className="flex gap-2">
                    {branchDrafts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDrafts((prev) =>
                            prev.filter((d) => (d.values.branchId || '') !== (selectedBranchId || ''))
                          );
                          toast.success('All branch drafts cleared');
                          setCurrentDraftId(null);
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDraftsOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </SheetHeader>
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search items"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Input
                      placeholder="Min total"
                      type="number"
                      step="0.01"
                      value={minTotal}
                      onChange={(e) => setMinTotal(e.target.value)}
                      className="w-28"
                    />
                    <Input
                      placeholder="Max total"
                      type="number"
                      step="0.01"
                      value={maxTotal}
                      onChange={(e) => setMaxTotal(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <div>
                    <FieldLabel>Select by date</FieldLabel>
                    <Select
                      onValueChange={(val) => {
                        setDateSelectId(val);
                        handleLoadDraft(val);
                        setDraftsOpen(false);
                      }}
                      value={dateSelectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select draft date" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchDrafts
                          .slice()
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((d) => {
                            const createdDate = new Date(d.createdAt);
                            const rel = formatDistanceToNow(createdDate, { addSuffix: true });
                            const relText =
                              rel === 'in less than a minute' || rel === 'less than a minute ago' ? 'now' : rel;
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                {format(createdDate, 'MMMM dd, yyyy')} • {format(createdDate, 'h:mm a')} • {relText}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    {branchDrafts.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No drafts</div>
                    ) : (
                      branchDrafts
                        .slice()
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .filter((d) => {
                          const sum = d.values.items.reduce(
                            (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
                            0
                          );
                          const minOk =
                            minTotal.trim() === '' ? true : sum >= Number.parseFloat(minTotal || '0');
                          const maxOk =
                            maxTotal.trim() === '' ? true : sum <= Number.parseFloat(maxTotal || `${sum}`);
                          const term = searchTerm.trim().toLowerCase();
                          const termOk =
                            term === ''
                              ? true
                              : d.values.items.some((it) =>
                                  String(it.productName || '').toLowerCase().includes(term)
                                );
                          return minOk && maxOk && termOk;
                        })
                        .map((d) => {
                          const itemsCount = d.values.items.length;
                          const sum = d.values.items.reduce(
                            (acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0),
                            0
                          );
                          const createdDate = new Date(d.createdAt);
                          const rel = formatDistanceToNow(createdDate, { addSuffix: true });
                          const relText =
                            rel === 'in less than a minute' || rel === 'less than a minute ago' ? 'now' : rel;
                          return (
                            <div key={d.id} className="flex items-center justify-between border rounded-md p-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium">Draft • {itemsCount} items</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(createdDate, 'MMMM dd, yyyy')} • {format(createdDate, 'h:mm a')} • {relText}
                                </div>
                                <div className="text-xs font-medium">{formatCurrency(sum)}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleLoadDraft(d.id)}>
                                  <FolderOpen className="h-4 w-4 mr-1" /> Load
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDeleteDraft(d.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/orders')}
              >
                Cancel
              </Button>
              {!isEditing && (
                <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={handleSaveDraft}
                disabled={
                  !Array.isArray(items) ||
                  items.length === 0 ||
                  !items.some((it) => (it.inventoryId || '').trim().length > 0)
                }
              >
                <Save className="h-4 w-4 mr-2" /> Save Draft
              </Button> 
            )}
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
