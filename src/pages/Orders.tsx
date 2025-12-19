import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './orders/columns';
import { mockOrders } from '@/data/mock-orders';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Orders() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales & Orders</h1>
          <p className="text-xs text-muted-foreground">
            Manage inventory sales and orders
          </p>
        </div>
        <Button onClick={() => navigate('/orders/new')}>
          <Plus className="mr-2 h-4 w-4" /> Create Order
        </Button>
      </div>

      <DataTable columns={columns} data={mockOrders} searchKey="customerName" />
    </div>
  );
}
