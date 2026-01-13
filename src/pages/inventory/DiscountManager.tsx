import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useDiscounts, useDeleteDiscount } from '@/hooks/useDiscountQueries';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal, Trash, Copy, Pencil } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table/data-table';
import { CreateDiscountSheet } from './components/CreateDiscountSheet';
import type { ColumnDef } from '@tanstack/react-table';
import type { Discount } from '@/types/discounts';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { discountExportFields } from './fields/discountFields';
import { DiscountTargetsCell } from '@/components/discounts/DiscountTargetsCell';
import { DiscountDetailsDialog } from '@/components/discounts/DiscountDetailsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function DiscountManager() {
  const { currentOrganization } = useOrganization();
  const { data: discounts = [] } = useDiscounts(currentOrganization?.id);
  const { mutate: deleteDiscount } = useDeleteDiscount();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const sortedDiscounts = [...discounts].sort((a, b) => {
    const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bd - ad;
  });

  const columns: ColumnDef<Discount>[] = [
    {
      id: 'search',
      accessorFn: (row) =>
        [row.name || '', row.code || '', String(row.value ?? '')]
          .join(' ')
          .trim(),
      enableHiding: false,
      header: () => null,
      cell: () => null,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) =>
        row.original.code ? (
          <span className="font-mono text-xs">{row.original.code}</span>
        ) : (
          '-'
        ),
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }) => {
        return row.original.type === 'percentage'
          ? `${row.original.value}%`
          : `${row.original.value}`;
      },
    },
    {
      id: 'targets',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Targets" />
      ),
      cell: ({ row }) => <DiscountTargetsCell discount={row.original} />,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {row.original.expiresAt &&
            new Date(row.original.expiresAt).getTime() < Date.now() && (
              <Badge variant="destructive">Expired</Badge>
            )}
        </div>
      ),
    },
    {
      header: 'Validity',
      cell: ({ row }) => {
        if (!row.original.startAt && !row.original.expiresAt)
          return <span className="text-xs text-muted-foreground">Always</span>;
        const startDate = row.original.startAt
          ? new Date(row.original.startAt)
          : undefined;
        const endDate = row.original.expiresAt
          ? new Date(row.original.expiresAt)
          : undefined;
        const start = startDate
          ? `${format(startDate, 'MMMM dd, yyyy')} ${format(
              startDate,
              'h:mm a'
            )}`
          : 'Any';
        const end = endDate
          ? `${format(endDate, 'MMMM dd, yyyy')} ${format(endDate, 'h:mm a')}`
          : 'Forever';
        const startRel =
          startDate?.getTime() != null
            ? formatDistanceToNow(startDate, { addSuffix: true })
            : null;
        const endRel =
          endDate?.getTime() != null
            ? formatDistanceToNow(endDate, { addSuffix: true })
            : null;
        return (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              {start} - {end}
            </div>
            <div className="flex gap-2">
              {startRel && (
                <span>
                  Start: {' '}
                  {startRel === 'in less than a minute' ? 'now' : startRel}
                </span>
              )}
              {endRel && (
                <span>
                  Ends {endRel === 'less than a minute ago' ? 'now' : endRel}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const discount = row.original;

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
                onClick={() => {
                  setDetailsId(discount.id);
                  setDetailsOpen(true);
                }}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingDiscount(discount);
                  setIsEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (discount.code) {
                    navigator.clipboard.writeText(discount.code);
                    toast.success('Code copied to clipboard');
                  }
                }}
                disabled={!discount.code}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  // Simple confirm for now
                  if (
                    window.confirm(
                      'Are you sure you want to delete this discount? This will remove it from all associated inventory items.'
                    )
                  ) {
                    deleteDiscount(discount.id);
                    toast.success('Discount deleted');
                  }
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Discounts</h2>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Discount
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sortedDiscounts}
        searchKey="search"
        exportFields={discountExportFields}
        defaultColumnVisibility={{ search: false }}
      />
      {/* Hide the search column by default and exclude from exports via DataTable defaults */}
      {/* The DataTable view toggles will not include 'search' since enableHiding is false */}

      <CreateDiscountSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <CreateDiscountSheet
        open={isEditOpen}
        onOpenChange={(val) => {
          setIsEditOpen(val);
          if (!val) setEditingDiscount(null);
        }}
        discount={editingDiscount ?? undefined}
      />
      {detailsId && (
        <DiscountDetailsDialog
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setDetailsId(null);
          }}
          discountId={detailsId}
        />
      )}
    </div>
  );
}
