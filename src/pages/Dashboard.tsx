import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Box,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useDashboardStats,
  type InventoryStats,
  type ProductStats,
  type SalesStats,
  type ExpenseStats,
  type CustomerStats,
  type SupplierStats,
  type UserStats,
  type BranchStats,
  type TrendData,
} from '@/hooks/useDashboardStats';
import type { StatsGroup } from '@/types/stats';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setOrgKV } from '@/lib/dexie';
import { useOrgArrayPreference } from '@/hooks/preferences/useOrgArrayPreference';
import { useProducts, useInventoryEntries } from '@/hooks/useInventoryQueries';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import type { DataLookback, UserPermissions } from '@/modules/permissions';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- Types ---
type SectionId =
  | 'inventory'
  | 'products'
  | 'sales'
  | 'expenses'
  | 'customers'
  | 'suppliers'
  | 'users'
  | 'branches'
  | 'low_stock';

interface DashboardSection {
  id: SectionId;
  label: string;
}

type DashboardDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'last_7_days'
  | 'last_30_days'
  | 'all_time';

const ALL_SECTIONS: DashboardSection[] = [
  { id: 'inventory', label: 'Inventory Stats' },
  { id: 'products', label: 'Product Stats' },
  { id: 'sales', label: 'Sales & Orders' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'customers', label: 'Customers' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'users', label: 'Users' },
  { id: 'branches', label: 'Branches' },
  { id: 'low_stock', label: 'Low Stock Items' },
];

function ChartSection({
  data,
  dataKey,
  color,
  type = 'area',
  currency = false,
  formatCurrency,
}: {
  data: TrendData[];
  dataKey: string;
  color: string;
  type?: 'area' | 'bar';
  currency?: boolean;
  formatCurrency?: (val: number) => string;
}) {
  if (!data || data.length === 0) return null;

  const formatValue = (value: unknown) => {
    if (!currency || !formatCurrency) return value;
    return typeof value === 'number' ? formatCurrency(value) : value;
  };

  const formatTick = (value: unknown) => {
    const formatted = formatValue(value);
    return typeof formatted === 'string' ? formatted : String(formatted);
  };

  return (
    <div className="w-full mt-4">
      <ResponsiveContainer width="100%" height={200}>
        {type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => formatTick(val)}
            />
            <Tooltip
              formatter={(val) => formatValue(val) as string | number}
              labelStyle={{ color: 'black' }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#color-${dataKey})`}
            />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => formatTick(val)}
            />
            <Tooltip
              formatter={(val) => formatValue(val) as string | number}
              cursor={{ fill: 'transparent' }}
              labelStyle={{ color: 'black' }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Wrapper for a Dashboard Card Section
function DashboardMetricCard<TData>({
  title,
  groups,
  data,
  chart,
  className,
  loading,
}: {
  title: string;
  groups: StatsGroup<TData>[];
  data: TData[];
  chart?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <Card className={cn('w-full flex flex-col', loading && 'opacity-60', className)}>
      <CardHeader className="flex flex-column md:flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className={cn('grid gap-4', loading && 'pointer-events-none')}>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group) => (
              <div key={group.id} className="grid grid-cols-2 gap-4">
                {group.fields.map(field => {
                  const result = field.calculate(data);
                  const Icon = field.icon;
                  return (
                    <div key={field.id} className="flex flex-col space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {Icon && <Icon className="h-3 w-3" />}
                        {field.label}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-sm sm:text-base md:text-xl font-bold", field.className)}>
                          {result.value}
                        </span>
                        {result.subValue && (
                          <span className="text-xs text-muted-foreground">
                            {result.subValue}
                          </span>
                        )}
                      </div>
                      {result.trendValue && (
                        <span className={cn(
                          "text-xs font-medium",
                          result.trend === 'up' ? "text-green-600" :
                            result.trend === 'down' ? "text-red-600" : "text-muted-foreground"
                        )}>
                          {result.trendValue}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {/* Chart Section */}
          {chart}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const { selectedBranchIds } = useBranchContext();

  // Visibility State
  const [visibleSections, setVisibleSections] = useOrgArrayPreference<SectionId>(
    currentOrganization?.id,
    'dashboard.visibleSections',
    ALL_SECTIONS.map(s => s.id)
  );
  const [defaultDatePreset, setDefaultDatePreset] = useOrgPreference<DashboardDatePreset>(
    currentOrganization?.id,
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
    if (!next) {
      setDateRange(defaultDateRange);
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

  // --- Queries ---
  const stats = useDashboardStats({
    organizationId: currentOrganization?.id,
    branchIds: selectedBranchIds,
    dateRange,
  });

  // Low stock query
  const { data: allProducts = [] } = useProducts(currentOrganization?.id);
  const { data: inventoryEntries = [] } = useInventoryEntries(currentOrganization?.id, selectedBranchIds, true);

  const lowStockProducts = useMemo(() => {
    return allProducts
      .filter(p => {
        const threshold = Number(p.minStockLevel ?? 0);
        return p.quantity <= 0 || p.quantity <= threshold;
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [allProducts]);

  const lowStockInventories = useMemo(() => {
    return inventoryEntries
      .filter(i => {
        const threshold = Number(i.minStockLevel ?? 0);
        return i.quantity <= 0 || i.quantity <= threshold;
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventoryEntries]);

  // --- Stats Groups Definitions ---

  const inventoryGroups: StatsGroup<InventoryStats>[] = [
    {
      id: 'inventory-main',
      title: 'Inventory Overview',
      fields: [
        {
          id: 'total_items',
          label: 'Total Items',
          calculate: (data) => ({ value: data[0]?.total_items ?? 0 }),
        },
        {
          id: 'low_stock',
          label: 'Low Stock',
          calculate: (data) => ({
            value: data[0]?.low_stock_items ?? 0,
            trend: (data[0]?.low_stock_items ?? 0) > 0 ? 'down' : 'neutral',
            trendValue: (data[0]?.low_stock_items ?? 0) > 0 ? 'Action needed' : undefined
          }),
          className: 'text-orange-500',
        },
        {
          id: 'out_of_stock',
          label: 'Out of Stock',
          calculate: (data) => ({
            value: data[0]?.out_of_stock_items ?? 0,
            trend: (data[0]?.out_of_stock_items ?? 0) > 0 ? 'down' : 'neutral',
            trendValue: (data[0]?.out_of_stock_items ?? 0) > 0 ? 'Critical' : undefined
          }),
          className: 'text-red-500',
        },
      ],
    },
  ];

  const productGroups: StatsGroup<ProductStats>[] = [
    {
      id: 'products-main',
      title: 'Product Catalog',
      fields: [
        {
          id: 'total',
          label: 'Total Products',
          calculate: (data) => ({ value: data[0]?.total_products ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_products ?? 0 }),
        },
        {
          id: 'top_cat',
          label: 'Top Category',
          calculate: (data) => ({
            value: data[0]?.top_categories?.[0]?.category ?? '-',
            subValue: data[0]?.top_categories?.[0] ? `${data[0].top_categories[0].count} items` : undefined
          }),
        },
      ],
    },
  ];

  const salesGroups: StatsGroup<SalesStats>[] = [
    {
      id: 'sales-main',
      title: 'Sales & Revenue',
      cardVariant: 'glass',
      fields: [
        {
          id: 'revenue',
          label: 'Total Revenue',
          calculate: (data) => ({ value: formatCurrency(data[0]?.total_revenue ?? 0) }),
          className: 'text-green-600',
        },
        {
          id: 'owings',
          label: 'Owings',
          calculate: (data) => ({ value: formatCurrency(data[0]?.owings ?? 0) }),
          className: 'text-amber-600',
        },
        {
          id: 'refunds',
          label: 'Refunds',
          calculate: (data) => ({ value: formatCurrency(data[0]?.refunds ?? 0) }),
          className: 'text-red-600',
        },
        {
          id: 'orders',
          label: 'Total Orders',
          calculate: (data) => ({ value: data[0]?.total_orders ?? 0 }),
        },
        {
          id: 'completed',
          label: 'Completed',
          calculate: (data) => ({ value: data[0]?.breakdown?.completed ?? 0 }),
        },
        {
          id: 'pending',
          label: 'Pending',
          calculate: (data) => ({ value: data[0]?.breakdown?.pending ?? 0 }),
        },
      ],
    },
  ];

  const expenseGroups: StatsGroup<ExpenseStats>[] = [
    {
      id: 'expenses-main',
      title: 'Expenditure',
      fields: [
        {
          id: 'total_exp',
          label: 'Total Expenses',
          calculate: (data) => ({ value: formatCurrency(data[0]?.total_expenditure ?? 0) }),
          className: 'text-red-600',
        },
        {
          id: 'records',
          label: 'Records',
          calculate: (data) => ({ value: data[0]?.total_records ?? 0 }),
        },
        {
          id: 'top_cat',
          label: 'Top Category',
          calculate: (data) => ({
            value: data[0]?.top_category?.category ?? '-',
            subValue: data[0]?.top_category ? formatCurrency(data[0].top_category.amount) : undefined
          }),
        },
      ],
    },
  ];

  const customerGroups: StatsGroup<CustomerStats>[] = [
    {
      id: 'customers-main',
      title: 'Customers',
      cardVariant: 'glass',
      fields: [
        {
          id: 'total',
          label: 'Total Customers',
          calculate: (data) => ({ value: data[0]?.total_customers ?? 0 }),
        },
        {
          id: 'new',
          label: 'New (Period)',
          calculate: (data) => ({ value: data[0]?.new_this_period ?? 0 }),
          className: 'text-blue-500',
        },
      ],
    },
  ];

  const supplierGroups: StatsGroup<SupplierStats>[] = [
    {
      id: 'suppliers-main',
      title: 'Suppliers',
      fields: [
        {
          id: 'total',
          label: 'Total Suppliers',
          calculate: (data) => ({ value: data[0]?.total_suppliers ?? 0 }),
        },
      ],
    },
  ];

  const userGroups: StatsGroup<UserStats>[] = [
    {
      id: 'users-main',
      title: 'Users',
      fields: [
        {
          id: 'total',
          label: 'Total Users',
          calculate: (data) => ({ value: data[0]?.total_users ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_users ?? 0 }),
          className: 'text-green-600',
        },
        {
          id: 'inactive',
          label: 'Inactive',
          calculate: (data) => ({ value: data[0]?.inactive_users ?? 0 }),
          className: 'text-gray-500',
        },
      ],
    },
  ];

  const branchGroups: StatsGroup<BranchStats>[] = [
    {
      id: 'branches-main',
      title: 'Branches',
      fields: [
        {
          id: 'total',
          label: 'Total Branches',
          calculate: (data) => ({ value: data[0]?.total_branches ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_branches ?? 0 }),
          className: 'text-green-600',
        },
      ],
    },
  ];

  const toggleSection = (id: SectionId) => {
    setVisibleSections(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      const orgId = currentOrganization?.id;
      if (orgId) {
        setOrgKV<SectionId[]>(orgId, 'dashboard.visibleSections', next).catch(() => { });
      }
      return next;
    });
  };

  const isDashboardRangeLoading =
    stats.sales.isFetching || stats.expenses.isFetching || stats.customers.isFetching;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your organization's performance.</p>
        </div>

        <div className="flex items-center gap-2">
          <DatePickerWithRange
            date={dateRange}
            setDate={handleGlobalDateChange}
            disabled={isDashboardRangeLoading}
            minDate={minDate}
            maxDate={maxDate}
            onClear={() => setDateRange(defaultDateRange)}
            className="md:min-w-75 [&>button]:h-8 [&>button]:text-xs overflow-hidden"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Customize Dashboard" className='h-8'>
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Default Date Preset</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <Select
                  value={effectiveDatePreset}
                  onValueChange={(value) =>
                    setDefaultDatePreset(value as DashboardDatePreset)
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Select default" />
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
              <DropdownMenuLabel>Visible Sections</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_SECTIONS.map((section) => (
                <DropdownMenuCheckboxItem
                  key={section.id}
                  checked={visibleSections.includes(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                >
                  {section.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

        {/* Row 1: Sales & Expenses */}
        {visibleSections.includes('sales') && (
          <DashboardMetricCard
            title="Sales"
            className="lg:col-span-2"
            groups={salesGroups}
            data={stats.sales.data ? [stats.sales.data] : ([] as SalesStats[])}
            loading={stats.sales.isFetching}
            chart={
              <ChartSection
                data={(stats.sales.data?.trend ?? []) as TrendData[]}
                dataKey="value"
                color="#16a34a"
                currency
                formatCurrency={formatCurrency}
              />
            }
          />
        )}

        {visibleSections.includes('expenses') && (
          <DashboardMetricCard
            title="Expenses"
            className="lg:col-span-2"
            groups={expenseGroups}
            data={stats.expenses.data ? [stats.expenses.data] : ([] as ExpenseStats[])}
            loading={stats.expenses.isFetching}
            chart={
              <ChartSection
                data={(stats.expenses.data?.trend ?? []) as TrendData[]}
                dataKey="value"
                color="#dc2626"
                currency
                formatCurrency={formatCurrency}
              />
            }
          />
        )}

        {/* Row 2: Customers & Low Stock */}
        {visibleSections.includes('customers') && (
          <DashboardMetricCard
            title="Customers"
            className="lg:col-span-2"
            groups={customerGroups}
            data={stats.customers.data ? [stats.customers.data] : ([] as CustomerStats[])}
            loading={stats.customers.isFetching}
            chart={
              <ChartSection
                data={(stats.customers.data?.trend ?? []) as TrendData[]}
                dataKey="value"
                color="#3b82f6"
                type="bar"
              />
            }
          />
        )}

        {visibleSections.includes('low_stock') && (
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base font-medium">Low Stock</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                <Link to="/inventory">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-75">
              <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="inventory">Inventory ({lowStockInventories.length})</TabsTrigger>
                  <TabsTrigger value="products">Products ({lowStockProducts.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="products">
                  {lowStockProducts.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      No low stock products. Great job!
                    </div>
                  ) : (
                    <ScrollArea className="h-75 pr-4">
                      <div className="space-y-4">
                        {lowStockProducts.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col md:flex-row items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex items-start gap-3">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-10 w-10 rounded-md object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                  <Box className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  SKU: {item.sku || '-'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-left md:text-right">
                                <div className="text-xs text-muted-foreground">Available</div>
                                <div className={`text-sm font-bold ${item.quantity <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                  {item.quantity} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                <Link to={`/inventory/${item.id}`}>Restock</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="inventory">
                  {lowStockInventories.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      No low stock inventory entries. Great job!
                    </div>
                  ) : (
                    <ScrollArea className="h-75 pr-4">
                      <div className="space-y-4">
                        {lowStockInventories.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex flex-col md:flex-row items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex items-start gap-3">
                              {inv.imageUrl || inv.productImage ? (
                                <img
                                  src={inv.imageUrl || inv.productImage!}
                                  alt={inv.productName}
                                  className="h-10 w-10 rounded-md object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                  <Box className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">{inv.productName}</div>
                                <div className="text-xs text-muted-foreground">
                                  SKU: {inv.sku || '-'} • {inv.branchName || 'Org-wide'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-left md:text-right">
                                <div className="text-xs text-muted-foreground">Available</div>
                                <div className={`text-sm font-bold ${inv.quantity <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                  {inv.quantity} <span className="text-[10px] font-normal text-muted-foreground">{inv.unit || ''}</span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                <Link to={`/inventory/entry/${inv.id}`}>Restock</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Row 3: Small Stats */}
        {visibleSections.includes('inventory') && (
          <DashboardMetricCard
            title="Inventory"
            groups={inventoryGroups}
            data={stats.inventory.data ? [stats.inventory.data] : ([] as InventoryStats[])}
            loading={stats.inventory.isFetching}
          />
        )}

        {visibleSections.includes('products') && (
          <DashboardMetricCard
            title="Products"
            groups={productGroups}
            data={stats.products.data ? [stats.products.data] : ([] as ProductStats[])}
            loading={stats.products.isFetching}
          />
        )}

        {visibleSections.includes('users') && (
          <DashboardMetricCard
            title="Users"
            groups={userGroups}
            data={stats.users.data ? [stats.users.data] : ([] as UserStats[])}
            loading={stats.users.isFetching}
          />
        )}

        {/* Stacked Small Cards */}
        <div className="flex flex-col gap-6">
          {visibleSections.includes('branches') && (
            <DashboardMetricCard
              title="Branches"
              groups={branchGroups}
              data={stats.branches.data ? [stats.branches.data] : ([] as BranchStats[])}
              loading={stats.branches.isFetching}
            />
          )}
          {visibleSections.includes('suppliers') && (
            <DashboardMetricCard
              title="Suppliers"
              groups={supplierGroups}
              data={stats.suppliers.data ? [stats.suppliers.data] : ([] as SupplierStats[])}
              loading={stats.suppliers.isFetching}
            />
          )}
        </div>

      </div>
    </div>
  );
}
