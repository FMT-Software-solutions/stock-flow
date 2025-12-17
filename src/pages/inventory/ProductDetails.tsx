import { useParams, useNavigate } from 'react-router-dom';
import { useProduct, useUpdateProduct } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Edit, Loader2 } from 'lucide-react';
import { ProductVariations, type GeneratedVariant } from './components/ProductVariations';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { ProductInventoryManager } from './product-details/ProductInventoryManager';

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct();

  const [hasVariations, setHasVariations] = useState(false);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (product) {
      setHasVariations(!!product.hasVariations);
      setSelectedImage(product.imageUrl);
      if (product.variants) {
        // Map product variants to GeneratedVariant type if needed
        const mappedVariants: GeneratedVariant[] = product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          quantity: v.quantity || 0,
          attributes: v.attributes,
        }));
        setVariants(mappedVariants);
      }
    }
  }, [product]);

  const handleSaveVariations = async () => {
    if (!product || !currentOrganization) return;
    
    if (hasVariations && variants.length === 0) {
      toast.error('Please configure at least one variation or disable variations');
      return;
    }

    try {
      setIsSaving(true);
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          hasVariations,
          variants: hasVariations ? variants as any : [], // Cast to any to match expected input if types are slightly off
          organizationId: currentOrganization.id,
        },
      });
      toast.success('Variations updated successfully');
    } catch (error) {
      console.error('Failed to update variations:', error);
      toast.error('Failed to update variations');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!product) {
    return <div className="p-8 text-center">Product not found</div>;
  }

  const allImages = [product.imageUrl, ...(product.additionalImages || [])].filter(Boolean) as string[];

  const projectedProfit = product.sellingPrice - product.costPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/inventory')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/inventory/${product.id}/edit`)}
        >
          <Edit className="mr-2 h-4 w-4" /> Edit Product
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Product Details */}
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardHeader >
              <div className='flex justify-between items-center'>
              <CardTitle>Details</CardTitle>
              <Badge variant={product.status === 'published' ? 'default' : 'secondary'}>
                {product.status}
              </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border",
                          selectedImage === img && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedImage(img)}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-muted-foreground">Price</div>
                <div className='font-bold'><CurrencyDisplay amount={product.sellingPrice} /></div>
                
                <div className="font-medium text-muted-foreground">Cost</div>
                <div className='font-bold'><CurrencyDisplay amount={product.costPrice} /></div>

                <div className="font-medium text-muted-foreground">Projected Profit</div>
                <div className='font-bold'><CurrencyDisplay className={cn( projectedProfit > 0 ? 'text-primary' : 'text-red-500')} amount={projectedProfit} /></div>
              </div>
              
                <Separator />

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-muted-foreground">Category</div>
                <div>{product.category?.name || '-'}</div>

                <div className="font-medium text-muted-foreground">Supplier</div>
                <div>{product.supplier?.name || '-'}</div>
              </div>
             

              {product.description && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Variations & Inventory */}
        <div className="space-y-6 md:col-span-2">
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
            </TabsList>

            <TabsContent value="variants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variant Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="has-variations"
                      checked={hasVariations}
                      onCheckedChange={setHasVariations}
                    />
                    <Label htmlFor="has-variations">This product has variations</Label>
                  </div>

                  {hasVariations ? (
                    <>
                      <ProductVariations
                        basePrice={product.sellingPrice}
                        baseSku={product.sku}
                        onChange={setVariants}
                        initialVariants={variants}
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleSaveVariations} 
                          disabled={isSaving || updateProduct.isPending}
                        >
                          {(isSaving || updateProduct.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Variations
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                      Variations are disabled for this product. 
                      <br />
                      Enable them to configure attributes like Color, Size, etc.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Management</CardTitle>
                  <CardDescription>
                    Manage stock levels for each branch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                   <ProductInventoryManager 
                      product={product}
                      variants={variants} 
                      currentOrganizationId={currentOrganization?.id || ''}
                   />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
