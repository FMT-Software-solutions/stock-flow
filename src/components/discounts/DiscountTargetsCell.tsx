import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import type { Discount } from '@/types/discounts';
import { Badge } from '@/components/ui/badge';

interface DiscountTargetsCellProps {
  discount: Discount;
}

const targetModeLabel = (mode?: Discount['targetMode']) => {
  switch (mode) {
    case 'all':
      return 'All Inventory (Storewide)';
    case 'category':
      return 'Specific Categories';
    case 'product':
      return 'Specific Products';
    case 'inventory':
      return 'Specific Inventory Items';
    default:
      return '-';
  }
};

export function DiscountTargetsCell({ discount }: DiscountTargetsCellProps) {
  const hasCustomers =
    Array.isArray(discount.customerIds) && discount.customerIds.length > 0;
  const hasBranches =
    Array.isArray(discount.branchIds) && discount.branchIds.length > 0;

  const modeText = targetModeLabel(discount.targetMode);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer">
          <Badge variant="outline">{modeText}</Badge>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Targets</div>
            <div className="text-sm text-muted-foreground">{modeText}</div>
          </div>

          <div>
            <div className="text-sm font-semibold">Eligibility Rules</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Customers:{' '}
                {hasCustomers
                  ? `${discount.customerIds?.length ?? 0} selected`
                  : 'All customers'}
              </div>
              <div>
                Branches:{' '}
                {hasBranches
                  ? `${discount.branchIds?.length ?? 0} selected`
                  : 'All branches'}
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
