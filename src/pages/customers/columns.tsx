import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '@/types/customer';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash, Copy, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { isDateInRange } from '@/lib/utils';
import { useDeleteCustomer } from '@/hooks/useCustomerQueries';
import { toast } from 'sonner';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CustomerActions = ({ customer }: { customer: Customer }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteCustomer = useDeleteCustomer();
  const { checkPermission } = useRoleCheck();
  const canEdit = checkPermission('customers', 'edit');
  const canDelete = checkPermission('customers', 'delete');

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast.success('Customer deleted successfully');
      setShowDeleteDialog(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete customer');
    }
  };

  return (
    <>
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
            onClick={() =>
              customer.email && navigator.clipboard.writeText(customer.email)
            }
            disabled={!customer.email}
          >
            Copy Email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to={`/customers/details/${customer.id}`}
              className="flex items-center"
            >
              <Eye className="mr-2 h-4 w-4" /> View Details
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link
                to={`/customers/${customer.id}`}
                className="flex items-center"
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Customer
              </Link>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowDeleteDialog(true);
              }}
              className="text-red-600"
            >
              <Trash className="mr-2 h-4 w-4" /> Delete Customer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the customer from your customer database. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const columns: ColumnDef<Customer>[] = [
  {
    id: 'search',
    accessorFn: (row) =>
      [
        row.firstName || '',
        row.lastName || '',
        row.email || '',
        row.phone || '',
      ]
        .join(' ')
        .trim(),
    enableHiding: false,
  },
  {
    id: 'name',
    accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const fullName = `${row.original.firstName || ''} ${
        row.original.lastName || ''
      }`.trim();
      return (
        <div className="flex items-center gap-1 group/copy">
          <Link
            to={`/customers/details/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {fullName}
          </Link>
          {fullName && (
            <Copy
              className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(fullName);
                toast.success('Copied to clipboard');
              }}
            />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => {
      const email = row.getValue('email') as string;
      return (
        <div className="flex items-center gap-1 group/copy">
          <div>{email || <span className="text-muted-foreground">-</span>}</div>
          {email && (
            <Copy
              className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(email);
                toast.success('Copied to clipboard');
              }}
            />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'branchName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Branch" />
    ),
    cell: ({ row }) => {
      const branchName = row.getValue('branchName') as string;
      if (!branchName) return <span className="text-muted-foreground">-</span>;
      return <div>{branchName}</div>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => {
      const phone = row.getValue('phone') as string;
      return (
        <div className="flex items-center gap-1 group/copy">
          <div>{phone || <span className="text-muted-foreground">-</span>}</div>
          {phone && (
            <Copy
              className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(phone);
                toast.success('Copied to clipboard');
              }}
            />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'totalOrders',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Orders" />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue('totalOrders') || 0}</div>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created Date" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as string;
      if (!date) return <span className="text-muted-foreground">-</span>;
      return <div>{format(new Date(date), 'MMM dd, yyyy')}</div>;
    },
    filterFn: (row, id, value) => {
      return isDateInRange(row.getValue(id), value);
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <CustomerActions customer={row.original} />,
  },
];
