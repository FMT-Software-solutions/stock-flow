import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './orders/columns';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { getOrderFilterFields, orderExportFields } from './orders/fields';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export function Orders() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds, availableBranches } = useBranchContext();

  const { data: orders = [], isLoading } = useOrders(
    currentOrganization?.id,
    selectedBranchIds
  );

  const filterFields = useMemo(() => {
    const branches = availableBranches.map((b) => ({
      label: b.name,
      value: b.name,
    }));

    const customers = Array.from(
      new Set(
        orders
          .map((o) => {
            const c = o.customer;
            if (!c) return null;
            return (
              `${c.first_name || ''} ${c.last_name || ''}`.trim() ||
              c.email ||
              'Guest'
            );
          })
          .filter(Boolean)
      )
    ).map((name) => ({
      label: name as string,
      value: name as string,
    }));

    const paymentMethods = Array.from(
      new Set(orders.map((o) => o.payment_method).filter(Boolean))
    ).map((pm) => ({
      label: (pm as string).charAt(0).toUpperCase() + (pm as string).slice(1),
      value: pm as string,
    }));

    return getOrderFilterFields(branches, customers, paymentMethods);
  }, [availableBranches, orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales & Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory sales and orders
          </p>
        </div>
        <Button
          onClick={() => navigate('/orders/new')}
          className={cn(isLoading && 'opacity-50 cursor-not-allowed')}
        >
          <Plus className="mr-2 h-4 w-4" /> Create Order
        </Button>
      </div>

      <div className={cn(isLoading && 'opacity-50')}>
        <DataTable
          columns={columns}
          data={orders}
          searchKey="orderNumber"
          filterFields={filterFields}
          exportFields={orderExportFields}
          storageKey="orders-table"
        />
      </div>
    </div>
  );
}
