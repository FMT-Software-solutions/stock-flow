import { type ColumnDef } from '@tanstack/react-table';
import type { Order } from '@/types/orders';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { format, formatDistanceToNow } from 'date-fns';
import { isDateInRange } from '@/lib/utils';
import { OrderItemsCell } from '@/components/orders/OrderItemsCell';
import { OrderStatusCell } from '@/components/orders/OrderStatusCell';
import { OrderPaymentStatusCell } from '@/components/orders/OrderPaymentStatusCell';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { CustomerHoverLink } from '@/components/shared/CustomerHoverLink';
import { OrderActions } from './OrderActions';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { Checkbox } from '@/components/ui/checkbox';
import { useActiveItemsInOrg, useApprovedItemsForUser } from '@/lib/action-requests/useApprovedItemsForUser';
import { SALES_EDIT_DATE } from '@/lib/action-requests/registry';
import { useState } from 'react';

function OrderDateCell({ order }: { order: Order }) {
  const { data: approved } = useApprovedItemsForUser({
    actionType: SALES_EDIT_DATE,
    entityType: 'order',
  });
  const { data: active } = useActiveItemsInOrg({
    actionType: SALES_EDIT_DATE,
    entityType: 'order',
  });
  const date = new Date(order.date);
  const relativeTime = formatDistanceToNow(date, { addSuffix: true });
  const hasGrant = approved?.has(order.id);
  const activeState = active?.get(order.id);
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium">
        {format(date, 'MMM dd, yyyy h:mm a')}
      </span>
      <span className="text-xs text-muted-foreground">
        {relativeTime === 'in less than a minute' || relativeTime === 'less than a minute ago' ? 'now' : relativeTime}
      </span>
      {hasGrant ? (
        <span className="mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 w-fit">
          Date edit approved
        </span>
      ) : activeState === 'pending' ? (
        <span className="mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 w-fit">
          Edit requested
        </span>
      ) : null}
    </div>
  );
}

function OrderNumberCell({ order }: { order: Order }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="text-xs font-mono font-medium text-primary hover:underline cursor-pointer"
        title={`View details for order #${order.order_number}`}
        onClick={() => setDetailsOpen(true)}
      >
        {order.order_number}
      </button>
      <OrderDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        order={order}
      />
    </>
  );
}

export const columns: ColumnDef<Order>[] = [
  {
    id: 'search',
    accessorFn: (row) => {
      const items = row.items?.map((item) => item.product_name).join(' ') || '';
      const branchName = row.branch?.name || '';
      const customerName = row.customer
        ? `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim() ||
        row.customer.email ||
        ''
        : '';
      const paymentMethod = row.payment_method
        ? row.payment_method.replace(/_/g, ' ')
        : '';

      return [
        row.order_number || '',
        branchName,
        customerName,
        items,
        row.total_amount?.toString() || '',
        row.paid_amount?.toString() || '',
        row.status || '',
        row.payment_status || '',
        paymentMethod,
      ]
        .join(' ')
        .trim();
    },
    enableHiding: true,
  },
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { noRowClick: true } as any,
  },
  {
    accessorKey: 'order_number',
    id: 'orderNumber',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order #" />
    ),
    cell: ({ row }) => <OrderNumberCell order={row.original} />,
    enableSorting: true,
  },
  {
    id: 'branchName',
    accessorFn: (row) => row.branch?.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    cell: ({ row }) => {
      const branch = row.original.branch;
      return branch ? <span className='max-w-21.25 truncate line-clamp-1' title={branch.name}>{branch.name}</span> : '-';
    },
    filterFn: (row, id, value) => {
      // Simple filter for now, usually handled by server or strict equality
      return value.includes(row.getValue(id));
    }
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => <OrderDateCell order={row.original} />,
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
    filterFn: () => {
      // Range filter logic if needed, but simplified for now
      return true;
    }
  },
  {
    accessorKey: 'paid_amount',
    id: 'paidAmount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid" />
    ),
    cell: ({ row }) => {
      const paid = (row.getValue('paidAmount') as number) || 0;
      const total = row.original.total_amount || 0;
      const arrears = total - paid;

      return (
        <div className="flex flex-col">
          <CurrencyDisplay amount={paid} />
          {arrears > 0 && row.original.payment_status !== 'refunded' && (
            <span className="text-[10px] text-red-500 font-medium">
              Due: <CurrencyDisplay amount={arrears} />
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'payment_status',
    id: 'paymentStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment" />
    ),
    cell: ({ row }) => <OrderPaymentStatusCell order={row.original} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'payment_method',
    id: 'paymentMethod',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Method" />
    ),
    cell: ({ row }) => {
      const raw = row.getValue('paymentMethod') as string | undefined;
      const label = raw
        ? raw
          .split('_')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ')
        : '-';
      return <span className="text-xs">{label}</span>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    enableHiding: true,
  },
  {
    accessorKey: 'customer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    accessorFn: (row) => {
      const customer = row.customer;
      if (!customer) return '-';
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email || 'Guest';
    },
    cell: ({ row }) => {
      const customer = row.original.customer;
      if (!customer) return '-';
      const name =
        `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
        customer.email ||
        'Guest';
      return (
        <CustomerHoverLink
          customerId={customer.id}
          customerName={name}
          className="text-xs"
        />
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order Status" />
    ),
    cell: ({ row }) => <OrderStatusCell order={row.original} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },

  {
    accessorKey: 'created_at',
    id: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('createdAt'));
      const relativeTime = formatDistanceToNow(date, { addSuffix: true });
      return (
        <div className="flex flex-col">
          <span className="text-xs">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime === 'in less than a minute' || relativeTime === 'less than a minute ago' ? 'now' : relativeTime}
          </span>
        </div>
      )
    }
    ,
    filterFn: (row, id, value) => {
      return isDateInRange(row.getValue(id), value);
    },
    enableHiding: true,
  },
  {
    accessorKey: 'updated_at',
    id: 'updatedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('updatedAt'));
      const relativeTime = formatDistanceToNow(date, { addSuffix: true });
      return (
        <div className="flex flex-col">
          <span className="text-xs">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime === 'in less than a minute' || relativeTime === 'less than a minute ago' ? 'now' : relativeTime}
          </span>
        </div>
      )
    }
    ,
    filterFn: (row, id, value) => {
      return isDateInRange(row.getValue(id), value);
    },
    enableHiding: true,
  },

  {
    id: 'actions',
    header: 'Actions',
    meta: {
      headerClassName: 'sticky right-0 bg-background z-10',
      cellClassName: 'sticky right-0 bg-background z-10',
      noRowClick: true,
    },
    cell: ({ row }) => <OrderActions order={row.original} />,
  },
];
