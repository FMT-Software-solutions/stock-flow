import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MASKED_CODE, useDeleteDiscount, useDiscounts, useSetDiscountActive } from '@/hooks/useDiscountQueries';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { DISCOUNT_STATUS_LABEL, describeDiscountScope, describeDiscountValue } from '@/lib/discounts';
import type { Discount, DiscountStatus } from '@/types/discounts';
import { CreateDiscountSheet } from './components/CreateDiscountSheet';
import { discountExportFields } from './fields/discountFields';

const STATUS_VARIANT: Record<DiscountStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  scheduled: 'outline',
  paused: 'secondary',
  expired: 'secondary',
  used_up: 'secondary',
};

function formatWhen(iso?: string | null) {
  return iso ? format(new Date(iso), 'MMM dd, yyyy h:mm a') : null;
}

export function DiscountManager() {
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const { data: discounts = [], isLoading } = useDiscounts(currentOrganization?.id);
  const deleteDiscount = useDeleteDiscount();
  const setActive = useSetDiscountActive();
  const [editing, setEditing] = useState<Discount | null>(null);
  const { isOwner, checkPermission } = useRoleCheck();

  const canEdit = checkPermission('discounts', 'edit') || isOwner();
  const canDelete = checkPermission('discounts', 'delete') || isOwner();
  const canExport = checkPermission('discounts', 'export') || isOwner();

  const toggleActive = (d: Discount) =>
    setActive.mutate(
      { id: d.id, active: !d.isActive },
      {
        onSuccess: () => toast.success(d.isActive ? 'Paused' : 'Resumed'),
        onError: (e) => toast.error(e.message),
      }
    );

  const columns: ColumnDef<Discount>[] = [
    {
      id: 'search',
      accessorFn: (row) => [row.name, row.code ?? '', describeDiscountScope(row)].join(' '),
      enableHiding: true,
      header: () => null,
      cell: () => null,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="space-y-0.5">
            <div className="font-medium">{d.name}</div>
            {d.method === 'code' ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {d.code}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Automatic</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'discount',
      header: 'Discount',
      cell: ({ row }) => {
        const d = row.original;
        const rules = [
          d.minSubtotal ? `min ${formatCurrency(d.minSubtotal)}` : null,
          d.minQuantity ? `min ${d.minQuantity} items` : null,
          d.customerIds?.length ? `${d.customerIds.length} customer${d.customerIds.length > 1 ? 's' : ''}` : null,
          d.branchIds?.length ? `${d.branchIds.length} branch${d.branchIds.length > 1 ? 'es' : ''}` : null,
          d.combinable ? 'combines' : null,
        ].filter(Boolean);
        return (
          <div className="space-y-0.5 text-sm">
            <div>{describeDiscountValue(d, formatCurrency)}</div>
            <div className="text-xs text-muted-foreground">
              {describeDiscountScope(d)}
              {rules.length > 0 && ` · ${rules.join(' · ')}`}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const d = row.original;
        const starts = formatWhen(d.startsAt);
        const ends = formatWhen(d.endsAt);
        return (
          <div className="space-y-0.5">
            <Badge variant={STATUS_VARIANT[d.status]}>{DISCOUNT_STATUS_LABEL[d.status]}</Badge>
            {(starts || ends) && (
              <div className="text-xs text-muted-foreground">
                {starts ?? 'Now'} – {ends ?? 'No end'}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'uses',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Uses" />,
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="text-sm">
            {d.uses}
            {d.usageLimit ? ` / ${d.usageLimit}` : ''}
            {d.usageLimitPerCustomer ? (
              <div className="text-xs text-muted-foreground">{d.usageLimitPerCustomer} per customer</div>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'amountGiven',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Given" />,
      cell: ({ row }) => <span className="text-sm">{formatCurrency(row.original.amountGiven)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const d = row.original;
        const codeVisible = !!d.code && d.code !== MASKED_CODE;
        return (
          <div data-no-row-click="true">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(d)} disabled={!canEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleActive(d)} disabled={!canEdit}>
                  {d.isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {d.isActive ? 'Pause' : 'Resume'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(d.code ?? '');
                    toast.success('Code copied');
                  }}
                  disabled={!codeVisible}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={!canDelete}
                  onClick={() => {
                    if (!window.confirm(`Delete "${d.name}"? Past sales keep their discount.`)) return;
                    deleteDiscount.mutate(d.id, {
                      onSuccess: () => toast.success('Discount deleted'),
                      onError: (e) => toast.error(e.message),
                    });
                  }}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={isLoading ? [] : discounts}
        searchKey="search"
        exportFields={discountExportFields}
        defaultColumnVisibility={{ search: false }}
        canExport={!!canExport}
        onRowClick={canEdit ? (d) => setEditing(d) : undefined}
      />

      <CreateDiscountSheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        discount={editing ?? undefined}
      />
    </div>
  );
}
