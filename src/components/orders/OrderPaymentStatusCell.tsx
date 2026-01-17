import { useState } from 'react';
import type { Order, PaymentStatus } from '@/types/orders';
import { useUpdateOrder } from '@/hooks/useOrders';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface OrderPaymentStatusCellProps {
  order: Order;
}

export function OrderPaymentStatusCell({ order }: OrderPaymentStatusCellProps) {
  const updateOrder = useUpdateOrder();
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const [partialAmount, setPartialAmount] = useState<number>(
    order.paid_amount || 0
  );
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const getStyles = (status: string) => {
    let className = 'bg-gray-100 text-gray-800 border-gray-200';
    if (status === 'paid')
      className = 'bg-green-100 text-green-800 border-green-200';
    if (status === 'partial')
      className = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (status === 'unpaid')
      className = 'bg-red-100 text-red-800 border-red-200';
    if (status === 'refunded')
      className = 'bg-purple-100 text-purple-800 border-purple-200';
    return className;
  };

  const handleUpdate = async (newStatus: string) => {
    if (newStatus === order.payment_status) return;

    if (newStatus === 'partial') {
      setPendingStatus(newStatus);
      setPartialAmount(order.paid_amount || 0);
      setShowPartialDialog(true);
      return;
    }

    let newPaidAmount = order.paid_amount;
    if (newStatus === 'paid') {
      newPaidAmount = order.total_amount;
    } else if (newStatus === 'unpaid' || newStatus === 'refunded') {
      newPaidAmount = 0;
    }

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        payment_status: newStatus as PaymentStatus,
        paid_amount: newPaidAmount,
        ...(newStatus === 'refunded' ? { status: 'refunded' } : {}),
      });
      toast.success(`Payment status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update payment status');
      console.error(error);
    }
  };

  const confirmPartialUpdate = async () => {
    if (!pendingStatus) return;

    // Validation
    if (partialAmount <= 0) {
      toast.error('Partial amount must be greater than 0');
      return;
    }
    if (partialAmount >= order.total_amount) {
      // If they enter full amount, should we switch to 'paid'?
      // User requested: "if status changed to unpaid or refunded, it should set paid amount to zero automatically."
      // "If we update from other status to partial, we should let user enter paid amount in a popup."
      // "Make sure all edge cases are handled."
      // It's safer to just set it to 'paid' if they enter full amount, or warn them.
      // Let's switch to 'paid' automatically for better UX
      try {
        await updateOrder.mutateAsync({
          id: order.id,
          payment_status: 'paid',
          paid_amount: order.total_amount,
        });
        toast.success('Amount covers total, status set to Paid');
        setShowPartialDialog(false);
        return;
      } catch (error) {
        toast.error('Failed to update');
        return;
      }
    }

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        payment_status: 'partial',
        paid_amount: partialAmount,
      });
      toast.success(`Payment status updated to Partial`);
      setShowPartialDialog(false);
    } catch (error) {
      toast.error('Failed to update payment status');
      console.error(error);
    }
  };

  return (
    <>
      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
        <Select
          defaultValue={order.payment_status}
          onValueChange={handleUpdate}
          disabled={updateOrder.isPending}
        >
          <SelectTrigger className="h-8 w-22.5 border-none bg-transparent p-0 focus:ring-0 shadow-none data-[state=open]:bg-transparent [&>svg]:hidden">
            <span
              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize w-full cursor-pointer hover:opacity-80 ${getStyles(
                order.payment_status
              )}`}
            >
              {updateOrder.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                order.payment_status
              )}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Partial Payment Amount</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Paid Amount</label>
              <Input
                type="number"
                value={partialAmount}
                onChange={(e) => setPartialAmount(parseFloat(e.target.value))}
                max={order.total_amount}
              />
              <p className="text-xs text-muted-foreground">
                Total Order Amount: {order.total_amount}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPartialDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPartialUpdate}
              disabled={updateOrder.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
