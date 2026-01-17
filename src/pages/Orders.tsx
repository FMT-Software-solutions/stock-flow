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
import type { Order } from '@/types/orders';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { endOfDay, startOfDay, subDays, subMonths, subYears } from 'date-fns';
import type { DataLookback, UserPermissions } from '@/modules/permissions';
import type { DateRange } from 'react-day-picker';

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

  const userPermissions = useMemo<UserPermissions | undefined>(() => {
    if (!currentOrganization?.permissions) return undefined;
    try {
      return JSON.parse(currentOrganization.permissions) as UserPermissions;
    } catch {
      return undefined;
    }
  }, [currentOrganization?.permissions]);

  const maxLookback = useMemo<DataLookback>(() => {
    if (currentOrganization?.user_role === 'owner') {
      return { unit: 'forever' };
    }
    return (
      userPermissions?.orders?.dataAccess?.maxLookback ?? {
        unit: 'months',
        value: 1,
      }
    );
  }, [currentOrganization?.user_role, userPermissions]);

  const { minDate, maxDate } = useMemo(() => {
    const now = new Date();
    const max = endOfDay(now);

    if (maxLookback.unit === 'forever') {
      return { minDate: undefined, maxDate: max };
    }

    const value = maxLookback.value;
    const rawMin =
      maxLookback.unit === 'days'
        ? subDays(now, value)
        : maxLookback.unit === 'months'
        ? subMonths(now, value)
        : subYears(now, value);

    return { minDate: startOfDay(rawMin), maxDate: max };
  }, [maxLookback]);

  const defaultDateRange = useMemo<DateRange>(() => {
    const now = new Date();
    const baseFrom = startOfDay(subMonths(now, 1));
    const baseTo = endOfDay(now);
    const clampedFrom = minDate && baseFrom < minDate ? minDate : baseFrom;
    return { from: clampedFrom, to: baseTo };
  }, [minDate]);

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

    return getOrderFilterFields(branches, customers, paymentMethods, {
      minDate,
      maxDate,
      defaultValue: minDate ? defaultDateRange : undefined,
    });
  }, [defaultDateRange, maxDate, minDate, orders]);

  const orderStatsGroups = useMemo(() => getOrderStatsGroups(formatCurrency), [
    formatCurrency,
  ]);

  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [summaryMode, setSummaryMode] = useOrgPreference<'filtered' | 'all'>(
    currentOrganization?.id,
    'orders.summaryMode',
    'filtered'
  );
  const summaryData = minDate
    ? filteredOrders
    : summaryMode === 'filtered'
    ? filteredOrders
    : orders;

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
        summaryMode={minDate ? undefined : summaryMode}
        onSummaryModeChange={minDate ? undefined : setSummaryMode}
      />

      <div className={cn(isLoading && 'opacity-50')}>
        <DataTable
          key={`${currentOrganization?.id ?? 'no-org'}-${
            minDate?.toISOString() ?? 'no-min'
          }`}
          columns={columns}
          data={orders}
          searchKey="orderNumber"
          filterFields={filterFields}
          exportFields={orderExportFields}
          storageKey="stockflow-orders-table"
          canExport={canExportOrders}
          orgId={currentOrganization?.id}
          defaultColumnFilters={[{ id: 'date', value: defaultDateRange }]}
          onFilteredDataChange={(rows) => setFilteredOrders(rows as Order[])}
        />
      </div>
    </div>
  );
}
