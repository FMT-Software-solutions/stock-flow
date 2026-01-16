import { useEffect, useState } from 'react';
import { DataTable } from '@/components/shared/data-table/data-table';
import { columns, inventoryColumns } from './inventory/columns';
import { Button } from '@/components/ui/button';
import { Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Categories } from './inventory/Categories';
import { Variations } from './inventory/Variations';
import { CategoryDialog } from './inventory/CategoryDialog';
import { VariationTypeDialog } from './inventory/VariationTypeDialog';
import {
  useProducts,
  useInventoryEntries,
  useCategories,
} from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import type { Category } from '@/types/inventory';
import { ExportDialog } from '@/components/shared/export/ExportDialog';
import {
  getProductFilterFields,
  productExportFields,
} from './inventory/fields/productFields';
import {
  getInventoryFilterFields,
  inventoryExportFields,
} from './inventory/fields/inventoryFields';
import { getCategoryExportFields } from './inventory/fields/categoryFields';
import { StatsContainer } from '@/components/shared/stats/StatsContainer';
import { getProductStatsGroups } from './inventory/fields/productStats';
import { getInventoryStatsGroups } from './inventory/fields/inventoryStats';
import { useCurrency } from '@/hooks/useCurrency';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { Product, InventoryEntry } from '@/types/inventory';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { CreateDiscountSheet } from './inventory/components/CreateDiscountSheet';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { DiscountManager } from './inventory/DiscountManager';

export function Inventory() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { formatCurrency } = useCurrency();
  const { checkPermission, isOwner } = useRoleCheck();
  const { data: products = [], isLoading } = useProducts(
    currentOrganization?.id
  );
  const { data: inventoryEntries = [] } = useInventoryEntries(
    currentOrganization?.id,
    selectedBranchIds
  );
  const { data: categoriesList = [] } = useCategories(currentOrganization?.id);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);
  const [openProductSearch, setOpenProductSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [createDiscountOpen, setCreateDiscountOpen] = useState(false);

  const canViewInventory = checkPermission('inventory');
  const canViewProducts = checkPermission('products');
  const canViewCategories = checkPermission('product_categories');
  const canViewVariations = checkPermission('variations');
  const canViewDiscounts = checkPermission('discounts');
  const canCreateInventory = checkPermission('inventory', 'create');
  const canCreateProduct = checkPermission('products', 'create');
  const canCreateCategory = checkPermission('product_categories', 'create');
  const canCreateVariation = checkPermission('variations', 'create');
  const canCreateDiscount = checkPermission('discounts', 'create') || isOwner();
  const canExportInventory = checkPermission('inventory', 'export');
  const canExportProducts = checkPermission('products', 'export');
  const canEditCategory = checkPermission('product_categories', 'edit');
  const canExportCategory = checkPermission('product_categories', 'export');

  const availableTabs = [
    canViewInventory ? 'inventory' : null,
    canViewProducts ? 'products' : null,
    canViewCategories ? 'categories' : null,
    canViewVariations ? 'variations' : null,
    canViewDiscounts ? 'discounts' : null,
  ].filter(Boolean) as string[];

  const [activeTab, setActiveTab] = useState<string>(
    availableTabs[0] ?? 'inventory'
  );

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewInventory, canViewProducts, canViewCategories, canViewVariations]);

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

  const inventoryProductNames = Array.from(
    new Set(inventoryEntries.map((i) => i.productName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const inventoryLocations = Array.from(
    new Set(inventoryEntries.map((i) => i.location).filter(Boolean))
  ).map((location) => ({
    label: location as string,
    value: location as string,
  }));

  const inventoryBranches = Array.from(
    new Set(inventoryEntries.map((i) => i.branchName).filter(Boolean))
  ).map((branch) => ({
    label: branch as string,
    value: branch as string,
  }));

  const inventoryCreators = Array.from(
    new Set(inventoryEntries.map((i) => i.createdByName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const filterFields = getProductFilterFields(
    categories,
    statuses,
    productCreators
  );

  const inventoryFilterFields = getInventoryFilterFields(
    inventoryProductNames,
    categories,
    inventoryBranches,
    inventoryLocations,
    inventoryCreators
  );

  const inventoryStatsGroups = getInventoryStatsGroups(
    formatCurrency,
    isOwner()
  );
  const productStatsGroups = getProductStatsGroups(formatCurrency);

  const categoryExportFields = getCategoryExportFields(products);

  const [inventoryFiltered, setInventoryFiltered] = useState<InventoryEntry[]>(
    []
  );
  const [productsFiltered, setProductsFiltered] = useState<Product[]>([]);
  const [inventorySummaryMode, setInventorySummaryMode] = useOrgPreference<
    'filtered' | 'all'
  >(currentOrganization?.id, 'inventory.summaryMode', 'filtered');
  const [productsSummaryMode, setProductsSummaryMode] = useOrgPreference<
    'filtered' | 'all'
  >(currentOrganization?.id, 'products.summaryMode', 'filtered');
  const inventorySummaryData =
    inventorySummaryMode === 'filtered' ? inventoryFiltered : inventoryEntries;
  const productsSummaryData =
    productsSummaryMode === 'filtered' ? productsFiltered : products;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Manage your products and stocks
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-0"
          >
            <TabsList>
              {canViewInventory && (
                <TabsTrigger value="inventory" disabled={isLoading}>
                  Inventory
                </TabsTrigger>
              )}
              {canViewProducts && (
                <TabsTrigger value="products" disabled={isLoading}>
                  Products
                </TabsTrigger>
              )}
              {canViewCategories && (
                <TabsTrigger value="categories" disabled={isLoading}>
                  Categories
                </TabsTrigger>
              )}
              {canViewVariations && (
                <TabsTrigger value="variations" disabled={isLoading}>
                  Variations
                </TabsTrigger>
              )}
              {canViewDiscounts && (
                <TabsTrigger value="discounts" disabled={isLoading}>
                  Discounts
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          {activeTab === 'discounts' && canCreateDiscount && (
            <Button
              onClick={() => setCreateDiscountOpen(true)}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Create Discount
            </Button>
          )}
          {activeTab === 'products' && canCreateProduct && (
            <Button
              onClick={() => navigate('/inventory/new')}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          )}
          {activeTab === 'inventory' && canCreateInventory && (
            <Popover
              open={openProductSearch}
              onOpenChange={setOpenProductSearch}
            >
              <PopoverTrigger asChild>
                <Button
                  role="combobox"
                  aria-expanded={openProductSearch}
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Inventory
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-75 p-0">
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.name}
                          onSelect={() => {
                            setOpenProductSearch(false);
                            navigate(`/inventory/${product.id}`);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4 opacity-0')} />
                          {product.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

      <CreateDiscountSheet
        open={createDiscountOpen}
        onOpenChange={setCreateDiscountOpen}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={cn('space-y-4', {
          'opacity-50 cursor-not-allowed': isLoading,
        })}
      >
        <TabsContent value="inventory" className="space-y-4">
          {canViewInventory && (
            <>
              <StatsContainer
                groups={inventoryStatsGroups}
                data={inventorySummaryData}
                summaryLabel="Inventory Summary"
                storageKey="stockflow-inventory-stats-container-is-open"
                orgId={currentOrganization?.id}
                summaryMode={inventorySummaryMode}
                onSummaryModeChange={setInventorySummaryMode}
              />
              <DataTable
                columns={inventoryColumns}
                data={inventoryEntries}
                searchKey="searchable"
                filterFields={inventoryFilterFields}
                exportFields={inventoryExportFields}
                storageKey="inventory-entries-table"
                defaultColumnVisibility={{
                  searchable: false,
                  branchName: false,
                }}
                canExport={canExportInventory}
                orgId={currentOrganization?.id}
                onFilteredDataChange={(rows) =>
                  setInventoryFiltered(rows as InventoryEntry[])
                }
              />
            </>
          )}
        </TabsContent>
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
        <TabsContent value="discounts">
          {canViewDiscounts && <DiscountManager />}
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
