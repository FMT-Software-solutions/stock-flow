import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '@/types/inventory';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export const columns: ColumnDef<Customer>[] = [
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
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'firstName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
  },
  {
    accessorKey: 'totalOrders',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Orders" />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue('totalOrders')}</div>
    ),
  },
  {
    accessorKey: 'totalSpent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Spent" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalSpent'));
      return (
        <div className="font-medium">
          <CurrencyDisplay amount={amount} />
        </div>
      );
    },
  },
  {
    accessorKey: 'lastOrderDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Order" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('lastOrderDate') as string;
      if (!date) return <span className="text-muted-foreground">-</span>;
      return <div>{format(new Date(date), 'MMM dd, yyyy')}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const customer = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(customer.email)}
            >
              Copy Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                to={`/customers/${customer.id}`}
                className="flex items-center"
              >
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                to={`/customers/${customer.id}`}
                className="flex items-center"
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Customer
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
