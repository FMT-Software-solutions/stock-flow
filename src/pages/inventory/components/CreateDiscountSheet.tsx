import { useEffect, useMemo, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { DatePicker } from '@/components/shared/DatePicker';
import { TimePicker } from '@/components/shared/TimePicker';
import { discountFormSchema, type DiscountFormValues } from '../form-schema/discount-form-schema';
import { MASKED_CODE, useSaveDiscount } from '@/hooks/useDiscountQueries';
import { useCategories, useProducts } from '@/hooks/useInventoryQueries';
import { useOrganizationVariants } from '@/hooks/useSellableProducts';
import { useCustomers } from '@/hooks/useCustomerQueries';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { Discount, DiscountTargetRef } from '@/types/discounts';

interface CreateDiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  discount?: Discount;
}

const toDate = (iso?: string | null) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '');
const toTime = (iso?: string | null, fallback = '') => (iso ? format(new Date(iso), 'HH:mm') : fallback);
const toStr = (n?: number | null) => (n === null || n === undefined ? '' : String(n));

function targetKey(t: DiscountTargetRef) {
  if (t.categoryId) return t.categoryId;
  return t.variantId ? `${t.productId}:${t.variantId}` : (t.productId as string);
}

function defaultsFor(discount?: Discount): DiscountFormValues {
  return {
    name: discount?.name ?? '',
    method: discount?.method ?? 'automatic',
    code: discount?.code ?? '',
    target: discount?.target ?? 'items',
    valueType: discount?.valueType ?? 'percentage',
    value: discount?.value ?? 0,
    oncePerOrder: discount?.oncePerOrder ?? false,
    appliesTo: discount?.appliesTo ?? 'all',
    targetIds: (discount?.targets ?? []).map(targetKey),
    minSubtotal: toStr(discount?.minSubtotal),
    minQuantity: toStr(discount?.minQuantity),
    branchIds: discount?.branchIds ?? [],
    customerIds: discount?.customerIds ?? [],
    usageLimit: toStr(discount?.usageLimit),
    usageLimitPerCustomer: toStr(discount?.usageLimitPerCustomer),
    combinable: discount?.combinable ?? false,
    startDate: toDate(discount?.startsAt),
    startTime: toTime(discount?.startsAt, '00:00'),
    endDate: toDate(discount?.endsAt),
    endTime: toTime(discount?.endsAt, '23:59'),
  };
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Multi({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  groupBy,
}: {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  groupBy?: string;
}) {
  return (
    <MultipleSelector
      value={options.filter((o) => value.includes(o.value))}
      defaultOptions={options}
      options={options}
      groupBy={groupBy}
      triggerSearchOnFocus
      onSearchSync={(term: string) => {
        const t = term?.toLowerCase() ?? '';
        return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
      }}
      onChange={(selected: Option[]) => onChange(selected.map((o) => o.value))}
      placeholder={placeholder}
      disabled={disabled}
      hidePlaceholderWhenSelected
      emptyIndicator={<p className="text-center text-sm text-muted-foreground">No results</p>}
    />
  );
}

export function CreateDiscountSheet({ open, onOpenChange, onSuccess, discount }: CreateDiscountSheetProps) {
  const { currentOrganization } = useOrganization();
  const { availableBranches, isOwner } = useBranchContext();
  const orgId = currentOrganization?.id;
  const { data: categories = [] } = useCategories(orgId);
  const { data: products = [] } = useProducts(orgId);
  const { data: variants = [] } = useOrganizationVariants(orgId);
  const { data: customers = [] } = useCustomers(orgId);
  const saveDiscount = useSaveDiscount();
  const isEditing = !!discount;

  const form = useForm<DiscountFormValues>({
    resolver: zodResolver(discountFormSchema) as Resolver<DiscountFormValues>,
    defaultValues: defaultsFor(discount),
  });

  useEffect(() => {
    if (open) form.reset(defaultsFor(discount));
  }, [open, discount, form]);

  const [method, target, valueType, appliesTo] = useWatch({
    control: form.control,
    name: ['method', 'target', 'valueType', 'appliesTo'],
  });

  useEffect(() => {
    if (target === 'order' && valueType === 'fixed_price') form.setValue('valueType', 'percentage');
  }, [target, valueType, form]);

  const categoryOptions = useMemo<Option[]>(() => categories.map((c) => ({ label: c.name, value: c.id })), [categories]);

  // A product, or one of its variants
  const productOptions = useMemo<Option[]>(() => {
    const out: Option[] = [];
    for (const p of products) {
      out.push({ label: p.name, value: p.id, group: p.name });
      for (const v of variants.filter((x) => x.product_id === p.id)) {
        const attrs = Object.values(v.attributes ?? {}).join(' / ');
        out.push({ label: `${p.name} (${attrs || v.sku || 'variant'})`, value: `${p.id}:${v.id}`, group: p.name });
      }
    }
    return out;
  }, [products, variants]);

  const branchOptions = useMemo<Option[]>(
    () => availableBranches.map((b) => ({ label: b.name, value: b.id })),
    [availableBranches]
  );
  const customerOptions = useMemo<Option[]>(
    () =>
      customers.map((c) => ({
        label: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.phone || 'Customer',
        value: c.id,
      })),
    [customers]
  );

  const combine = (date?: string, time?: string, fallback = '00:00') =>
    date ? new Date(`${date}T${time || fallback}:00`).toISOString() : null;

  const onSubmit = (values: DiscountFormValues) => {
    if (!orgId) return;
    const targets: DiscountTargetRef[] =
      values.target === 'order' || values.appliesTo === 'all'
        ? []
        : values.appliesTo === 'categories'
          ? values.targetIds.map((id) => ({ categoryId: id }))
          : values.targetIds.map((key) => {
              const [productId, variantId] = key.split(':');
              return { productId, variantId: variantId || null };
            });

    // Staff limited to some branches create discounts for those branches.
    const branchIds =
      !isOwner && values.branchIds.length === 0 ? availableBranches.map((b) => b.id) : values.branchIds;

    saveDiscount.mutate(
      {
        organizationId: orgId,
        discount: {
          id: discount?.id,
          name: values.name.trim(),
          method: values.method,
          code: values.method === 'code' ? values.code?.trim() : null,
          target: values.target,
          valueType: values.valueType,
          value: values.value,
          oncePerOrder: values.target === 'items' && values.valueType === 'fixed_amount' && values.oncePerOrder,
          appliesTo: values.target === 'order' ? 'all' : values.appliesTo,
          targets,
          minSubtotal: values.minSubtotal ? Number(values.minSubtotal) : null,
          minQuantity: values.minQuantity ? Number(values.minQuantity) : null,
          branchIds,
          customerIds: values.customerIds,
          usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
          usageLimitPerCustomer: values.usageLimitPerCustomer ? Number(values.usageLimitPerCustomer) : null,
          combinable: values.combinable,
          startsAt: combine(values.startDate, values.startTime, '00:00'),
          endsAt: combine(values.endDate, values.endTime, '23:59'),
        },
      },
      {
        onSuccess: () => {
          toast.success(isEditing ? 'Discount updated' : 'Discount created');
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => toast.error(error.message || 'Failed to save discount'),
      }
    );
  };

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{isEditing ? 'Edit Discount' : 'Create Discount'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel>Name</FieldLabel>
            <Input {...form.register('name')} placeholder="e.g. Weekend sale" />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className="flex items-center gap-1">
                Method
                <Hint>Automatic discounts apply by themselves at the till. Code discounts apply when the cashier enters the code.</Hint>
              </FieldLabel>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {method === 'code' && (
              <Field data-invalid={!!errors.code}>
                <FieldLabel>Code</FieldLabel>
                <Input
                  {...form.register('code')}
                  className="font-mono"
                  placeholder="SAVE10"
                  readOnly={discount?.code === MASKED_CODE}
                />
                {errors.code && <FieldError>{errors.code.message}</FieldError>}
              </Field>
            )}
          </div>

          <Section title="Discount">
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel className="flex items-center gap-1">
                  On
                  <Hint>Items: discounts the eligible lines. Whole sale: discounts the sale subtotal.</Hint>
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="items">Items</SelectItem>
                        <SelectItem value="order">Whole sale</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.valueType}>
                <FieldLabel className="flex items-center gap-1">
                  Type
                  <Hint>Fixed price sells each eligible item at the value.</Hint>
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="valueType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">% off</SelectItem>
                        <SelectItem value="fixed_amount">Amount off</SelectItem>
                        {target === 'items' && <SelectItem value="fixed_price">Fixed price</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.value}>
                <FieldLabel>{valueType === 'percentage' ? 'Percent' : valueType === 'fixed_price' ? 'Price' : 'Amount'}</FieldLabel>
                <Input type="number" step="0.01" min={0} {...form.register('value')} />
                {errors.value && <FieldError>{errors.value.message}</FieldError>}
              </Field>
            </div>
            {target === 'items' && valueType === 'fixed_amount' && (
              <Controller
                control={form.control}
                name="oncePerOrder"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    Once per sale
                    <Hint>Off: the amount comes off every eligible item. On: once per sale, shared across eligible items.</Hint>
                  </label>
                )}
              />
            )}
          </Section>

          {target === 'items' && (
            <Section title="Applies to">
              <Controller
                control={form.control}
                name="appliesTo"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      // Radix can re-emit the current value when the form resets
                      if (!v || v === field.value) return;
                      field.onChange(v);
                      form.setValue('targetIds', []);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All products</SelectItem>
                      <SelectItem value="categories">Categories</SelectItem>
                      <SelectItem value="products">Products</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {appliesTo !== 'all' && (
                <Field data-invalid={!!errors.targetIds}>
                  <Controller
                    control={form.control}
                    name="targetIds"
                    render={({ field }) => (
                      <Multi
                        key={appliesTo}
                        options={appliesTo === 'categories' ? categoryOptions : productOptions}
                        groupBy={appliesTo === 'products' ? 'group' : undefined}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={appliesTo === 'categories' ? 'Pick categories' : 'Pick products or variants'}
                      />
                    )}
                  />
                  {errors.targetIds && <FieldError>{errors.targetIds.message}</FieldError>}
                </Field>
              )}
            </Section>
          )}

          <Section title="Requirements">
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.minSubtotal}>
                <FieldLabel className="flex items-center gap-1">
                  Minimum spend
                  <Hint>{target === 'order' ? 'Sale subtotal before discounts.' : 'Total of the eligible items before discounts.'}</Hint>
                </FieldLabel>
                <Input type="number" step="0.01" min={0} placeholder="None" {...form.register('minSubtotal')} />
                {errors.minSubtotal && <FieldError>{errors.minSubtotal.message}</FieldError>}
              </Field>
              <Field data-invalid={!!errors.minQuantity}>
                <FieldLabel>Minimum items</FieldLabel>
                <Input type="number" min={0} placeholder="None" {...form.register('minQuantity')} />
                {errors.minQuantity && <FieldError>{errors.minQuantity.message}</FieldError>}
              </Field>
            </div>
            <Field>
              <FieldLabel>Branches</FieldLabel>
              <Controller
                control={form.control}
                name="branchIds"
                render={({ field }) => (
                  <Multi
                    options={branchOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={isOwner ? 'All branches' : 'All my branches'}
                  />
                )}
              />
            </Field>
            <Field>
              <FieldLabel className="flex items-center gap-1">
                Customers
                <Hint>When set, the sale needs one of these customers selected.</Hint>
              </FieldLabel>
              <Controller
                control={form.control}
                name="customerIds"
                render={({ field }) => (
                  <Multi options={customerOptions} value={field.value} onChange={field.onChange} placeholder="Anyone" />
                )}
              />
            </Field>
          </Section>

          <Section title="Limits">
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.usageLimit}>
                <FieldLabel className="flex items-center gap-1">
                  Total uses
                  <Hint>Sales that can use it. Deleting a sale gives its use back.</Hint>
                </FieldLabel>
                <Input type="number" min={1} placeholder="Unlimited" {...form.register('usageLimit')} />
                {errors.usageLimit && <FieldError>{errors.usageLimit.message}</FieldError>}
              </Field>
              <Field data-invalid={!!errors.usageLimitPerCustomer}>
                <FieldLabel className="flex items-center gap-1">
                  Per customer
                  <Hint>When set, the sale needs a customer selected.</Hint>
                </FieldLabel>
                <Input type="number" min={1} placeholder="Unlimited" {...form.register('usageLimitPerCustomer')} />
                {errors.usageLimitPerCustomer && <FieldError>{errors.usageLimitPerCustomer.message}</FieldError>}
              </Field>
            </div>
            <Controller
              control={form.control}
              name="combinable"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  Combines with other discounts
                  <Hint>
                    Each item gets at most one item discount and each sale at most one sale discount. Item and sale
                    discounts only stack when both combine; otherwise the bigger saving wins.
                  </Hint>
                </label>
              )}
            />
          </Section>

          <Section title="Schedule">
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    label="Starts"
                    placeholder="Now"
                    date={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                    setDate={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="startTime"
                render={({ field }) => <TimePicker label="Time" value={field.value} onChange={field.onChange} />}
              />
              <Field data-invalid={!!errors.endDate}>
                <Controller
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      label="Ends"
                      placeholder="Never"
                      date={field.value ? new Date(`${field.value}T00:00:00`) : undefined}
                      setDate={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')}
                    />
                  )}
                />
                {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
              </Field>
              <Controller
                control={form.control}
                name="endTime"
                render={({ field }) => <TimePicker label="Time" value={field.value} onChange={field.onChange} />}
              />
            </div>
          </Section>

          <SheetFooter className="flex-row justify-end gap-2 p-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveDiscount.isPending}>
              {saveDiscount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
