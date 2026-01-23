import { Card, CardContent } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useCategories, useProducts } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ImagePreview } from '@/components/shared/ImagePreview';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import type { Category } from '@/types/inventory';

interface CategoriesProps {
  onEditCategory?: (category: Category) => void;
}

export function Categories({ onEditCategory }: CategoriesProps) {
  const { currentOrganization } = useOrganization();
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
  } = useCategories(currentOrganization?.id);
  const { data: products = [] } = useProducts(currentOrganization?.id);

  if (isLoadingCategories) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const categoryProducts = products
            .filter((p) => p.categoryId === category.id)
            .slice(0, 5);

          return (
            <Card
              key={category.id}
              className="overflow-hidden border-none shadow-md flex flex-col pt-0 group relative"
            >
              <div className="h-32 w-full bg-muted relative shrink-0">
                {category.image && (
                  <ImagePreview
                    src={category.image}
                    alt={category.name}
                    className="h-full w-full object-cover opacity-80"
                  />
                )}

                {onEditCategory && (
                  <div className="absolute top-2 right-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCategory(category);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                  <h3 className="text-2xl font-bold text-white shadow-sm">
                    {category.name}
                  </h3>
                </div>
              </div>
              <CardContent className="p-0 flex-1 bg-card">
                <div className="divide-y">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-background">
                        {product.imageUrl && (
                          <ImagePreview
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {product.name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          from{' '}
                          <CurrencyDisplay
                            amount={product.sellingPrice}
                            className="font-semibold text-foreground"
                          />
                        </p>
                      </div>
                    </div>
                  ))}
                  {categoryProducts.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No products found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
