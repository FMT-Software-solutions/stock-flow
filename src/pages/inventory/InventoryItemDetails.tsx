import { useParams, useNavigate } from 'react-router-dom';
import { useInventoryEntry } from '@/hooks/useInventoryQueries';
import { useInventoryOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Edit, Copy } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { Order } from '@/types/orders';
import { DataTableColumnHeader } from '@/components/shared/data-table/data-table-column-header';
import { format } from 'date-fns';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useMemo, useState } from 'react';
import { ImagePreview } from '@/components/shared/ImagePreview';
import { toast } from 'sonner';
import { useBranchContext } from '@/contexts/BranchContext';
import { Badge } from '@/components/ui/badge';
import { getOrderStatusVariant } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Check, X, Pencil } from 'lucide-react';
import { useUpdateInventoryEntry } from '@/hooks/useInventoryQueries';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useValidInventoryDiscounts } from '@/hooks/useDiscountQueries';
import { Badge as UiBadge } from '@/components/ui/badge';

export function InventoryItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    data: inventory,
    isLoading: isLoadingInventory,
    refetch,
  } = useInventoryEntry(id);
  const { data: orders = [] } = useInventoryOrders(id);
  const { availableBranches } = useBranchContext();
  const updateInventory = useUpdateInventoryEntry();
  const { checkPermission } = useRoleCheck();
  const { currentOrganization } = useOrganization();
  const {
    data: validDiscounts = [],
    isLoading: isLoadingValidDiscounts,
  } = useValidInventoryDiscounts(
    currentOrganization?.id,
    inventory?.branchId ? [inventory.branchId] : undefined
  );

  const canEditInventory = checkPermission('inventory', 'edit');
  const canExportOrders = checkPermission('orders', 'export');
  const canEditProduct = checkPermission('products', 'edit');

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [priceInput, setPriceInput] = useState<number | ''>('');
  const [stockInput, setStockInput] = useState<number | ''>('');

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order Date" />
        ),
        cell: ({ row }) =>
          format(new Date(row.getValue('date')), 'MMM dd, yyyy h:mma'),
      },
      {
        id: 'unitPrice',
        header: 'Item Price',
        accessorFn: (row) => {
          const item = (row.items || []).find(
            (i: any) => i.inventory_id === id
          );
          return item ? item.unit_price : 0;
        },
        cell: ({ row }) => {
          const item = (row.original.items || []).find(
            (i: any) => i.inventory_id === id
          );
          return item ? <CurrencyDisplay amount={item.unit_price} /> : '-';
        },
      },
      {
        id: 'quantity',
        header: 'Order Qty.',
        accessorFn: (row) => {
          const item = (row.items || []).find(
            (i: any) => i.inventory_id === id
          );
          return item ? item.quantity : 0;
        },
        cell: ({ row }) => {
          const item = (row.original.items || []).find(
            (i: any) => i.inventory_id === id
          );
          return item ? item.quantity : '-';
        },
      },
      {
        accessorKey: 'total_amount',
        header: 'Order Total',
        cell: ({ row }) => {
          const val = row.getValue('total_amount') as number | string;
          const amount = typeof val === 'string' ? parseFloat(val) : val ?? 0;
          return <CurrencyDisplay amount={isNaN(amount) ? 0 : amount} />;
        },
      },
      {
        accessorKey: 'payment_method',
        header: 'Payment Method',
        cell: ({ row }) => {
          const method = row.getValue('payment_method') as string;
          return method ? method.replace('_', ' ').toUpperCase() : '-';
        },
      },
      {
        accessorKey: 'status',
        header: 'Order Status',
        cell: ({ row }) => (
          <Badge
            variant={getOrderStatusVariant(row.getValue('status'))}
            className="px-4 justify-center capitalize"
          >
            {row.getValue('status')}
          </Badge>
        ),
      },
    ],
    [id]
  );

  if (isLoadingInventory) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!inventory) {
    return <div className="p-8">Inventory item not found</div>;
  }

  const branch = availableBranches.find((b) => b.id === inventory.branchId);
  const itemDiscounts =
    validDiscounts.find((r) => r.inventoryId === inventory.id)?.discounts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {inventory.productName}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              {inventory.inventoryNumber && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">Inv #:</span>
                  <span className="font-mono">{inventory.inventoryNumber}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        inventory.inventoryNumber || ''
                      );
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground">SKU:</span>
                <span className="font-mono">{inventory.sku}</span>
              </div>
            </div>
          </div>
        </div>
        {canEditProduct && (
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/inventory/${inventory.productId}/edit`)}
              disabled={!canEditProduct}
            >
              <Edit className="mr-2 h-4 w-4" /> Edit Product
            </Button>
          </div>
        )}
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 flex justify-center md:justify-start">
              {inventory.imageUrl || inventory.productImage ? (
                <ImagePreview
                  src={inventory.imageUrl || inventory.productImage}
                  alt={inventory.productName}
                  className="w-48 h-48 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-8 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Unit Price
                </p>
                <div className="flex items-center gap-2">
                  {!isEditingPrice ? (
                    <>
                      <div className="text-xl font-bold">
                        <CurrencyDisplay
                          amount={
                            inventory.priceOverride ??
                            inventory.productPrice ??
                            0
                          }
                        />
                      </div>
                      {canEditInventory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsEditingPrice(true);
                            setPriceInput(
                              typeof inventory.priceOverride === 'number'
                                ? inventory.priceOverride
                                : inventory.productPrice ?? 0
                            );
                          }}
                          aria-label="Edit unit price"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={priceInput}
                        onChange={(e) =>
                          setPriceInput(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-28 h-8"
                        aria-label="Unit price input"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          try {
                            const price =
                              priceInput === ''
                                ? undefined
                                : Number(priceInput);
                            await updateInventory.mutateAsync({
                              id: inventory.id,
                              priceOverride: price,
                            });
                            toast.success('Unit price updated');
                            setIsEditingPrice(false);
                            await refetch();
                          } catch (err) {
                            toast.error('Failed to update unit price');
                            console.error(err);
                          }
                        }}
                        aria-label="Save unit price"
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setIsEditingPrice(false);
                          setPriceInput('');
                        }}
                        aria-label="Cancel unit price edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  In Stock
                </p>
                <div className="flex items-center gap-2">
                  {!isEditingStock ? (
                    <>
                      <div className="text-xl font-bold">
                        {inventory.quantity} {inventory.unit}
                      </div>
                      {canEditInventory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsEditingStock(true);
                            setStockInput(inventory.quantity ?? 0);
                          }}
                          aria-label="Edit stock level"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={stockInput}
                        onChange={(e) =>
                          setStockInput(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-24 h-8"
                        aria-label="Stock level input"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          try {
                            const qty =
                              stockInput === '' ? 0 : Number(stockInput);
                            await updateInventory.mutateAsync({
                              id: inventory.id,
                              quantity: qty,
                            });
                            toast.success('Stock level updated');
                            setIsEditingStock(false);
                            await refetch();
                          } catch (err) {
                            toast.error('Failed to update stock level');
                            console.error(err);
                          }
                        }}
                        aria-label="Save stock level"
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setIsEditingStock(false);
                          setStockInput('');
                        }}
                        aria-label="Cancel stock edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Category
                </p>
                <div className="text-lg font-medium">
                  {inventory.categoryName || '-'}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Branch
                </p>
                <div className="text-lg font-medium">{branch?.name || '-'}</div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Sold
                </p>
                <div className="text-xl font-bold">
                  {orders.reduce((sum, order) => {
                    const item = (order.items || []).find(
                      (i: any) => i.inventory_id === id
                    );
                    return sum + (item ? item.quantity : 0);
                  }, 0)}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <div className="text-xl font-bold">
                  <CurrencyDisplay
                    amount={orders.reduce((sum, order) => {
                      const item = (order.items || []).find(
                        (i: any) => i.inventory_id === id
                      );
                      return sum + (item ? item.quantity * item.unit_price : 0);
                    }, 0)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Active Discounts
        </h2>
        {isLoadingValidDiscounts ? (
          <div className="h-20 w-full bg-muted animate-pulse rounded" />
        ) : itemDiscounts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No active discounts
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemDiscounts.map((d) => {
              const start = d.startAt
                ? `${format(new Date(d.startAt), 'MMM dd, yyyy')} ${format(
                    new Date(d.startAt),
                    'h:mm a'
                  )}`
                : 'Any';
              const end = d.expiresAt
                ? `${format(new Date(d.expiresAt), 'MMM dd, yyyy')} ${format(
                    new Date(d.expiresAt),
                    'h:mm a'
                  )}`
                : 'Forever';
              return (
                <Card key={d.id} className="border-muted">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{d.name}</div>
                      <UiBadge variant="outline">
                        {d.usageMode === 'automatic' ? 'Automatic' : 'Manual'}
                      </UiBadge>
                    </div>
                    {d.code && (
                      <div className="text-xs font-mono text-muted-foreground">
                        {d.code}
                      </div>
                    )}
                    <div className="text-sm font-medium">
                      {d.type === 'percentage' ? (
                        <span>{d.value}%</span>
                      ) : (
                        <CurrencyDisplay amount={d.value} />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {start} - {end}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Purchase History
        </h2>
        <DataTable
          columns={columns}
          data={orders}
          searchKey="date"
          storageKey={`inventory-history-${id}`}
          canExport={canExportOrders}
        />
      </div>
    </div>
  );
}
