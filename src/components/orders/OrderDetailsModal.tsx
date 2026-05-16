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
import { Button } from '@/components/ui/button';
import { UserInfo } from '@/components/shared/UserInfo';
import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { AddPaymentDialog } from '@/components/orders/AddPaymentDialog';

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

export function OrderDetailsModal({
  open,
  onOpenChange,
  order,
}: OrderDetailsModalProps) {
  const { formatCurrency } = useCurrency();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const paidAmount = Number(order.paid_amount ?? 0);
  const totalAmount = Number(order.total_amount ?? 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''
      }`.trim() ||
    order.customer.name ||
    'Customer'
    : 'Walk-in Customer';
  const getPaymentStatusStyles = (status: string) => {
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

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-auto">
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
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`capitalize ${getPaymentStatusStyles(order.payment_status)}`}
                >
                  {order.payment_status}
                </Badge>
                {order.payment_status === 'partial' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-yellow-100 text-yellow-700"
                    title="Add Payment"
                    onClick={() => setShowPaymentDialog(true)}
                  >
                    <Banknote className="h-4 w-4" />
                  </Button>
                )}
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
              <div className="font-medium text-sm">{customerName}</div>
              {(order.customer?.phone || order.customer?.email) && (
                <div className="text-xs text-muted-foreground">
                  {order.customer?.phone || order.customer?.email}
                </div>
              )}
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
                      return formatCurrency(netUnit);
                    })()}
                  </div>
                  <div className="col-span-2 text-right">{item.quantity}</div>
                  <div className="col-span-2 text-right font-medium">
                    {(() => {
                      const grossTotal = Number(item.total_price ?? 0);
                      const discountAmount = Number(item.discount_amount ?? 0);
                      const netTotalCandidate = grossTotal - discountAmount;
                      const netTotal =
                        discountAmount > 0 && netTotalCandidate >= 0
                          ? netTotalCandidate
                          : grossTotal;
                      return formatCurrency(netTotal);
                    })()}
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
              <div className="flex justify-between text-sm">
                <span>Paid</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Remaining</span>
                <span
                  className={
                    remainingAmount > 0 ? 'text-red-600 font-medium' : ''
                  }
                >
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {order.payments && order.payments.length > 0 && (
            <div className="border rounded-lg overflow-hidden mt-2">
              <div className="bg-muted/50 p-3 text-xs font-medium uppercase tracking-wider">
                Payment History
              </div>
              <div className="divide-y max-h-40 overflow-y-auto">
                {order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-3 text-sm flex justify-between items-center hover:bg-muted/20"
                  >
                    <div>
                      <div className="font-medium">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span className="capitalize">
                          {payment.payment_method?.replace('_', ' ') || 'Unknown'}
                        </span>
                        {payment.notes && (
                          <>
                            <span>•</span>
                            <span className="italic">{payment.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'MMM dd, yyyy h:mm a')}
                      </div>
                      {payment.creator && (
                        <div className="text-xs text-muted-foreground">
                          by {payment.creator.first_name} {payment.creator.last_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UserInfo
              userId={order.created_by}
              label="Created By"
              date={new Date(order.created_at)}
            />

            {order.updated_by && (
              <UserInfo
                userId={order.updated_by}
                label="Last Updated By"
                date={new Date(order.updated_at)}
              />
            )}
          </div>
        </div>
      </DialogContent>
      <AddPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        order={order}
      />
    </Dialog>
  );
}
