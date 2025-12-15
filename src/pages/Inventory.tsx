import { useState } from 'react';
import { DataTable } from '@/components/shared/data-table/data-table';
import { columns, inventoryColumns } from './inventory/columns';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DataTableFilterField } from '@/types/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Categories } from './inventory/Categories';
import { Variations } from './inventory/Variations';
import { CategoryDialog } from './inventory/CategoryDialog';
import { VariationTypeDialog } from './inventory/VariationTypeDialog';
import { useProducts, useInventoryEntries } from '@/hooks/useInventoryQueries';
import { useOrganization } from '@/contexts/OrganizationContext';

export function Inventory() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { data: products = [], isLoading } = useProducts(
    currentOrganization?.id
  );
  const { data: inventoryEntries = [] } = useInventoryEntries(
    currentOrganization?.id
  );
  const [activeTab, setActiveTab] = useState('products');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);

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
      id: 'createdAt',
      label: 'Created At',
      type: 'date-range',
    },
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
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
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
            <Button onClick={() => navigate('/inventory/stock/new')}>
              <Plus className="mr-2 h-4 w-4" /> Add Inventory
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button onClick={() => setCategoryDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
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
        <TabsContent value="products" className="space-y-4">
          <DataTable
            columns={columns}
            data={products}
            searchKey="name"
            filterFields={filterFields}
          />
        </TabsContent>
        <TabsContent value="inventory" className="space-y-4">
          <DataTable
            columns={inventoryColumns}
            data={inventoryEntries}
            searchKey="productName"
          />
        </TabsContent>
        <TabsContent value="categories">
          <Categories />
        </TabsContent>
        <TabsContent value="variations">
          <Variations />
        </TabsContent>
      </Tabs>

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
      <VariationTypeDialog
        open={variationDialogOpen}
        onOpenChange={setVariationDialogOpen}
      />
    </div>
  );
}
