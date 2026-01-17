import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import type { OrderItem } from '@/types/orders';
import { useCurrency } from '@/hooks/useCurrency';

interface OrderItemsCellProps {
  items: OrderItem[];
}

export function OrderItemsCell({ items }: OrderItemsCellProps) {
  const { formatCurrency } = useCurrency();

  if (!items || items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const firstItem = items[0];
  const remainingCount = items.length - 1;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center space-x-2 cursor-pointer">
          <span className="font-medium truncate max-w-37.5">
            {firstItem.product_name}
          </span>
          {remainingCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
              +{remainingCount} more
            </span>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">All Sale Items</h4>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="text-sm">
                <div className="font-medium">{item.product_name}</div>
                <div className="text-muted-foreground text-xs">
                  {(() => {
                    const quantity = Number(item.quantity ?? 0);
                    const unitPrice = Number(item.unit_price ?? 0);
                    const grossTotal = Number(item.total_price ?? 0);
                    const discountAmount = Number(item.discount_amount ?? 0);
                    const netTotalCandidate = grossTotal - discountAmount;
                    const netTotal =
                      discountAmount > 0 && netTotalCandidate >= 0
                        ? netTotalCandidate
                        : grossTotal;
                    const netUnit =
                      quantity > 0 ? netTotal / quantity : unitPrice;

                    return (
                      <>
                        Qty: {quantity} × {formatCurrency(netUnit)} ={' '}
                        {formatCurrency(netTotal)}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
