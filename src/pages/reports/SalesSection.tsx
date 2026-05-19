import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSalesLedgerReport } from '@/hooks/useSalesLedgerReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight, FileQuestionMarkIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  differenceInDays,
  isAfter,
  formatDistanceToNow,
} from 'date-fns';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { SalesSummary } from './sales/SalesSummary';
import { dateToBucketKey, nextBucket, startOfUnit, formatStatusLabel, paymentStatusDisplay, type GroupUnit, type RowGroup } from './sales/utils';
import { SalesExportDialog } from './export/SalesExportDialog';
import { CustomerHoverLink } from '@/components/shared/CustomerHoverLink';
import { useBranchContext } from '@/contexts/BranchContext';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';



interface SalesSectionProps {
  orgId?: string;
  branchIds: string[];
  dateRange?: DateRange;
  template: 'detailed' | 'pivot' | 'summary';
  exportOpen: boolean;
  onExportClose: () => void;
}

export function SalesSection({
  orgId,
  branchIds,
  dateRange,
  template,
  exportOpen,
  onExportClose,
}: SalesSectionProps) {
  const { formatCurrency } = useCurrency();
  const normalizedBranchIds =
    branchIds && branchIds.length > 0 ? branchIds : undefined;

  const startIso = dateRange?.from ? new Date(dateRange.from).toISOString() : null;
  const endIso = dateRange?.to ? new Date(dateRange.to).toISOString() : null;

  const { data: ledgerData } = useSalesLedgerReport(
    orgId,
    normalizedBranchIds,
    startIso,
    endIso
  );

  const [groupUnit, setGroupUnit] = useState<GroupUnit>('month');
  const [rowGroup, setRowGroup] = useState<RowGroup>('order');
  const [selectedCustomers, setSelectedCustomers] = useState<Option[]>([]);
  const { availableBranches } = useBranchContext();
  const exportBranchNames =
    branchIds && branchIds.length
      ? branchIds
        .map((id) => availableBranches.find((b) => b.id === id)?.name)
        .filter((n): n is string => !!n)
      : [];

  const { data: salesStats } = useQuery({
    queryKey: ['reports', 'sales_stats', orgId, normalizedBranchIds, startIso, endIso],
    queryFn: async () => {
      if (!orgId) return null as any;
      const { data, error } = await supabase.rpc('get_sales_stats', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds ?? null,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as {
        total_orders: number;
        gross_sales: number;
        total_revenue: number;
        revenue_collected: number;
        owings?: number;
        refunds?: number;
        breakdown?: Record<string, number>;
      };
    },
    enabled: !!orgId,
    placeholderData: (prev) =>
      prev ?? {
        total_orders: 0,
        gross_sales: 0,
        total_revenue: 0,
        revenue_collected: 0,
        owings: 0,
        refunds: 0,
        breakdown: {},
      },
  });

  const filteredOrders = useMemo(() => {
    let src = ledgerData?.orders ?? [];
    if (selectedCustomers.length > 0) {
      const ids = new Set(selectedCustomers.map((c) => c.value));
      src = src.filter((o) => (o.customer?.id ? ids.has(o.customer.id) : false));
    }

    // Sort descending by date
    src = [...src].sort((a, b) => {
      const da = new Date(a.date || a.created_at).getTime();
      const db = new Date(b.date || b.created_at).getTime();
      return db - da;
    });

    return src;
  }, [ledgerData, selectedCustomers]);

  const totalOrders = filteredOrders.length;

  const totalRevenuePaid = filteredOrders.reduce(
    (sum, o) => sum + (o.period_collected || 0),
    0
  );
  const totalOwings = filteredOrders.reduce(
    (sum, o) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)),
    0
  );

  const salesTrendConfig: ChartConfig = {
    revenue: { label: 'Revenue Collected' },
    gross_sales: { label: 'Gross Sales' },
  };

  const revenueColor = '#16a34a';
  const grossSalesColor = '#2563eb';

  const salesTrendUnit = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'month' as const;
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days <= 45) return 'day' as const;
    if (days <= 180) return 'week' as const;
    return 'month' as const;
  }, [dateRange?.from, dateRange?.to]);

  const salesTrendData = useMemo(() => {
    const buckets = new Map<number, { revenue: number; gross_sales: number; orders: number }>();

    const getBucketStart = (d: Date) => {
      if (salesTrendUnit === 'day') return startOfDay(d);
      if (salesTrendUnit === 'week')
        return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    filteredOrders.forEach((o: any) => {
      const d = new Date(o.date || o.created_at);
      const bucketStart = getBucketStart(d).getTime();
      const cur = buckets.get(bucketStart) || { revenue: 0, gross_sales: 0, orders: 0 };

      cur.orders += 1;
      cur.gross_sales += Number(o.total_amount ?? 0);
      buckets.set(bucketStart, cur);

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pDate = new Date(p.created_at);
          const pBucket = getBucketStart(pDate).getTime();
          const pCur = buckets.get(pBucket) || { revenue: 0, gross_sales: 0, orders: 0 };
          pCur.revenue += Number(p.amount);
          buckets.set(pBucket, pCur);
        });
      } else if (Number(o.paid_amount) > 0) {
        // Fallback if no payments array loaded
        cur.revenue += Number(o.paid_amount);
        buckets.set(bucketStart, cur);
      }
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, agg]) => ({
        period: format(new Date(ts), 'MMM dd'),
        revenue: agg.revenue,
        gross_sales: agg.gross_sales,
        orders: agg.orders,
      }));
  }, [filteredOrders, salesTrendUnit]);

  const ordersTrendConfig: ChartConfig = {
    orders: { label: 'Orders' },
  };

  const paymentBreakdownConfig: ChartConfig = {
    value: { label: 'Orders' },
  };

  const paymentBreakdownData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOrders.forEach((o) => {
      const k = paymentStatusDisplay(o.payment_status || 'Unknown');
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders]);



  const customerOptions = useMemo<Option[]>(() => {
    const set = new Set<string>();
    const opts: Option[] = [];
    (ledgerData?.orders || []).forEach((o) => {
      const id = o.customer?.id || '';
      const name =
        ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
        o.customer?.email ||
        o.customer?.name ||
        'Guest';
      if (id && !set.has(id)) {
        set.add(id);
        opts.push({ value: id, label: name });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [ledgerData?.orders]);

  const pivotColumns = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      const start = startOfUnit(dateRange.from, groupUnit);
      const end = startOfUnit(dateRange.to, groupUnit);
      const cols: string[] = [];
      let cur = start;
      while (!isAfter(cur, end)) {
        cols.push(
          dateToBucketKey(cur.toISOString(), groupUnit)
        );
        cur = nextBucket(cur, groupUnit);
      }
      return cols.reverse();
    }
    const bucketDates = new Map<string, number>();
    filteredOrders.forEach((o) => {
      const d = new Date(o.date || o.created_at);
      const start = startOfUnit(d, groupUnit);
      const key = dateToBucketKey(start.toISOString(), groupUnit);
      const ts = start.getTime();
      if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
        bucketDates.set(key, ts);
      }
    });
    return Array.from(bucketDates.entries())
      .sort((a, b) => (b[1] - a[1]))
      .map(([k]) => k);
  }, [filteredOrders, dateRange, groupUnit]);

  const pivotRows = useMemo(() => {
    type ColAgg = { total: number; paid: number; due: number };
    const rowsMap = new Map<string, { columns: Record<string, ColAgg>; meta?: any }>();
    filteredOrders.forEach((o) => {
      const bucket = dateToBucketKey(o.date || o.created_at, groupUnit);
      const total = o.total_amount || 0;
      const paid = o.paid_amount || 0;
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      let rowLabel = '';
      let meta: any = undefined;
      if (rowGroup === 'order') {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = `#${o.order_number} — ${customerName}`;
        const items = (o.items || []).map((it: any) => `${it.product_name} x${it.quantity}`);
        meta = { items };
      } else if (rowGroup === 'branch') {
        rowLabel = o.branch?.name || 'Unspecified';
      } else if (rowGroup === 'payment_status') {
        rowLabel = paymentStatusDisplay(o.payment_status || 'Unknown');
      } else if (rowGroup === 'payment_method') {
        const pm = o.payments && o.payments.length > 0 ? o.payments[0].payment_method : 'other';
        rowLabel = pm
          .toString()
          .split('_')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
      } else if (rowGroup === 'status') {
        rowLabel = formatStatusLabel(o.status || 'Unknown');
      } else {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = customerName;
        meta = { customerId: o.customer?.id };
      }
      const existing = rowsMap.get(rowLabel) || { columns: {}, meta };
      const colAgg = existing.columns[bucket] || { total: 0, paid: 0, due: 0 };
      colAgg.total += total;
      colAgg.paid += paid;
      colAgg.due += due;
      existing.columns[bucket] = colAgg;
      if (!existing.meta && meta) existing.meta = meta;
      rowsMap.set(rowLabel, existing);
    });
    const rows = Array.from(rowsMap.entries()).map(([rowLabel, { columns, meta }]) => ({
      rowLabel,
      columns,
      meta,
    }));
    rows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
    return rows;
  }, [filteredOrders, groupUnit, rowGroup]);


  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Sales Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {salesStats?.total_orders ?? totalOrders} <span className="text-sm font-normal text-muted-foreground ml-1">New Sales</span>
            </div>

            <div className='mt-4'>
              <div className="flex justify-between items-center mt-4 border-b pb-2">
                <span className="text-xs text-muted-foreground flex gap-0.5 items-center" title="Unique orders that had money collected in period. (This includes some new sales, plus payments made for old sales in period).">Orders with payments in period <FileQuestionMarkIcon className='w-3 h-3' /></span>
                <span className="text-sm">{filteredOrders.filter(o => (o.period_collected || 0) > 0).length}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">Completed Orders</span>
                <span className="text-sm">{salesStats?.breakdown?.completed ?? 0}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">Pending Orders</span>
                <span className="text-sm">{salesStats?.breakdown?.pending ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              <CurrencyDisplay amount={salesStats?.revenue_collected ?? salesStats?.total_revenue ?? totalRevenuePaid} />
            </div>
            {((salesStats?.revenue_from_current_sales ?? 0) > 0 || (salesStats?.revenue_from_previous_sales ?? 0) > 0) && (
              <div className="flex flex-col text-xs mt-2 mb-2 text-muted-foreground">
                <div className="flex justify-between items-center mt-1">
                  <span>From New Sales</span>
                  <span className="font-medium"><CurrencyDisplay amount={salesStats?.revenue_from_current_sales ?? 0} /></span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span>From Previous Sales</span>
                  <span className="font-medium"><CurrencyDisplay amount={salesStats?.revenue_from_previous_sales ?? 0} /></span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mt-4 border-t pt-4">
              <span className="text-xs text-muted-foreground">Gross Sales</span>
              <span className='text-sm font-medium'>
                <CurrencyDisplay amount={salesStats?.gross_sales ?? 0} />
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">Owings</span>
              <span className='text-sm text-amber-600'>
                <CurrencyDisplay amount={salesStats?.owings ?? totalOwings} />
              </span>
            </div>

            <div className="flex justify-between items-center text-red-500 mt-2">
              <span className="text-xs text-muted-foreground">Refunds</span>
              <span className='text-sm'>
                <CurrencyDisplay amount={salesStats?.refunds ?? 0} />
              </span>
            </div>
          </CardContent>
        </Card>

        {template === 'pivot' && (
          <Card className="md:col-span-3 lg:col-span-2">
            <CardHeader>
              <CardTitle>Pivot Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Time Group</span>
                    <Select value={groupUnit} onValueChange={(v) => setGroupUnit(v as GroupUnit)}>
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Group by time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="quarter">Quarterly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Row Group</span>
                    <Select value={rowGroup} onValueChange={(v) => setRowGroup(v as RowGroup)}>
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Group rows" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order">By Order</SelectItem>
                        <SelectItem value="customer">By Customer</SelectItem>
                        <SelectItem value="branch">By Branch</SelectItem>
                        <SelectItem value="payment_status">By Payment Status</SelectItem>
                        <SelectItem value="payment_method">By Payment Method</SelectItem>
                        <SelectItem value="status">By Order Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Filter Customers</span>
                  <MultipleSelector
                    value={selectedCustomers}
                    options={customerOptions}
                    onChange={setSelectedCustomers}
                    placeholder="Select customers"
                    hideClearAllButton
                    className="w-full"
                  />
                </div>

              </div>
            </CardContent>
          </Card>
        )}

        {template === 'summary' && (
          <Card className="md:col-span-3 lg:col-span-2">
            <CardHeader>
              <CardTitle>Summary Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Time Group</span>
                  <Select value={groupUnit} onValueChange={(v) => setGroupUnit(v as GroupUnit)}>
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Group by time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="quarter">Quarterly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue & Gross Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {salesTrendData.length ? (
              <ChartContainer config={salesTrendConfig} className="h-72 w-full">
                <AreaChart data={salesTrendData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        valueFormatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Area
                    dataKey="revenue"
                    type="monotone"
                    stroke={revenueColor}
                    fill={revenueColor}
                    fillOpacity={0.15}
                  />
                  <Area
                    dataKey="gross_sales"
                    type="monotone"
                    stroke={grossSalesColor}
                    fill={grossSalesColor}
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="text-sm text-muted-foreground">
                No data for the selected filters.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {salesTrendData.length ? (
              <ChartContainer config={ordersTrendConfig} className="h-72 w-full">
                <BarChart data={salesTrendData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="orders"
                    fill="var(--chart-3)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="text-sm text-muted-foreground">
                No data for the selected filters.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdownData.length ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  {paymentBreakdownData.map((s, i) => (
                    <div
                      key={`${s.name}-${i}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: `var(--chart-${(i % 5) + 1})`,
                          }}
                        />
                        <div className="font-medium">{s.name}</div>
                      </div>
                      <div className="font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="w-full">
                  <ChartContainer
                    config={paymentBreakdownConfig}
                    className="mx-auto aspect-square max-h-62.5 max-w-62.5"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            nameKey="name"
                            formatter={(value) =>
                              Number(value ?? 0).toLocaleString()
                            }
                          />
                        }
                      />
                      <Pie
                        data={paymentBreakdownData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {paymentBreakdownData.map((_entry, i) => (
                          <Cell
                            key={`p-cell-${i}`}
                            fill={`var(--chart-${(i % 5) + 1})`}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No data for the selected filters.
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {template === 'pivot' && (
        <Card className='bg-card/20'>
          <CardHeader>
            <CardTitle>Sales Pivot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-130 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 min-w-75">Item</th>
                    {pivotColumns.map((col) => (
                      <th key={col} className="text-right p-2 min-w-32.5">
                        {col}
                      </th>
                    ))}
                    <th className="text-right p-2 bg-card font-semibold sticky right-0 z-10 min-w-32.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((r) => {
                    const rowTotals = Object.values(r.columns).reduce(
                      (acc, c) => ({ total: acc.total + c.total, paid: acc.paid + c.paid, due: acc.due + c.due }),
                      { total: 0, paid: 0, due: 0 }
                    );
                    return (
                      <tr key={r.rowLabel} className="border-t">
                        <td className="p-2 font-medium min-w-32.5">
                          {rowGroup === 'customer' && r.meta?.customerId ? (
                            <div>
                              <CustomerHoverLink
                                customerId={r.meta.customerId}
                                customerName={r.rowLabel}
                                className="font-medium"
                              />
                            </div>
                          ) : (
                            <div>{r.rowLabel}</div>
                          )}
                          {r.meta?.items && Array.isArray(r.meta.items) && r.meta.items.length > 0 && (
                            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                              {r.meta.items.map((it: string, idx: number) => (
                                <div key={idx}>{it}</div>
                              ))}
                            </div>
                          )}
                        </td>
                        {pivotColumns.map((col) => {
                          const c = r.columns[col] || { total: 0, paid: 0, due: 0 };
                          const showDue =
                            rowGroup === 'payment_status'
                              ? r.rowLabel === 'Partially Paid' && c.due > 0
                              : c.due > 0;
                          return (
                            <td key={col} className="p-2 text-right min-w-32.5">
                              {(rowGroup === 'payment_status' || rowGroup === 'status') && r.rowLabel === 'Refunded' ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-orange-500 font-medium">
                                    <CurrencyDisplay amount={c.total} />
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end">

                                  <CurrencyDisplay amount={c.paid} />

                                  {showDue && (
                                    <span className="text-[10px] text-red-500 font-medium">
                                      Due: <CurrencyDisplay amount={c.due} />
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-right bg-card  font-semibold sticky right-0 z-10 min-w-32.5">
                          {(rowGroup === 'payment_status' || rowGroup === 'status') && r.rowLabel === 'Refunded' ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-orange-500 font-medium">
                                <CurrencyDisplay amount={rowTotals.total} />
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <CurrencyDisplay amount={rowTotals.paid} />
                              {(rowGroup === 'payment_status' ? r.rowLabel === 'Partially Paid' && rowTotals.due > 0 : rowTotals.due > 0) && (
                                <span className="text-[10px] text-red-500 font-medium">
                                  Due: <CurrencyDisplay amount={rowTotals.due} />
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t font-semibold">
                    <td className="p-2 sticky bottom-0 bg-card  min-w-30">Total</td>
                    {pivotColumns.map((col) => {
                      const c = Object.values(pivotRows).reduce((acc, r) => {
                        const cell = r.columns[col] || { total: 0, paid: 0, due: 0 };
                        return { total: acc.total + cell.total, paid: acc.paid + cell.paid, due: acc.due + cell.due };
                      }, { total: 0, paid: 0, due: 0 });
                      return (
                        <td key={col} className="p-2 text-right sticky bottom-0 bg-card min-w-32.5">
                          <div className="flex flex-col items-end">
                            <CurrencyDisplay amount={c.paid} />
                            {c.due > 0 && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Due: <CurrencyDisplay amount={c.due} />
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-right bg-card sticky right-0 bottom-0 z-10 min-w-32.5">
                      {(() => {
                        const grand = Object.values(pivotRows).reduce((acc, r) => {
                          const row = Object.values(r.columns).reduce(
                            (acc2, c) => ({ total: acc2.total + c.total, paid: acc2.paid + c.paid, due: acc2.due + c.due }),
                            { total: 0, paid: 0, due: 0 }
                          );
                          return { total: acc.total + row.total, paid: acc.paid + row.paid, due: acc.due + row.due };
                        }, { total: 0, paid: 0, due: 0 });
                        return (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground">
                              Paid: <CurrencyDisplay amount={grand.paid} />
                            </span>
                            {grand.due > 0 && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Due: <CurrencyDisplay amount={grand.due} />
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {template === 'summary' && (
        <SalesSummary orders={filteredOrders} groupUnit={groupUnit} dateRange={dateRange} />
      )}

      {template === 'detailed' && (
        <Tabs defaultValue="overview" className="mt-8">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Sales Overview</TabsTrigger>
            <TabsTrigger value="ledger">Payment Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Order</th>
                    <th className="p-3 font-medium">Customer</th>
                    <th className="p-3 font-medium">Branch</th>
                    <th className="p-3 font-medium max-w-[200px]">Items</th>
                    <th className="p-3 font-medium text-right">Sale Amount</th>
                    <th className="p-3 font-medium text-right">Collected in Period</th>
                    <th className="p-3 font-medium text-right">Total Paid</th>
                    <th className="p-3 font-medium text-right">Due</th>
                    <th className="p-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        No sales data for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const d = new Date(o.date || o.created_at);
                      const customerName =
                        ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
                        o.customer?.email ||
                        o.customer?.name ||
                        'Guest';
                      const items = (o.items || []).map((it) => `${it.product_name} x${it.quantity}`);
                      const due = String(o.payment_status || '').toLowerCase() === 'refunded'
                        ? 0
                        : Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0));

                      const status = (o.status || '')
                        .toString()
                        .split('_')
                        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(' ');

                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 whitespace-nowrap">
                            <div>{format(d, 'MMM dd, yyyy')}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(d, { addSuffix: true })}
                            </div>
                          </td>
                          <td className="p-3 font-medium">#{o.order_number}</td>
                          <td className="p-3">
                            <CustomerHoverLink
                              customerId={o.customer?.id}
                              customerName={customerName}
                            />
                          </td>
                          <td className="p-3 text-muted-foreground">{o.branch?.name || '-'}</td>
                          <td className="p-3">
                            <div className="max-w-[200px] truncate" title={items.join(', ')}>
                              {items.join(', ')}
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium">
                            <CurrencyDisplay amount={o.total_amount || 0} />
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-medium text-green-600">
                              <CurrencyDisplay amount={o.period_collected || 0} />
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <CurrencyDisplay amount={o.paid_amount || 0} />
                          </td>
                          <td className="p-3 text-right">
                            {due > 0 ? (
                              <span className="font-medium text-red-500">
                                <CurrencyDisplay amount={due} />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-1 bg-secondary rounded-full text-xs">
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ledger">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium w-8"></th>
                    <th className="p-3 font-medium">Order</th>
                    <th className="p-3 font-medium">Customer</th>
                    <th className="p-3 font-medium text-right">Sale Amount</th>
                    <th className="p-3 font-medium text-right">Total Paid</th>
                    <th className="p-3 font-medium text-right">Collected in Period</th>
                    <th className="p-3 font-medium text-center">Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.filter(o => (o.period_collected || 0) > 0).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No payments collected for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders
                      .filter(o => (o.period_collected || 0) > 0)
                      .map((o) => {
                        const customerName =
                          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
                          o.customer?.email ||
                          o.customer?.name ||
                          'Guest';
                        const ps = (o.payment_status || '')
                          .toString()
                          .split('_')
                          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                          .join(' ');

                        return (
                          <Collapsible key={`ledger-${o.id}`} asChild>
                            <>
                              <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
                                <td className="p-3 text-center cursor-pointer">
                                  <CollapsibleTrigger asChild>
                                    <button className="p-1 hover:bg-muted rounded-full">
                                      <ChevronRight className="w-4 h-4 transition-transform group-data-[state=open]:rotate-90" />
                                    </button>
                                  </CollapsibleTrigger>
                                </td>
                                <td className="p-3 font-medium">#{o.order_number}</td>
                                <td className="p-3">
                                  <CustomerHoverLink
                                    customerId={o.customer?.id}
                                    customerName={customerName}
                                  />
                                </td>
                                <td className="p-3 text-right">
                                  <CurrencyDisplay amount={o.total_amount || 0} />
                                </td>
                                <td className="p-3 text-right">
                                  <CurrencyDisplay amount={o.paid_amount || 0} />
                                </td>
                                <td className="p-3 text-right font-medium text-green-600">
                                  <CurrencyDisplay amount={o.period_collected || 0} />
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-1 bg-secondary rounded-full text-xs">
                                    {ps}
                                  </span>
                                </td>
                              </tr>
                              <CollapsibleContent asChild>
                                <tr className="bg-muted/10">
                                  <td colSpan={7} className="p-0 border-b">
                                    <div className="p-4 pl-12">
                                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                                        Payment Transactions in Period
                                      </h4>
                                      <table className="w-full text-sm text-left bg-background rounded border">
                                        <thead className="bg-muted/30 text-xs text-muted-foreground border-b">
                                          <tr>
                                            <th className="p-2 font-medium">Date</th>
                                            <th className="p-2 font-medium">Method</th>
                                            <th className="p-2 font-medium">Recorded By</th>
                                            <th className="p-2 font-medium">Notes</th>
                                            <th className="p-2 font-medium text-right">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {o.payments?.map((p: any) => (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                                              <td className="p-2">
                                                {format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}
                                              </td>
                                              <td className="p-2 capitalize">{(p.payment_method || '').replace('_', ' ')}</td>
                                              <td className="p-2">{p.recorded_by}</td>
                                              <td className="p-2 text-muted-foreground text-xs">{p.notes || '-'}</td>
                                              <td className="p-2 text-right font-medium text-green-600">
                                                <CurrencyDisplay amount={p.amount} />
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}
      <SalesExportDialog
        template={template}
        orders={filteredOrders}
        groupUnit={groupUnit}
        rowGroup={rowGroup}
        organizationName={undefined}
        dateRange={dateRange}
        open={exportOpen}
        onClose={onExportClose}
        branchNames={exportBranchNames}
      />
    </>
  );
}
