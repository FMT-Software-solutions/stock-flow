import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { format, addDays, addWeeks, addMonths, addQuarters, addYears, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter, formatDistanceToNow } from 'date-fns';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
type RowGroup = 'order' | 'branch' | 'payment_status' | 'payment_method' | 'status' | 'customer';

function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMM dd, yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMM yyyy');
  if (unit === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

function nextBucket(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return addDays(date, 1);
  if (unit === 'week') return addWeeks(date, 1);
  if (unit === 'month') return addMonths(date, 1);
  if (unit === 'quarter') return addQuarters(date, 1);
  return addYears(date, 1);
}

function startOfUnit(date: Date, unit: GroupUnit): Date {
  if (unit === 'day') return startOfDay(date);
  if (unit === 'week') return startOfWeek(date, { weekStartsOn: 1 });
  if (unit === 'month') return startOfMonth(date);
  if (unit === 'quarter') return startOfQuarter(date);
  return startOfYear(date);
}

interface SalesSectionProps {
  orgId?: string;
  branchIds: string[];
  dateRange?: DateRange;
  template: 'compact' | 'detailed' | 'pivot';
}

export function SalesSection({
  orgId,
  branchIds,
  dateRange,
  template,
}: SalesSectionProps) {
  const normalizedBranchIds =
    branchIds && branchIds.length > 0 ? branchIds : undefined;
  const { data: orders = [] } = useOrders(orgId, normalizedBranchIds);
  const [groupUnit, setGroupUnit] = useState<GroupUnit>('month');
  const [rowGroup, setRowGroup] = useState<RowGroup>('order');
  const [selectedCustomers, setSelectedCustomers] = useState<Option[]>([]);
  const startIso = dateRange?.from ? new Date(dateRange.from).toISOString() : null;
  const endIso = dateRange?.to ? new Date(dateRange.to).toISOString() : null;
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
        total_revenue: number;
        owings?: number;
        refunds?: number;
        breakdown?: Record<string, number>;
      };
    },
    enabled: !!orgId,
    placeholderData: (prev) =>
      prev ?? {
        total_orders: 0,
        total_revenue: 0,
        owings: 0,
        refunds: 0,
        breakdown: {},
      },
  });

  const filteredOrders = useMemo(() => {
    let src = orders;
    if (selectedCustomers.length > 0) {
      const ids = new Set(selectedCustomers.map((c) => c.value));
      src = src.filter((o) => (o.customer?.id ? ids.has(o.customer.id) : false));
    }
    if (dateRange?.from || dateRange?.to) {
      const from = dateRange?.from ? new Date(dateRange.from) : undefined;
      const to = dateRange?.to ? new Date(dateRange.to) : undefined;
      src = src.filter((o) => {
        const d = new Date(o.date || o.created_at);
        if (from && d < startOfDay(from)) return false;
        if (to && d > startOfDay(to)) return false;
        return true;
      });
    }
    return src.sort((a, b) => {
      const da = new Date(a.date || a.created_at).getTime();
      const db = new Date(b.date || b.created_at).getTime();
      return db - da;
    });
  }, [orders, selectedCustomers, dateRange]);

  const totalOrders = filteredOrders.length;
  const totalRevenuePaid = filteredOrders.reduce(
    (sum, o) => sum + (o.paid_amount || 0),
    0
  );
  const totalOwings = filteredOrders.reduce(
    (sum, o) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)),
    0
  );

  function formatStatusLabel(s?: string | null) {
    if (!s) return 'Unknown';
    return s
      .toString()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function paymentStatusDisplay(s?: string | null) {
    const k = (s || '').toLowerCase();
    if (k === 'paid') return 'Fully Paid';
    if (k === 'partial') return 'Partially Paid';
    if (k === 'refunded') return 'Refunded';
    if (k === 'unpaid') return 'Unpaid';
    return formatStatusLabel(s);
  }

  const customerOptions = useMemo<Option[]>(() => {
    const set = new Set<string>();
    const opts: Option[] = [];
    orders.forEach((o) => {
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
  }, [orders]);

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
    const source = filteredOrders;
    source.forEach((o) => {
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
        const items = (o.items || []).map((it) => `${it.product_name} x${it.quantity}`);
        meta = { items };
      } else if (rowGroup === 'branch') {
        rowLabel = o.branch?.name || 'Unspecified';
      } else if (rowGroup === 'payment_status') {
        rowLabel = paymentStatusDisplay(o.payment_status || 'Unknown');
      } else if (rowGroup === 'payment_method') {
        const pm = o.payment_method || 'other';
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
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {salesStats?.total_orders ?? totalOrders}
            </div>

            <div className='mt-4'>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-muted-foreground">Completed</span>
                <span className="text-sm">{salesStats?.breakdown?.completed ?? 0}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">Pending</span>
                <span className="text-sm">{salesStats?.breakdown?.pending ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
       
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              <CurrencyDisplay amount={salesStats?.total_revenue ?? totalRevenuePaid} />
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-muted-foreground">Owings</span>
              <span className='text-sm'>
                <CurrencyDisplay amount={salesStats?.owings ?? totalOwings} />
              </span>
            </div>
           
            <div className="flex justify-between items-center text-orange-500 mt-2">
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
      </div>

      {template === 'pivot' && (
        <Card className='bg-card/20'>
          <CardHeader>
            <CardTitle>Sales & Orders Pivot</CardTitle>
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
                          <div>{r.rowLabel}</div>
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

      {template !== 'pivot' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales & Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2  min-w-30">Date</th>
                    <th className="text-left p-2">Order</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Branch</th>
                    <th className="text-left p-2 min-w-75">Items</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Paid</th>
                    <th className="text-left p-2">Recorded By</th>
                    <th className="text-left p-2">Payment</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
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
                    const pm = (o.payment_method || 'other').toString()
                      .split('_')
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(' ');
                    const recordedBy =
                      o.creator ? `${o.creator.first_name || ''} ${o.creator.last_name || ''}`.trim() : '';
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="p-2">
                          <div>{format(d, 'MMM dd, yyyy')}</div>
                          <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(d, { addSuffix: true })}</div>
                        </td>
                        <td className="p-2">#{o.order_number}</td>
                        <td className="p-2">{customerName}</td>
                        <td className="p-2">{o.branch?.name || 'Unspecified'}</td>
                        <td className="p-2">
                          <div className="space-y-1">
                            {items.map((it, idx) => (
                              <div key={idx}>{it}</div>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-right"><CurrencyDisplay amount={o.total_amount || 0} /></td>
                        <td className="p-2 text-right">
                          <div className="flex flex-col items-end">
                            <CurrencyDisplay amount={o.paid_amount || 0} />
                            {due > 0 && <span className={due > 0 ? 'text-[10px] text-red-500 font-medium' : 'text-[10px] text-muted-foreground'}>
                              Due: <CurrencyDisplay amount={due} />
                            </span> }
                          </div>
                        </td>
                        <td className="p-2">{recordedBy || '-'}</td>
                        <td className="p-2">
                          <div className="flex flex-col">
                            <span className="text-xs">{pm}</span>
                            <span className="text-[10px] text-muted-foreground">{formatStatusLabel(o.payment_status)}</span>
                          </div>
                        </td>
                        <td className="p-2">{formatStatusLabel(o.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
