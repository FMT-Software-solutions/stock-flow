import { type ColumnDef } from '@tanstack/react-table';
import type { Order } from '@/types/orders';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { format, formatDistanceToNow } from 'date-fns';
import { OrderItemsCell } from '@/components/orders/OrderItemsCell';
import { OrderStatusCell } from '@/components/orders/OrderStatusCell';
import { OrderPaymentStatusCell } from '@/components/orders/OrderPaymentStatusCell';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { OrderActions } from './OrderActions';
import { Link } from 'react-router-dom';

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
    cell: ({ row }) => (
      <span className="font-mono font-medium">{row.getValue('orderNumber')}</span>
    ),
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
        return branch ? branch.name : '-';
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
          <span className="font-medium">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime === 'in less than a minute' || relativeTime === 'less than a minute ago' ? 'now' : relativeTime}
          </span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
        const rowDate = new Date(row.getValue(id));
        const { from, to } = value;
        if (!from) return true;
        if (to && rowDate > to) return false;
        if (rowDate < from) return false;
        return true;
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
        return <div className="font-bold"><CurrencyDisplay amount={row.getValue('totalAmount')} /></div>;
    },
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
            className="hover:underline"
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
    accessorKey: 'payment_method',
    id: 'paymentMethod',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Method" />
    ),
    cell: ({ row }) => <span className="capitalize">{row.getValue('paymentMethod') || '-'}</span>,
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
    },
    enableHiding: true,
  },
  {
    accessorKey: 'created_at',
    id: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => format(new Date(row.getValue('createdAt')), 'MMM dd, yyyy'),
    filterFn: (row, id, value) => {
        const rowDate = new Date(row.getValue(id));
        const { from, to } = value;
        if (!from) return true;
        if (to && rowDate > to) return false;
        if (rowDate < from) return false;
        return true;
    },
    enableHiding: true,
  },
  {
    accessorKey: 'updated_at',
    id: 'updatedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated At" />
    ),
    cell: ({ row }) => format(new Date(row.getValue('updatedAt')), 'MMM dd, yyyy'),
    filterFn: (row, id, value) => {
        const rowDate = new Date(row.getValue(id));
        const { from, to } = value;
        if (!from) return true;
        if (to && rowDate > to) return false;
        if (rowDate < from) return false;
        return true;
    },
    enableHiding: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <OrderStatusCell order={row.original} />,
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
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
    id: 'actions',
    cell: ({ row }) => <OrderActions order={row.original} />,
  },
];
