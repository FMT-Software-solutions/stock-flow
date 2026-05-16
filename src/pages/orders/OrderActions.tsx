import { useState } from 'react';
import type { Order } from '@/types/orders';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Copy, Eye, Edit, Trash, Printer, MessageSquare, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useDeleteOrder } from '@/hooks/useOrders';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrganization } from '@/contexts/OrganizationContext';
import { QuickSmsDialog } from '@/shared-packages/communication/components/sms/QuickSmsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ReceiptDialog } from '@/components/orders/ReceiptDialog';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { AddPaymentDialog } from '@/components/orders/AddPaymentDialog';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface OrderActionsProps {
  order: Order;
}

export function OrderActions({ order }: OrderActionsProps) {
  const navigate = useNavigate();
  const deleteOrder = useDeleteOrder();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { checkPermission } = useRoleCheck();
  const { formatCurrency } = useCurrency();
  const { currentOrganization } = useOrganization();
  const canEdit = checkPermission('orders', 'edit');
  const canDelete = checkPermission('orders', 'delete');
  const canExport = checkPermission('orders', 'export');

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    toast.success('Order number copied to clipboard');
  };

  const totalItemsToRestore = order.items?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
  const shouldShowRestoreNote = totalItemsToRestore > 0 && order.status !== 'cancelled' && order.status !== 'refunded';

  const handleDelete = () => {
    deleteOrder.mutate(order.id, {
      onSuccess: () => {
        toast.success('Order deleted successfully');
        setShowDeleteDialog(false);
      },
      onError: (error) => {
        toast.error('Failed to delete order');
        console.error(error);
      },
    });
  };

  return (
    <div data-no-row-click="true">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleCopyOrderNumber();
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Order No.
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowDetailsModal(true);
            }}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          {canEdit && order.payment_status !== 'paid' && order.payment_status !== 'refunded' && order.status !== 'cancelled' && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowPaymentDialog(true);
              }}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Add Payment
            </DropdownMenuItem>
          )}
          {canExport &&
            order.payment_status !== 'refunded' &&
            order.payment_status !== 'unpaid' && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReceiptDialog(true);
                }}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </DropdownMenuItem>
            )}
          {order.customer && order.customer.phone && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowSmsDialog(true);
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Send SMS
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/orders/${order.id}/edit`);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {canDelete && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <OrderDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        order={order}
      />

      <AddPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        order={order}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will delete the order.
              {shouldShowRestoreNote && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-md text-sm border border-amber-200 dark:border-amber-800">
                  <p className="font-medium mb-1">Stock Restoration</p>
                  <p>
                    <strong>{totalItemsToRestore}</strong> unit{totalItemsToRestore !== 1 ? 's' : ''} of stock will be restored back to inventory upon deletion.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReceiptDialog
        open={showReceiptDialog}
        onOpenChange={(open) => {
          setShowReceiptDialog(open);
        }}
        order={order}
      />

      {order.customer && (
        <QuickSmsDialog
          isOpen={showSmsDialog}
          onOpenChange={setShowSmsDialog}
          recipientName={`${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()}
          recipientPhone={order.customer.phone}
          defaultMessage={`Dear ${order.customer.first_name || 'Customer'}, your order #${order.order_number} for ${formatCurrency(order.total_amount)} has been confirmed by ${currentOrganization?.name || 'us'}. Thank you for your business!`}
          metadata={{ orderId: order.id }}
          context="order_list_action"
          placeholders={{
            c_first_name: order.customer.first_name || 'Customer',
            c_last_name: order.customer.last_name || '',
            order_number: order.order_number,
            order_total: formatCurrency(order.total_amount),
            org_name: currentOrganization?.name || 'us'
          }}
        />
      )}
    </div>
  );
}
