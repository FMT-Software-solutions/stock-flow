import type { Order, OrderStatus } from '@/types/orders';
import { useUpdateOrder } from '@/hooks/useOrders';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getOrderStatusVariant } from '@/lib/utils';

interface OrderStatusCellProps {
  order: Order;
}

export function OrderStatusCell({ order }: OrderStatusCellProps) {
  const updateOrder = useUpdateOrder();

  const handleUpdate = async (newStatus: string) => {
    if (newStatus === order.status) return;

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        status: newStatus as OrderStatus,
      });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
      console.error(error);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
      <Select
        defaultValue={order.status}
        onValueChange={handleUpdate}
        disabled={updateOrder.isPending}
      >
        <SelectTrigger className="h-8 w-27.5 border-none bg-transparent p-0 focus:ring-0 shadow-none data-[state=open]:bg-transparent [&>svg]:hidden">
          <Badge
            variant={getOrderStatusVariant(order.status)}
            className="w-full justify-center capitalize cursor-pointer hover:opacity-80"
          >
            {updateOrder.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              order.status
            )}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
