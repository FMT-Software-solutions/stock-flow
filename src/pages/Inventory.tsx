import { useState } from 'react';
import { DataTable } from '@/components/shared/data-table/data-table';
import { columns, inventoryColumns } from './inventory/columns';
import { Button } from '@/components/ui/button';
import { Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DataTableFilterField } from '@/types/data-table';
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
import type { ExportField } from '@/hooks/useExport';
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

export function Inventory() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { data: products = [], isLoading } = useProducts(
    currentOrganization?.id
  );
  const { data: inventoryEntries = [] } = useInventoryEntries(
    currentOrganization?.id,
    selectedBranchIds
  );
  const { data: categoriesList = [] } = useCategories(currentOrganization?.id);

  const [activeTab, setActiveTab] = useState('inventory');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);
  const [openProductSearch, setOpenProductSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

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

  const inventoryCreators = Array.from(
    new Set(inventoryEntries.map((i) => i.createdByName).filter(Boolean))
  ).map((name) => ({
    label: name as string,
    value: name as string,
  }));

  const filterFields: DataTableFilterField[] = [
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      options: categories,
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: statuses,
    },
    {
      id: 'sellingPrice',
      label: 'Price',
      type: 'number',
    },
    {
      id: 'quantity',
      label: 'Stock',
      type: 'number',
    },
    {
      id: 'createdByName',
      label: 'Created By',
      type: 'select',
      options: productCreators,
    },
    {
      id: 'createdAt',
      label: 'Created At',
      type: 'date-range',
    },
  ];

  const inventoryFilterFields: DataTableFilterField[] = [
    {
      id: 'productName',
      label: 'Product',
      type: 'select',
      options: inventoryProductNames,
    },
    {
      id: 'categoryName',
      label: 'Category',
      type: 'select',
      options: categories,
    },
    {
      id: 'effectivePrice',
      label: 'Price',
      type: 'number',
    },
    {
      id: 'quantity',
      label: 'Stock',
      type: 'number',
    },
    {
      id: 'location',
      label: 'Location',
      type: 'select',
      options: inventoryLocations,
    },
    {
      id: 'createdByName',
      label: 'Created By',
      type: 'select',
      options: inventoryCreators,
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      type: 'date-range',
    },
  ];

  const categoryExportFields: ExportField[] = [
    { id: 'name', label: 'Name' },
    { id: 'description', label: 'Description' },
    { id: 'productCount', label: 'Product Count' },
  ];

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-xs text-muted-foreground">
            Manage your products and stock levels
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-0"
          >
            <TabsList>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="variations">Variations</TabsTrigger>
            </TabsList>
          </Tabs>
          {activeTab === 'products' && (
            <Button onClick={() => navigate('/inventory/new')}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          )}
          {activeTab === 'inventory' && (
            <Popover
              open={openProductSearch}
              onOpenChange={setOpenProductSearch}
            >
              <PopoverTrigger asChild>
                <Button role="combobox" aria-expanded={openProductSearch}>
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
              <ExportDialog
                data={categoriesList}
                fields={categoryExportFields}
                defaultFilename="categories-export"
              />
              <Button onClick={handleCreateCategory}>
                <Plus className="mr-2 h-4 w-4" /> Add Category
              </Button>
            </div>
          )}
          {activeTab === 'variations' && (
            <Button onClick={() => setVariationDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Variation Type
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsContent value="inventory" className="space-y-4">
          <DataTable
            columns={inventoryColumns}
            data={inventoryEntries}
            searchKey="searchable"
            filterFields={inventoryFilterFields}
            storageKey="inventory-entries-table"
            defaultColumnVisibility={{ searchable: false }}
          />
        </TabsContent>
        <TabsContent value="products" className="space-y-4">
          <DataTable
            columns={columns}
            data={products}
            searchKey="name"
            filterFields={filterFields}
            storageKey="inventory-products-table"
          />
        </TabsContent>
        <TabsContent value="categories">
          <Categories onEditCategory={handleEditCategory} />
        </TabsContent>
        <TabsContent value="variations">
          <Variations />
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
