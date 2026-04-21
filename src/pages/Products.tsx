import { useRoleCheck } from '@/components/auth/RoleGuard';
import { DataTable } from '@/components/shared/data-table/data-table';
import { ExportDialog } from '@/components/shared/export/ExportDialog';
import { StatsContainer } from '@/components/shared/stats/StatsContainer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { useCurrency } from '@/hooks/useCurrency';
import { useCategories, useProducts } from '@/hooks/useInventoryQueries';
import type { Category, Product } from '@/types/inventory';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Categories } from './inventory/Categories';
import { CategoryDialog } from './inventory/CategoryDialog';
import { VariationTypeDialog } from './inventory/VariationTypeDialog';
import { Variations } from './inventory/Variations';
import { columns } from './inventory/columns';
import { getCategoryExportFields } from './inventory/fields/categoryFields';
import {
  getProductFilterFields,
  productExportFields,
} from './inventory/fields/productFields';
import { getProductStatsGroups } from './inventory/fields/productStats';
import { cn } from '@/lib/utils';
import { InventoryTabs } from './inventory/components/InventoryTabs';

export function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const { checkPermission } = useRoleCheck();
  const { data: products = [], isLoading } = useProducts(
    currentOrganization?.id
  );
  const { data: categoriesList = [] } = useCategories(currentOrganization?.id);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

  const canViewProducts = checkPermission('products');
  const canViewCategories = checkPermission('product_categories');
  const canViewVariations = checkPermission('variations');
  const canCreateProduct = checkPermission('products', 'create');
  const canCreateCategory = checkPermission('product_categories', 'create');
  const canCreateVariation = checkPermission('variations', 'create');
  const canExportProducts = checkPermission('products', 'export');
  const canEditCategory = checkPermission('product_categories', 'edit');
  const canExportCategory = checkPermission('product_categories', 'export');

  const tabs = [
    { value: 'products', label: 'Products', show: canViewProducts },
    { value: 'categories', label: 'Categories', show: canViewCategories },
    { value: 'variations', label: 'Variations', show: canViewVariations },
  ].filter((t) => t.show);

  const availableTabs = tabs.map((t) => t.value);
  const tabFromUrl = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<string>(
    tabFromUrl && availableTabs.includes(tabFromUrl) 
      ? tabFromUrl 
      : availableTabs[0] ?? 'products'
  );

  useEffect(() => {
    if (tabFromUrl && availableTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    } else if (!availableTabs.includes(activeTab)) {
      const fallback = availableTabs[0] ?? 'products';
      setActiveTab(fallback);
      if (tabFromUrl) {
        setSearchParams({ tab: fallback }, { replace: true });
      }
    }
  }, [tabFromUrl, activeTab, availableTabs, setSearchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value }, { replace: true });
  };

  const handleCreateCategory = () => {
    setSelectedCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryDialogOpen(true);
  };

  const categories = Array.from(
    new Set(products.map((p) => p.category?.name).filter(Boolean))
  ).map((category) => ({
    label: category as string,
    value: category as string,
  }));

  const statuses = Array.from(new Set(products.map((p) => p.status))).map(
    (status) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1),
      value: status,
    })
  );

  const productCreators = Array.from(
    new Set(products.map((p) => p.createdByName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const filterFields = getProductFilterFields(
    categories,
    statuses,
    productCreators
  );

  const productStatsGroups = getProductStatsGroups(formatCurrency);

  const categoryExportFields = getCategoryExportFields(products);

  const [productsFiltered, setProductsFiltered] = useState<Product[]>([]);
  const [productsSummaryMode, setProductsSummaryMode] = useOrgPreference<
    'filtered' | 'all'
  >(currentOrganization?.id, 'products.summaryMode', 'filtered');
  const productsSummaryData =
    productsSummaryMode === 'filtered' ? productsFiltered : products;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog, categories and variations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <InventoryTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isLoading={isLoading}
            tabs={tabs}
          />

          {activeTab === 'products' && canCreateProduct && (
            <Button
              onClick={() => navigate('/products/new')}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          )}

          {activeTab === 'categories' && (
            <div className="flex items-center gap-2">
              {canExportCategory && (
                <ExportDialog
                  data={categoriesList}
                  fields={categoryExportFields}
                  defaultFilename="categories-export"
                />
              )}
              {canCreateCategory && (
                <Button onClick={handleCreateCategory} disabled={isLoading}>
                  <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
              )}
            </div>
          )}
          {activeTab === 'variations' && canCreateVariation && (
            <Button
              onClick={() => setVariationDialogOpen(true)}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Variation Type
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className={cn('space-y-4', {
          'opacity-50 cursor-not-allowed': isLoading,
        })}
      >
        <TabsContent value="products" className="space-y-6">
          {canViewProducts && (
            <>
              <StatsContainer
                groups={productStatsGroups}
                data={productsSummaryData}
                summaryLabel="Product Summary"
                storageKey="stockflow-products-stats-container-is-open"
                orgId={currentOrganization?.id}
                summaryMode={productsSummaryMode}
                onSummaryModeChange={setProductsSummaryMode}
              />
              <DataTable
                columns={columns}
                data={products}
                searchKey="searchable"
                filterFields={filterFields}
                exportFields={productExportFields}
                storageKey="inventory-products-table"
                defaultColumnVisibility={{ searchable: false }}
                canExport={canExportProducts}
                orgId={currentOrganization?.id}
                onFilteredDataChange={(rows) =>
                  setProductsFiltered(rows as Product[])
                }
              />
            </>
          )}
        </TabsContent>
        <TabsContent value="categories">
          {canViewCategories && (
            <Categories
              onEditCategory={canEditCategory ? handleEditCategory : undefined}
            />
          )}
        </TabsContent>
        <TabsContent value="variations">
          {canViewVariations && <Variations />}
        </TabsContent>
      </Tabs>

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={selectedCategory}
      />
      <VariationTypeDialog
        open={variationDialogOpen}
        onOpenChange={setVariationDialogOpen}
      />
    </div>
  );
}
