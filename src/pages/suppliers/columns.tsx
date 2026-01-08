import type { ColumnDef } from '@tanstack/react-table';
import type { Supplier } from '@/types/inventory';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { openExternalUrl } from '@/utils/external-url';
import { toast } from 'sonner';
import { useDeleteSupplier } from '@/hooks/useInventoryQueries';
import { useState } from 'react';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { SupplierDetailsDialog } from './components/SupplierDetailsDialog';
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

const SupplierActions = ({ supplier }: { supplier: Supplier }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const deleteSupplier = useDeleteSupplier();
  const { checkPermission } = useRoleCheck();
  const canEdit = checkPermission('suppliers', 'edit');
  const canDelete = checkPermission('suppliers', 'delete');

  const handleDelete = async () => {
    try {
      await deleteSupplier.mutateAsync(supplier.id);
      toast.success('Supplier deleted successfully');
      setShowDeleteDialog(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete supplier');
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
            onClick={() => {
              if (supplier.email) {
                navigator.clipboard.writeText(supplier.email);
                toast.success('Email copied to clipboard');
              }
            }}
            disabled={!supplier.email}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy Email
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (supplier.phone) {
                navigator.clipboard.writeText(supplier.phone);
                toast.success('Phone copied to clipboard');
              }
            }}
            disabled={!supplier.phone}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy Phone
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowDetailsModal(true);
            }}
            className="flex items-center"
          >
            <Eye className="mr-2 h-4 w-4" /> View Details
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link
                to={`/suppliers/${supplier.id}`}
                className="flex items-center"
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Supplier
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash className="mr-2 h-4 w-4" /> Delete Supplier
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SupplierDetailsDialog
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        supplier={supplier}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the supplier from your list. This action cannot
              be undone.
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
    </>
  );
};

export const columns: ColumnDef<Supplier>[] = [
  {
    id: 'search',
    accessorFn: (row) =>
      [
        row.name || '',
        row.contactPerson || '',
        row.email || '',
        row.phone || '',
      ]
        .join(' ')
        .trim(),
    enableHiding: false,
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
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company Name" />
    ),
    cell: ({ row }) => {
      const name = row.getValue('name') as string;
      return (
        <div className="flex items-center gap-1 group/copy">
          <div className="font-medium">{name}</div>
          {name && (
            <Copy
              className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(name);
                toast.success('Copied to clipboard');
              }}
            />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'contactPerson',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact Person" />
    ),
    cell: ({ row }) => {
      const contact = row.getValue('contactPerson') as string;
      return (
        <div className="flex items-center gap-1 group/copy">
          <div>
            {contact || <span className="text-muted-foreground">-</span>}
          </div>
          {contact && (
            <Copy
              className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(contact);
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
    accessorKey: 'website',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Website" />
    ),
    cell: ({ row }) => {
      const website = row.getValue('website') as string;
      if (!website) return null;
      return (
        <div className="flex items-center gap-1 group/copy">
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={() => openExternalUrl(website)}
          >
            {website}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
          <Copy
            className="h-3 w-3 opacity-0 group-hover/copy:opacity-100 cursor-pointer transition-opacity"
            onClick={() => {
              navigator.clipboard.writeText(website);
              toast.success('Copied to clipboard');
            }}
          />
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <SupplierActions supplier={row.original} />,
  },
];
