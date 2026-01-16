import { useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useDiscounts,
  useDeleteDiscount,
  useUpdateDiscountFields,
} from '@/hooks/useDiscountQueries';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash, Copy, Pencil } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table/data-table';
import { CreateDiscountSheet } from './components/CreateDiscountSheet';
import { ActivateDiscountDialog } from '@/components/discounts/ActivateDiscountDialog';
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
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';

export function DiscountManager() {
  const { currentOrganization } = useOrganization();
  const { data: discounts = [] } = useDiscounts(currentOrganization?.id);
  const { mutate: deleteDiscount } = useDeleteDiscount();
  const { mutate: updateDiscountFields } = useUpdateDiscountFields();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [activatingDiscount, setActivatingDiscount] = useState<Discount | null>(
    null
  );
  const { isOwner, hasRole, checkPermission } = useRoleCheck();
  const { user } = useAuth();

  const isWrite = () => hasRole(['write']);
  const canEdit =
    checkPermission('discounts', 'edit') || isOwner() || isWrite();
  const canDelete = checkPermission('discounts', 'delete') || isOwner();
  const canExport = checkPermission('discounts', 'export') || isOwner();
  const canViewCode = checkPermission('discounts', 'view_code') || isOwner();

  const isCreator = (d?: Discount | null) => {
    if (!d?.createdBy || !user?.id) return false;
    return d.createdBy === user.id;
  };
  const canUpdateDiscount = (d: Discount) => {
    if (isOwner()) return true;
    return !!canEdit && isCreator(d);
  };
  const canViewCodeFor = (d: Discount) => {
    if (!d.code) return false;
    return canViewCode || isOwner() || isCreator(d);
  };

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
      cell: ({ row }) => {
        const d = row.original;
        if (!d.code) return '-';
        if (!canViewCodeFor(d))
          return (
            <span className="text-xs italic text-muted-foreground">Hidden</span>
          );
        return <span className="font-mono text-xs">{d.code}</span>;
      },
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
      accessorKey: 'usageMode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mode" />
      ),
      cell: ({ row }) => {
        const discount = row.original;
        const isAutomatic = (discount.usageMode ?? 'manual') === 'automatic';
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                title="Click to change mode"
              >
                {isAutomatic ? 'Automatic' : 'Manual'}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Mode</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  updateDiscountFields(
                    { id: discount.id, usageMode: 'automatic' },
                    {
                      onSuccess: () => toast.success('Mode set to Automatic'),
                      onError: (e: unknown) =>
                        toast.error(
                          (e as { message?: string })?.message ||
                            'Failed to update mode'
                        ),
                    }
                  )
                }
                disabled={isAutomatic || !canUpdateDiscount(discount)}
              >
                Automatic
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  updateDiscountFields(
                    { id: discount.id, usageMode: 'manual' },
                    {
                      onSuccess: () => toast.success('Mode set to Manual'),
                      onError: (e: unknown) =>
                        toast.error(
                          (e as { message?: string })?.message ||
                            'Failed to update mode'
                        ),
                    }
                  )
                }
                disabled={!isAutomatic || !canUpdateDiscount(discount)}
              >
                Manual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      accessorKey: 'usageLimit',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Usage Limit" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.usageLimit != null
            ? row.original.usageLimit
            : 'Unlimited'}
        </span>
      ),
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
      cell: ({ row }) => {
        const discount = row.original;
        const isExpired =
          !!discount.expiresAt &&
          new Date(discount.expiresAt).getTime() < Date.now();
        const variant = isExpired
          ? 'destructive'
          : discount.isActive
          ? 'default'
          : 'secondary';
        const label = isExpired
          ? 'Expired'
          : discount.isActive
          ? 'Active'
          : 'Inactive';
        return (
          <div className="flex items-center gap-2" data-no-row-click="true">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant={variant as any}
                  className="cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  title="Click for status actions"
                >
                  {label}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Status Actions</DropdownMenuLabel>
                {!isExpired && canUpdateDiscount(discount) && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        updateDiscountFields(
                          {
                            id: discount.id,
                            expiresAt: new Date().toISOString(),
                            isActive: false,
                          },
                          {
                            onSuccess: () => toast.success('Discount expired'),
                            onError: (e: unknown) =>
                              toast.error(
                                (e as { message?: string })?.message ||
                                  'Failed to expire discount'
                              ),
                          }
                        )
                      }
                    >
                      Expire Now
                    </DropdownMenuItem>
                    {discount.isActive && canUpdateDiscount(discount) && (
                      <DropdownMenuItem
                        onClick={() =>
                          updateDiscountFields(
                            { id: discount.id, isActive: false },
                            {
                              onSuccess: () =>
                                toast.success('Discount disabled'),
                              onError: (e: unknown) =>
                                toast.error(
                                  (e as { message?: string })?.message ||
                                    'Failed to disable discount'
                                ),
                            }
                          )
                        }
                      >
                        Disable
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {isExpired && canUpdateDiscount(discount) && (
                  <DropdownMenuItem
                    onClick={() => {
                      setActivatingDiscount(discount);
                      setIsActivateOpen(true);
                    }}
                  >
                    Activate…
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
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
          ? `${format(startDate, 'MMM dd, yyyy')} ${format(
              startDate,
              'h:mm a'
            )}`
          : 'Any';
        const end = endDate
          ? `${format(endDate, 'MMM dd, yyyy')} ${format(endDate, 'h:mm a')}`
          : 'Forever';
        const startIsPast = startDate
          ? startDate.getTime() < Date.now()
          : undefined;
        const endIsPast = endDate ? endDate.getTime() < Date.now() : undefined;
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
                  {startIsPast ? 'Started' : 'Starts'}{' '}
                  {startRel === 'in less than a minute' ? 'now' : startRel}
                </span>
              )}
              {endRel && (
                <span>
                  {endIsPast ? 'Ended' : 'Ends'}{' '}
                  {endRel === 'less than a minute ago' ? 'now' : endRel}
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
        const isExpired =
          !!discount.expiresAt &&
          new Date(discount.expiresAt).getTime() < Date.now();

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
                  if (!isExpired && canUpdateDiscount(discount)) {
                    setEditingDiscount(discount);
                    setIsEditOpen(true);
                  }
                }}
                disabled={isExpired || !canUpdateDiscount(discount)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (discount.code && !isExpired && canViewCodeFor(discount)) {
                    navigator.clipboard.writeText(discount.code);
                    toast.success('Code copied to clipboard');
                  }
                }}
                disabled={
                  !discount.code || isExpired || !canViewCodeFor(discount)
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </DropdownMenuItem>
              {!isExpired && canUpdateDiscount(discount) && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      updateDiscountFields(
                        {
                          id: discount.id,
                          expiresAt: new Date().toISOString(),
                          isActive: false,
                        },
                        {
                          onSuccess: () => toast.success('Discount expired'),
                          onError: (e: unknown) =>
                            toast.error(
                              (e as { message?: string })?.message ||
                                'Failed to expire discount'
                            ),
                        }
                      );
                    }}
                  >
                    Expire Now
                  </DropdownMenuItem>
                  {discount.isActive && canUpdateDiscount(discount) && (
                    <DropdownMenuItem
                      onClick={() => {
                        updateDiscountFields(
                          { id: discount.id, isActive: false },
                          {
                            onSuccess: () => toast.success('Discount disabled'),
                            onError: (e: unknown) =>
                              toast.error(
                                (e as { message?: string })?.message ||
                                  'Failed to disable discount'
                              ),
                          }
                        );
                      }}
                    >
                      Disable
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {isExpired && canUpdateDiscount(discount) && (
                <DropdownMenuItem
                  onClick={() => {
                    setActivatingDiscount(discount);
                    setIsActivateOpen(true);
                  }}
                >
                  Activate…
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to delete this discount? This will remove it from all associated inventory items.'
                    )
                  ) {
                    if (canDelete) {
                      deleteDiscount(discount.id);
                      toast.success('Discount deleted');
                    }
                  }
                }}
                disabled={!canDelete}
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
      <DataTable
        columns={columns}
        data={sortedDiscounts}
        searchKey="search"
        exportFields={discountExportFields}
        defaultColumnVisibility={{ search: false, code: canViewCode }}
        canExport={!!canExport}
      />
      {/* Hide the search column by default and exclude from exports via DataTable defaults */}
      {/* The DataTable view toggles will not include 'search' since enableHiding is false */}

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
          discount={discounts.find((d) => d.id === detailsId)}
        />
      )}
      {activatingDiscount && (
        <ActivateDiscountDialog
          open={isActivateOpen}
          onOpenChange={(open) => {
            setIsActivateOpen(open);
            if (!open) setActivatingDiscount(null);
          }}
          discount={activatingDiscount}
        />
      )}
    </div>
  );
}
