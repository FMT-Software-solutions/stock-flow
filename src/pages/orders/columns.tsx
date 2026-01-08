import { type ColumnDef } from '@tanstack/react-table';
import type { Order } from '@/types/orders';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { format, formatDistanceToNow } from 'date-fns';
import { isDateInRange } from '@/lib/utils';
import { OrderItemsCell } from '@/components/orders/OrderItemsCell';
import { OrderStatusCell } from '@/components/orders/OrderStatusCell';
import { OrderPaymentStatusCell } from '@/components/orders/OrderPaymentStatusCell';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { OrderActions } from './OrderActions';
import { Link } from 'react-router-dom';

function OrderNumberCell({ order }: { order: Order }) {
  return (
    <button
      type="button"
      data-row-click="true"
      className="text-xs font-mono font-medium text-primary hover:underline cursor-pointer"
      title={`View details for order #${order.order_number}`}
    >
      {order.order_number}
    </button>
  );
}

export const columns: ColumnDef<Order>[] = [
  // We wll enable select column later
  // {
  //   id: 'select',
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked={
  //         table.getIsAllPageRowsSelected() ||
  //         (table.getIsSomePageRowsSelected() && 'indeterminate')
  //       }
  //       onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
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
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'));
      const relativeTime = formatDistanceToNow(date, { addSuffix: true });
      return (
        <div className="flex flex-col">
          <span className="text-xs font-medium">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime === 'in less than a minute' || relativeTime === 'less than a minute ago' ? 'now' : relativeTime}
          </span>
        </div>
      );
    },
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
      return <CurrencyDisplay amount={isNaN(amount) ? 0 : amount}  />;
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
          <Link
            to={`/customers/details/${customer.id}`}
            className="hover:underline text-xs"
          >
            {name}
          </Link>
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
