import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCustomer } from '@/hooks/useCustomerQueries';
import { useCustomerOrders } from '@/hooks/useOrders';
import { DataTable } from '@/components/shared/data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { Order } from '@/types/orders';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { format, formatDistanceToNow } from 'date-fns';
import { isDateInRange } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { OrderItemsCell } from '@/components/orders/OrderItemsCell';
import { Badge } from '@/components/ui/badge';
import { getOrderStatusVariant } from '@/lib/utils';
import { customerOrderExportFields } from '../orders/fields';
import { getCustomerOrderFilterFields } from './fields';
import { useBranchContext } from '@/contexts/BranchContext';
import { useMemo, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedBranchIds } = useBranchContext();
  const { currentOrganization } = useOrganization();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { data: customer, isLoading: isLoadingCustomer } = useCustomer(id);
  const { data: orders = [] } = useCustomerOrders(
    id,
    currentOrganization?.id,
    selectedBranchIds
  );
  const { checkPermission } = useRoleCheck();
  const canExportOrders = checkPermission('orders', 'export');

  const filterFields = useMemo(() => {
    const branches = Array.from(
      new Set(
        orders
          .map((o) => o.branch?.name)
          .filter((name): name is string => !!name)
      )
    ).map((name) => ({
      label: name,
      value: name,
    }));

    const paymentMethods = Array.from(
      new Set(orders.map((o) => o.payment_method).filter(Boolean))
    ).map((pm) => {
      const v = pm as string;
      const label = v
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return { label, value: v };
    });

    return getCustomerOrderFilterFields(branches, paymentMethods);
  }, [orders]);

  function OrderNumberCell({ order }: { order: Order }) {
    return (
      <button
        type="button"
        data-row-click="true"
        className="font-mono font-medium text-primary hover:underline"
        title={`View details for order #${order.order_number}`}
      >
        {order.order_number}
      </button>
    );
  }

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'order_number',
      id: 'orderNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order #" />
      ),
      cell: ({ row }) => <OrderNumberCell order={row.original} />,
    },
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order Date" />
      ),
      cell: ({ row }) =>
        format(new Date(row.getValue('date')), 'MMMM dd, yyyy h:mm a'),
      filterFn: (row, id, value) => {
        return isDateInRange(row.getValue(id), value);
      },
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => <OrderItemsCell items={row.original.items || []} />,
    },
    {
      accessorKey: 'total_amount',
      id: 'totalAmount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => {
        const val = row.getValue('totalAmount') as number | string;
        const amount = typeof val === 'string' ? parseFloat(val) : val ?? 0;
        return <CurrencyDisplay amount={isNaN(amount) ? 0 : amount} />;
      },
    },
    {
      id: 'branchName',
      accessorFn: (row) => row.branch?.name,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Branch" />
      ),
      cell: ({ row }) => {
        const branch = row.original.branch;
        return branch ? branch.name : '-';
      },
      filterFn: (row, id, value) => {
        // Simple filter for now, usually handled by server or strict equality
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'payment_method',
      id: 'paymentMethod',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payment Method" />
      ),
      cell: ({ row }) => {
        const method = row.getValue('paymentMethod') as string | undefined;
        const label = method
          ? method
              .split('_')
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ')
          : '-';
        return label;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={getOrderStatusVariant(row.getValue('status'))}
          className="capitalize"
        >
          {row.getValue('status')}
        </Badge>
      ),
    },
    {
      accessorKey: 'payment_status',
      id: 'paymentStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payment Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('paymentStatus') as string;
        return status ? status.replace('_', ' ').toUpperCase() : '-';
      },
    },
  ];

  if (isLoadingCustomer) {
    return <div className="p-8">Loading...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-muted">Customer not found</div>;
  }

  const totalOrdersCount = orders.length;
  const completedRevenue = orders.reduce((sum, order) => {
    const status = String(order.status || '').toLowerCase();
    if (status !== 'completed') return sum;
    const val = (order.total_amount as unknown) as number | string | undefined;
    const amount = typeof val === 'string' ? parseFloat(val) : val ?? 0;
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const lastOrderTimestamp = orders.length
    ? Math.max(
        ...orders
          .map((o) => new Date(o.date).getTime())
          .filter((t) => !Number.isNaN(t))
      )
    : null;
  const lastOrderDate =
    lastOrderTimestamp !== null ? new Date(lastOrderTimestamp) : null;
  const lastOrderDateFormatted = lastOrderDate
    ? format(lastOrderDate, 'MMMM dd, yyyy')
    : '-';
  const lastOrderRelative = lastOrderDate
    ? (() => {
        const rel = formatDistanceToNow(lastOrderDate, { addSuffix: true });
        return rel === 'in less than a minute' ||
          rel === 'less than a minute ago'
          ? 'now'
          : rel;
      })()
    : '-';

  const statusCounts = orders.reduce(
    (acc, o) => {
      const s = String(o.status || '').toLowerCase();
      if (s === 'pending' || s === 'processing') acc.pendingProcessing += 1;
      else if (s === 'completed') acc.completed += 1;
      else if (s === 'cancelled' || s === 'canceled' || s === 'refunded')
        acc.cancelledRefunded += 1;
      return acc;
    },
    { pendingProcessing: 0, completed: 0, cancelledRefunded: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate('/customers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.email || customer.phone || '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="text-lg font-medium">
                {customer.firstName} {customer.lastName}
              </span>
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{customer.email || '-'}</span>
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{customer.phone || '-'}</span>

              <span className="text-muted-foreground">Orders</span>
              <span className="font-medium">{customer.totalOrders || 0}</span>
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-medium">
                <CurrencyDisplay amount={completedRevenue || 0} />
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Customer Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Orders
                </p>
                <div className="text-xl font-bold">{totalOrdersCount}</div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <div className="text-xl font-bold">
                  <CurrencyDisplay amount={completedRevenue} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed orders only
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Last Order
                </p>
                <div className="text-lg font-medium">
                  {lastOrderDateFormatted}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastOrderRelative}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Pending / Processing
                </p>
                <div className="text-xl font-bold">
                  {statusCounts.pendingProcessing}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <div className="text-xl font-bold">
                  {statusCounts.completed}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Cancelled / Refunded
                </p>
                <div className="text-xl font-bold">
                  {statusCounts.cancelledRefunded}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Order History</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={orders}
              searchKey="orderNumber"
              storageKey={`customer-orders-${customer.id}`}
              exportFields={customerOrderExportFields}
              filterFields={filterFields}
              canExport={canExportOrders}
              onRowClick={(order) => {
                setSelectedOrder(order as Order);
                setDetailsOpen(true);
              }}
            />
          </CardContent>
        </Card>
      </div>
      {selectedOrder && (
        <OrderDetailsModal
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
}
