import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Order } from '@/types/orders';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { User } from 'lucide-react';

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

function UserInfo({
  userId,
  label,
}: {
  userId?: string | null;
  label: string;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  if (!userId) return null;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="h-5 w-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {label}
        </span>
        <span className="text-sm font-medium">
          {isLoading
            ? 'Loading...'
            : profile
            ? `${profile.first_name} ${profile.last_name}`
            : 'Unknown User'}
        </span>
      </div>
    </div>
  );
}

export function OrderDetailsModal({
  open,
  onOpenChange,
  order,
}: OrderDetailsModalProps) {
  const { formatCurrency } = useCurrency();

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Order #{order.order_number}
          </DialogTitle>
          <div className="text-sm text-muted-foreground flex gap-2">
            <span>{format(new Date(order.date), 'MMMM dd, yyyy')}</span>
            <span>•</span>
            <span>{format(new Date(order.date), 'h:mm a')}</span>
          </div>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Order Status
              </span>
              <div>
                <Badge
                  variant={
                    order.status === 'completed' ? 'default' : 'secondary'
                  }
                  className="capitalize"
                >
                  {order.status}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Payment Status
              </span>
              <div>
                <Badge
                  variant={
                    order.payment_status === 'paid' ? 'outline' : 'destructive'
                  }
                  className="capitalize"
                >
                  {order.payment_status}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Branch</span>
              <div className="font-medium text-sm">
                {order.branch?.name || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Customer</span>
              <div className="font-medium text-sm">
                {order.customer
                  ? `${order.customer.first_name} ${order.customer.last_name}`
                  : 'Walk-in Customer'}
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 text-xs font-medium uppercase tracking-wider grid grid-cols-12 gap-4">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            <div className="divide-y max-h-75 overflow-y-auto">
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className="p-3 text-sm grid grid-cols-12 gap-4 items-center hover:bg-muted/20"
                >
                  <div className="col-span-6 font-medium">
                    {item.product_name}
                    {item.sku && (
                      <div className="text-xs text-muted-foreground font-normal">
                        {item.sku}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">
                    {formatCurrency(item.unit_price)}
                  </div>
                  <div className="col-span-2 text-right">{item.quantity}</div>
                  <div className="col-span-2 text-right font-medium">
                    {formatCurrency(item.total_price)}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/20 p-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UserInfo userId={order.created_by} label="Created By" />
            {order.updated_by && order.updated_by !== order.created_by && (
              <UserInfo userId={order.updated_by} label="Last Updated By" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
