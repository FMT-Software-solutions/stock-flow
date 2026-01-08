import { DataTable } from '@/components/shared/data-table/data-table';
import { StatsContainer } from '@/components/shared/stats/StatsContainer';
import { Button } from '@/components/ui/button';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrders } from '@/hooks/useOrders';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { columns } from './orders/columns';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import {
  getOrderFilterFields,
  getOrderStatsGroups,
  orderExportFields,
} from './orders/fields';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import type { Order } from '@/types/orders';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';

export function Orders() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { formatCurrency } = useCurrency();

  const { data: orders = [], isLoading } = useOrders(
    currentOrganization?.id,
    selectedBranchIds
  );
  const { checkPermission } = useRoleCheck();
  const canCreateOrders = checkPermission('orders', 'create');
  const canExportOrders = checkPermission('orders', 'export');

  const filterFields = useMemo(() => {
    const branches = Array.from(
      new Set(
        orders
          .map((o) => o.branch?.name)
          .filter((name): name is string => !!name)
      )
    ).map((name) => ({
      label: name,
      value: name,
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
    ).map((pm) => {
      const v = pm as string;
      const label = v
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return { label, value: v };
    });

    return getOrderFilterFields(branches, customers, paymentMethods);
  }, [orders]);

  const orderStatsGroups = useMemo(() => getOrderStatsGroups(formatCurrency), [
    formatCurrency,
  ]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [summaryMode, setSummaryMode] = useOrgPreference<'filtered' | 'all'>(
    currentOrganization?.id,
    'orders.summaryMode',
    'filtered'
  );
  const summaryData = summaryMode === 'filtered' ? filteredOrders : orders;

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales & Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory sales and orders
          </p>
        </div>
        {canCreateOrders && (
          <Button
            onClick={() => navigate('/orders/new')}
            className={cn(isLoading && 'opacity-50 cursor-not-allowed')}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Order
          </Button>
        )}
      </div>

      <StatsContainer
        groups={orderStatsGroups}
        data={summaryData}
        storageKey="stockflow-orders-stats-container-is-open"
        summaryLabel="Order Summary"
        orgId={currentOrganization?.id}
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
      />

      <div className={cn(isLoading && 'opacity-50')}>
        <DataTable
          columns={columns}
          data={orders}
          searchKey="orderNumber"
          filterFields={filterFields}
          exportFields={orderExportFields}
          storageKey="stockflow-orders-table"
          canExport={canExportOrders}
          orgId={currentOrganization?.id}
          onRowClick={handleRowClick}
          onFilteredDataChange={(rows) => setFilteredOrders(rows as Order[])}
        />
      </div>
      {selectedOrder && (
        <OrderDetailsModal
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
}
