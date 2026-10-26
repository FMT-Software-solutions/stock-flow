import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, ReceiptText, Settings2, Tag } from 'lucide-react';
import {
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrgArrayPreference } from '@/hooks/preferences/useOrgArrayPreference';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { DataLookback, UserPermissions } from '@/modules/permissions';
import { useAiSummary, useDashboardSummary } from '@/hooks/useDashboardSummary';
import { AddExpenseDialog } from './expenses/AddExpenseDialog';
import { buildPeriod } from './dashboard/period';
import { useChartData } from './dashboard/useChartData';
import {
  AiSummaryCard,
  BranchesCard,
  CountsStrip,
  KpiTiles,
  NeedsAttention,
  PaymentsCard,
  RecentSales,
  SalesChart,
  TopProducts,
} from './dashboard/DashboardSections';

// --- Types ---

type SectionId =
  | 'summary'
  | 'figures'
  | 'chart'
  | 'attention'
  | 'top_products'
  | 'payments'
  | 'branches'
  | 'recent'
  | 'counts';

type DashboardDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'last_7_days'
  | 'last_30_days'
  | 'all_time';

const ALL_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'figures', label: 'Key figures' },
  { id: 'chart', label: 'Sales chart' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'top_products', label: 'Top products' },
  { id: 'payments', label: 'Payments received' },
  { id: 'branches', label: 'Branches' },
  { id: 'recent', label: 'Recent sales' },
  { id: 'counts', label: 'Counts' },
];

const greeting = (now: Date) => {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function Dashboard() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { user } = useAuth();
  const { formatCurrency, currency } = useCurrency();
  const { selectedBranchIds, availableBranches } = useBranchContext();
  const { checkPermission } = useRoleCheck();
  const [expenseOpen, setExpenseOpen] = useState(false);

  const [visibleSections, setVisibleSections] = useOrgArrayPreference<SectionId>(
    orgId,
    'dashboard.sections.v2',
    ALL_SECTIONS.map((s) => s.id)
  );
  const [summaryOpen, setSummaryOpen] = useOrgPreference<boolean>(orgId, 'dashboard.summaryOpen', false);
  const [defaultDatePreset, setDefaultDatePreset] = useOrgPreference<DashboardDatePreset>(
    orgId,
    'dashboard.defaultDatePreset',
    'this_month'
  );

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
      userPermissions?.dashboard?.dataAccess?.maxLookback ?? {
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

  const effectiveDatePreset = useMemo<DashboardDatePreset>(() => {
    if (defaultDatePreset === 'all_time' && maxLookback.unit !== 'forever') {
      return 'this_month';
    }
    return defaultDatePreset;
  }, [defaultDatePreset, maxLookback.unit]);

  const datePresetOptions = useMemo(() => {
    const options: Array<{ value: DashboardDatePreset; label: string }> = [
      { value: 'today', label: 'Today' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' },
      { value: 'this_year', label: 'This Year' },
      { value: 'last_7_days', label: 'Last 7 Days' },
      { value: 'last_30_days', label: 'Last 30 Days' },
    ];
    if (maxLookback.unit === 'forever') {
      options.push({ value: 'all_time', label: 'All Time' });
    }
    return options;
  }, [maxLookback.unit]);

  const buildPresetRange = useCallback(
    (preset: DashboardDatePreset): DateRange | undefined => {
      if (preset === 'all_time' && maxLookback.unit === 'forever') {
        return undefined;
      }

      const now = new Date();
      const to = endOfDay(now);
      let from = startOfMonth(now);

      if (preset === 'today') {
        from = startOfDay(now);
      } else if (preset === 'this_week') {
        from = startOfWeek(now);
      } else if (preset === 'this_year') {
        from = startOfYear(now);
      } else if (preset === 'last_7_days') {
        from = startOfDay(subDays(now, 6));
      } else if (preset === 'last_30_days') {
        from = startOfDay(subDays(now, 29));
      }

      const clampedFrom = minDate && from < minDate ? minDate : from;
      const clampedTo = maxDate && to > maxDate ? maxDate : to;

      if (clampedTo < clampedFrom) {
        return { from: clampedFrom, to: clampedFrom };
      }
      return { from: clampedFrom, to: clampedTo };
    },
    [maxLookback.unit, minDate, maxDate]
  );

  const defaultDateRange = useMemo<DateRange | undefined>(
    () => buildPresetRange(effectiveDatePreset),
    [buildPresetRange, effectiveDatePreset]
  );

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);

  useEffect(() => {
    if (defaultDatePreset !== effectiveDatePreset) {
      setDefaultDatePreset(effectiveDatePreset);
    }
  }, [defaultDatePreset, effectiveDatePreset, setDefaultDatePreset]);

  useEffect(() => {
    setDateRange(defaultDateRange);
  }, [defaultDateRange]);

  useEffect(() => {
    setDateRange((prev) => {
      if (maxLookback.unit === 'forever' && prev === undefined) return prev;
      if (!prev?.from || !prev?.to) return defaultDateRange;
      if (!defaultDateRange && maxLookback.unit === 'forever') return prev;
      if (!minDate) return prev;

      const nextFrom = prev.from < minDate ? minDate : prev.from;
      const nextTo = prev.to;
      if (nextFrom === prev.from) return prev;
      return nextTo < nextFrom ? { from: nextFrom, to: nextFrom } : { from: nextFrom, to: nextTo };
    });
  }, [defaultDateRange, maxLookback.unit, minDate]);

  const handleGlobalDateChange = (next: DateRange | undefined) => {
    // The picker's "All Time" preset sends no range; clearing goes through onClear.
    if (!next) {
      setDateRange(maxLookback.unit === 'forever' ? undefined : defaultDateRange);
      return;
    }
    if (!next.from) {
      setDateRange(defaultDateRange);
      return;
    }

    const normalizedFrom = startOfDay(next.from);
    const normalizedTo = endOfDay(next.to ?? next.from);

    const clampedFrom = minDate && normalizedFrom < minDate ? minDate : normalizedFrom;
    const clampedTo = maxDate && normalizedTo > maxDate ? maxDate : normalizedTo;

    setDateRange(
      clampedTo < clampedFrom
        ? { from: clampedFrom, to: clampedFrom }
        : { from: clampedFrom, to: clampedTo }
    );
  };

  // --- Data ---

  const period = useMemo(() => buildPeriod(dateRange, new Date(), minDate), [dateRange, minDate]);
  const summary = useDashboardSummary(orgId, selectedBranchIds, period);
  const data = summary.data;
  const loading = summary.isFetching;

  const branchLabel =
    selectedBranchIds.length === 0 || selectedBranchIds.length >= availableBranches.length
      ? 'All branches'
      : availableBranches
          .filter((b) => selectedBranchIds.includes(b.id))
          .map((b) => b.name)
          .join(', ');

  const ai = useAiSummary(
    { organizationId: orgId, branchIds: selectedBranchIds, branchLabel, period, currency },
    summaryOpen && visibleSections.includes('summary')
  );

  const chartData = useChartData(period, data?.first_sale, data?.series ?? [], data?.previous_series ?? []);
  const netSeries = useMemo(() => chartData.map((r) => r.net), [chartData]);
  const orderSeries = useMemo(() => chartData.map((r) => r.orders), [chartData]);

  const toggleSection = (id: SectionId) =>
    setVisibleSections(
      visibleSections.includes(id) ? visibleSections.filter((s) => s !== id) : [...visibleSections, id]
    );
  const show = (id: SectionId) => visibleSections.includes(id);

  const now = new Date();
  const firstName = user?.profile?.first_name?.trim();
  const canSell = checkPermission('orders', 'create');
  const canAddProduct = checkPermission('products', 'create');
  const canStock = checkPermission('inventory', 'edit') || checkPermission('inventory', 'create');
  const canExpense = checkPermission('expenses', 'create');

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            {format(now, 'EEEE, d MMMM')} · {branchLabel}
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange
            date={dateRange}
            setDate={handleGlobalDateChange}
            disabled={loading}
            minDate={minDate}
            maxDate={maxDate}
            onClear={() => setDateRange(defaultDateRange)}
            className="md:min-w-75 [&>button]:h-8 [&>button]:text-xs overflow-hidden"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Customize dashboard" className="h-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Default period</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <Select value={effectiveDatePreset} onValueChange={(value) => setDefaultDatePreset(value as DashboardDatePreset)}>
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {datePresetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              {ALL_SECTIONS.map((section) => (
                <DropdownMenuCheckboxItem
                  key={section.id}
                  checked={show(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {section.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick actions */}
      {(canSell || canStock || canAddProduct || canExpense) && (
        <div className="flex flex-wrap gap-2">
          {canSell && (
            <Button asChild className="h-10">
              <Link to="/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                New sale
              </Link>
            </Button>
          )}
          {canStock && (
            <Button asChild variant="outline" className="h-10">
              <Link to="/inventory">
                <Package className="mr-2 h-4 w-4" />
                Add stock
              </Link>
            </Button>
          )}
          {canAddProduct && (
            <Button asChild variant="outline" className="h-10">
              <Link to="/products/new">
                <Tag className="mr-2 h-4 w-4" />
                Add product
              </Link>
            </Button>
          )}
          {canExpense && (
            <AddExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <Button variant="outline" className="h-10">
                <ReceiptText className="mr-2 h-4 w-4" />
                Record expense
              </Button>
            </AddExpenseDialog>
          )}
        </div>
      )}

      {summary.error && (
        <p className="text-sm text-destructive">{(summary.error as Error).message || 'Could not load the dashboard'}</p>
      )}

      {show('summary') && (
        <AiSummaryCard
          open={summaryOpen}
          onToggle={() => setSummaryOpen(!summaryOpen)}
          summary={ai.query.data}
          loading={ai.query.isFetching}
          refreshing={ai.refresh.isPending}
          error={((ai.refresh.error ?? ai.query.error) as Error | null)?.message}
          onRefresh={() => ai.refresh.mutate()}
        />
      )}

      {show('figures') && (
        <KpiTiles
          current={data?.current}
          previous={data?.previous}
          prevLabel={period.prevLabel}
          netSeries={netSeries}
          orderSeries={orderSeries}
          money={formatCurrency}
          loading={loading}
        />
      )}

      {(show('chart') || show('attention')) && (
        <div className="flex flex-wrap gap-3">
          {show('chart') && <SalesChart period={period} data={chartData} money={formatCurrency} loading={loading} />}
          {show('attention') && <NeedsAttention attention={data?.attention} money={formatCurrency} loading={loading} />}
        </div>
      )}

      {(show('top_products') || show('payments') || show('branches')) && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
          {show('top_products') && <TopProducts items={data?.top_products} money={formatCurrency} loading={loading} />}
          {show('payments') && <PaymentsCard items={data?.payments} money={formatCurrency} loading={loading} />}
          {show('branches') && (
            <BranchesCard items={data?.branches} expenses={data?.current.expenses} money={formatCurrency} loading={loading} />
          )}
        </div>
      )}

      {show('recent') && <RecentSales items={data?.recent} money={formatCurrency} loading={loading} />}

      {show('counts') && <CountsStrip counts={data?.counts} />}
    </div>
  );
}
