import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Edit, Loader2, Package, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { useBranchContext } from '@/contexts/BranchContext';
import { useProduct } from '@/hooks/useInventoryQueries';
import { useProductStock } from '@/hooks/useProductStock';
import { cn } from '@/lib/utils';
import { AddStockDialog } from './product-details/AddStockDialog';
import { StockGrid } from './product-details/StockGrid';
import { StockHistory } from './product-details/StockHistory';
import { productStatusLabel } from './product-editor/productHelpers';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id);
  const { data: stockRows = [] } = useProductStock(id);
  const { availableBranches, selectedBranchIds } = useBranchContext();
  const { checkPermission } = useRoleCheck();
  const canEditProduct = checkPermission('products', 'edit');
  const canAdjustStock = checkPermission('inventory', 'edit') || checkPermission('inventory', 'create');
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>();

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return <div className="p-8 text-center text-muted-foreground">Product not found</div>;
  }

  const activeRows = stockRows.filter((r) => !r.isDeleted && r.branchId);
  const totalStock = activeRows
    .filter((r) => availableBranches.some((b) => b.id === r.branchId))
    .reduce((sum, r) => sum + r.quantity, 0);
  const images = [product.imageUrl, ...(product.additionalImages ?? [])].filter(Boolean) as string[];
  const shownImage = selectedImage ?? images[0];
  const profit = product.sellingPrice - (product.costPrice || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/products')} aria-label="Back to products">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight">{product.name}</h1>
              <Badge variant={product.status === 'published' ? 'default' : 'secondary'}>
                {productStatusLabel(product.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <CurrencyDisplay amount={product.sellingPrice} />
              <span>·</span>
              <span>{product.trackStock ? `${totalStock} ${product.unit || ''} in stock` : 'Stock not tracked'}</span>
              {product.sku && (
                <>
                  <span>·</span>
                  <span>{product.sku}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canEditProduct && (
            <Button variant="outline" onClick={() => navigate(`/products/${product.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {product.trackStock && canAdjustStock && (
            <Button onClick={() => setAddStockOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add stock
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={product.trackStock ? 'stock' : 'details'} className="space-y-4">
        <TabsList>
          {product.trackStock && <TabsTrigger value="stock">Stock</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {product.trackStock && (
          <TabsContent value="stock">
            <StockGrid
              product={product}
              branches={availableBranches}
              stockRows={stockRows}
              canAdjust={canAdjustStock}
            />
          </TabsContent>
        )}

        <TabsContent value="history">
          <StockHistory product={product} stockRows={stockRows} />
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="grid gap-6 pt-6 md:grid-cols-[minmax(0,240px)_1fr]">
              <div className="space-y-2">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {shownImage ? (
                    <img src={shownImage} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img) => (
                      <button
                        key={img}
                        type="button"
                        onClick={() => setSelectedImage(img)}
                        className={cn(
                          'h-12 w-12 shrink-0 overflow-hidden rounded border',
                          shownImage === img && 'ring-2 ring-primary'
                        )}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-[auto_1fr] content-start gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Price</dt>
                <dd><CurrencyDisplay amount={product.sellingPrice} /></dd>
                <dt className="text-muted-foreground">Cost</dt>
                <dd><CurrencyDisplay amount={product.costPrice || 0} /></dd>
                <dt className="text-muted-foreground">Profit</dt>
                <dd>
                  <CurrencyDisplay amount={profit} className={profit >= 0 ? 'text-primary' : 'text-destructive'} />
                </dd>
                <dt className="text-muted-foreground">Category</dt>
                <dd>{product.category?.name ?? '—'}</dd>
                <dt className="text-muted-foreground">Supplier</dt>
                <dd>{product.supplier?.name ?? '—'}</dd>
                <dt className="text-muted-foreground">Unit</dt>
                <dd>{product.unit || '—'}</dd>
                <dt className="text-muted-foreground">Barcode</dt>
                <dd>{product.barcode || '—'}</dd>
                {product.description && (
                  <>
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="whitespace-pre-line">{product.description}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {product.trackStock && (
        <AddStockDialog
          open={addStockOpen}
          onOpenChange={setAddStockOpen}
          product={product}
          branches={availableBranches}
          stockRows={stockRows}
          defaultBranchId={selectedBranchIds.length === 1 ? selectedBranchIds[0] : undefined}
        />
      )}
    </div>
  );
}
