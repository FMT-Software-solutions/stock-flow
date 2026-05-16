import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { useAddOrderPayment } from '@/hooks/useOrders';
import { toast } from 'sonner';
import type { Order } from '@/types/orders';
import { useCurrency } from '@/hooks/useCurrency';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPaymentDialog({ order, open, onOpenChange }: AddPaymentDialogProps) {
  const addPayment = useAddOrderPayment();
  const { formatCurrency } = useCurrency();
  const arrears = Math.max(0, (order.total_amount || 0) - (order.paid_amount || 0));

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      amount: arrears,
      paymentMethod: 'cash',
      notes: '',
    },
  });

  const onSubmit = async (values: PaymentFormValues) => {
    if (values.amount > arrears) {
      toast.error(`Amount cannot exceed the due amount of ${formatCurrency(arrears)}`);
      return;
    }

    try {
      await addPayment.mutateAsync({
        orderId: order.id,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
      });
      toast.success('Payment added successfully');
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment');
    }
  };

  // Reset form when dialog opens with latest arrears
  useEffect(() => {
    if (open) {
      form.setValue('amount', arrears);
    }
  }, [open, arrears, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>
            Record a partial or full payment for order #{order.order_number}.
            <br />
            <span className="font-medium text-foreground mt-2 inline-block">
              Amount Due: {formatCurrency(arrears)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel>Amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={arrears}
                  placeholder="Enter amount"
                  {...field}
                />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="paymentMethod"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel>Payment Method</FieldLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <Field>
                <FieldLabel>Notes (Optional)</FieldLabel>
                <Textarea
                  placeholder="Add any payment notes or reference numbers..."
                  {...field}
                />
              </Field>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addPayment.isPending}>
              {addPayment.isPending ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
