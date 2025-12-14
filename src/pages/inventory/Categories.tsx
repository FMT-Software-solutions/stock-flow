import { mockCategories } from '@/data/mock-categories';
import { mockProducts } from '@/data/mock-inventory';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useState } from 'react';
import { CategoryDialog } from './CategoryDialog';

export function Categories() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Browse by Category</h2>
          <p className="text-sm text-muted-foreground">
            View products organized by category
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mockCategories.map((category) => {
          const products = mockProducts
            .filter((p) => p.category === category.name)
            .slice(0, 5);

          return (
            <Card
              key={category.id}
              className="overflow-hidden border-none shadow-md flex flex-col pt-0"
            >
              <div className="h-32 w-full bg-muted relative shrink-0">
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <h3 className="text-2xl font-bold text-white shadow-sm">
                    {category.name}
                  </h3>
                </div>
              </div>
              <CardContent className="p-0 flex-1 bg-card">
                <div className="divide-y">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-background">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
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
                  {products.length === 0 && (
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

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
