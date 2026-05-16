import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '@/types/orders';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';

function ClickableOrder({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-xs font-mono font-medium text-primary hover:underline cursor-pointer"
        onClick={() => setOpen(true)}
      >
        #{order.order_number}
      </button>
      <OrderDetailsModal open={open} onOpenChange={setOpen} order={order} />
    </>
  );
}

export function RecentPaymentsList({ orders, formatCurrency }: { orders: Order[], formatCurrency: (val: number) => string }) {
  const allPayments = orders.flatMap(o =>
    (o.payments || []).map(p => ({ ...p, order: o }))
  );

  if (allPayments.length === 0) return null;

  allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const topPayments = allPayments.slice(0, 3);

  return (
    <div className="mt-2 flex flex-col gap-3 w-full">
      <div className="text-xs font-medium text-muted-foreground border-b pb-1">Latest payment history</div>
      <div className="flex flex-col gap-2.5">
        {topPayments.map(p => {
          const customer = p.order.customer;
          const customerName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest' : 'Walk-in Customer';

          return (
            <div key={p.id} className="flex flex-col gap-0.5 pl-2 border-l-2 border-primary/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">{formatCurrency(p.amount)}</span>
                <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground truncate max-w-[130px]">{customerName}</span>
                <ClickableOrder order={p.order} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
