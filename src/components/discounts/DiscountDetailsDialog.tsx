import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { format } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useDiscountDetails } from '@/hooks/useDiscountDetails';
import { ImagePreview } from '../shared/ImagePreview';
import { Button } from '../ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';
import { UserInfo } from '@/components/shared/UserInfo';
import type { Discount } from '@/types/discounts';

interface DiscountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountId: string;
  discount?: Discount;
}

const targetModeLabel = (
  mode?: 'all' | 'category' | 'product' | 'inventory'
) => {
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

export function DiscountDetailsDialog({
  open,
  onOpenChange,
  discountId,
  discount: initialDiscount,
}: DiscountDetailsDialogProps) {
  const { currentOrganization } = useOrganization();
  const shouldSkipFetch =
    initialDiscount && initialDiscount.targetMode === 'all';
  const { data } = useDiscountDetails(
    shouldSkipFetch ? undefined : currentOrganization?.id,
    shouldSkipFetch ? undefined : discountId
  );
  const { formatCurrency } = useCurrency();
  const { isOwner, checkPermission } = useRoleCheck();
  const { user } = useAuth();

  const discount = initialDiscount ?? (data?.discount || null);
  const inventories = data?.inventories || [];
  const isExpired =
    !!discount?.expiresAt &&
    new Date(discount.expiresAt).getTime() < Date.now();

  const startDate = discount?.startAt
    ? format(new Date(discount.startAt), 'MMMM dd, yyyy')
    : '-';
  const startTime = discount?.startAt
    ? format(new Date(discount.startAt), 'h:mm a')
    : '-';
  const endDate = discount?.expiresAt
    ? format(new Date(discount.expiresAt), 'MMMM dd, yyyy')
    : '-';
  const endTime = discount?.expiresAt
    ? format(new Date(discount.expiresAt), 'h:mm a')
    : '-';
  const canViewCodeGlobal =
    checkPermission('discounts', 'view_code') || isOwner();
  const isCreator =
    discount?.createdBy && user?.id ? discount.createdBy === user.id : false;
  const canViewCode = !!discount?.code && (canViewCodeGlobal || isCreator);

  if (!discount) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Discount Details</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{discount.name}</DialogTitle>
          <div className="text-sm text-muted-foreground flex gap-2">
            <span>{startDate}</span>
            <span>•</span>
            <span>{startTime}</span>
            <span>→</span>
            <span>{endDate}</span>
            <span>•</span>
            <span>{endTime}</span>
          </div>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Code</span>
              <div className="flex items-center gap-1">
                <span
                  className="text-lg font-medium flex-1 truncate"
                  title={discount.code || '-'}
                >
                  {discount.code
                    ? canViewCode
                      ? discount.code
                      : 'Hidden'
                    : '-'}
                </span>
                {discount.code && !isExpired && canViewCode && (
                  <Button
                    variant={'ghost'}
                    className="text-sm text-muted-foreground hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(discount.code || '');
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Type</span>
              <div className="text-lg font-medium">
                {discount.type === 'percentage'
                  ? `${discount.value}%`
                  : formatCurrency(discount.value)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <div>
                {isExpired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : (
                  <Badge variant={discount.isActive ? 'default' : 'secondary'}>
                    {discount.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Targets</span>
              <div className="text-sm">
                {targetModeLabel(discount.targetMode)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Mode</span>
              <div className="text-lg font-medium">
                {(discount.usageMode ?? 'manual') === 'automatic'
                  ? 'Automatic'
                  : 'Manual'}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Usage</span>
              <div className="font-medium">
                {discount.usageLimit != null
                  ? `${discount.timesUsed ?? 0} / ${discount.usageLimit}`
                  : `${discount.timesUsed ?? 0} used`}
              </div>
              <div className="text-xs text-muted-foreground">
                {discount.usageLimit != null
                  ? 'Used / Limit'
                  : 'Unlimited limit'}
              </div>
            </div>
          </div>

          {/* Eligibility */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <div className="text-sm font-semibold mb-2">Eligibility Rules</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Customers</div>
                <div className="text-sm">
                  {Array.isArray(discount.customerIds) &&
                  discount.customerIds.length > 0
                    ? `${discount.customerIds.length} selected`
                    : 'All customers'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Branches</div>
                <div className="text-sm">
                  {Array.isArray(discount.branchIds) &&
                  discount.branchIds.length > 0
                    ? `${discount.branchIds.length} selected`
                    : 'All branches'}
                </div>
              </div>
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UserInfo
              userId={discount.createdBy}
              label="Created By"
              date={
                discount.createdAt ? new Date(discount.createdAt) : undefined
              }
            />
            {discount.updatedBy && (
              <UserInfo
                userId={discount.updatedBy}
                label="Last Updated By"
                date={
                  discount.updatedAt ? new Date(discount.updatedAt) : undefined
                }
              />
            )}
          </div>

          {/* Inventories List */}
          {discount.targetMode !== 'all' && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-3 text-xs font-medium uppercase tracking-wider grid grid-cols-12 gap-4">
                <div className="col-span-6">Inventory</div>
                <div className="col-span-3">Branch</div>
                <div className="col-span-3 text-right">Qty</div>
              </div>

              <div className="divide-y max-h-75 overflow-y-auto">
                {inventories.map((inv) => {
                  const name = inv.variant_id
                    ? `${inv.product_name} (${Object.entries(
                        inv.variant_attributes || {}
                      )
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')})`
                    : inv.custom_label
                    ? `${inv.product_name} (${inv.custom_label})`
                    : inv.product_name;

                  const imageUrl = inv.image_url || inv.product_image;

                  return (
                    <div
                      key={inv.id}
                      className="grid grid-cols-12 gap-4 items-center p-3 text-sm"
                    >
                      <div className="col-span-6 flex items-center gap-1">
                        {imageUrl && (
                          <ImagePreview
                            src={imageUrl}
                            alt={inv.product_name}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium flex gap-1">{name}</div>
                          <div className="text-muted-foreground text-xs">
                            {inv.product_sku || inv.variant_sku || '-'}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3">{inv.branch_name || '-'}</div>
                      <div className="col-span-3 text-right">
                        {Number(inv.quantity ?? 0)}
                      </div>
                    </div>
                  );
                })}
                {inventories.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    No inventory found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
