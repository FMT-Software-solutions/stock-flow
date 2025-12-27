import type { Order, PaymentStatus } from '@/types/orders';
import { useUpdateOrder } from '@/hooks/useOrders';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface OrderPaymentStatusCellProps {
  order: Order;
}

export function OrderPaymentStatusCell({ order }: OrderPaymentStatusCellProps) {
  const updateOrder = useUpdateOrder();

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

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        payment_status: newStatus as PaymentStatus,
      });
      toast.success(`Payment status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update payment status');
      console.error(error);
    }
  };

  return (
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
  );
}
