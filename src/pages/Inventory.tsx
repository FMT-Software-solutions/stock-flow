import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './inventory/columns';
import { mockProducts } from '@/data/mock-inventory';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DataTableFilterField } from '@/types/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Categories } from './inventory/Categories';

export function Inventory() {
  const navigate = useNavigate();

  const categories = Array.from(
    new Set(mockProducts.map((p) => p.category))
  ).map((category) => ({
    label: category,
    value: category,
  }));

  const statuses = Array.from(new Set(mockProducts.map((p) => p.status))).map(
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Manage your products and stock levels
          </p>
        </div>
        <Button onClick={() => navigate('/inventory/new')}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="space-y-4">
          <DataTable
            columns={columns}
            data={mockProducts}
            searchKey="name"
            filterFields={filterFields}
          />
        </TabsContent>
        <TabsContent value="categories">
          <Categories />
        </TabsContent>
      </Tabs>
    </div>
  );
}
