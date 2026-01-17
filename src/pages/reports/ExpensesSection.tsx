import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExpenses } from '@/hooks/useExpenseQueries';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import {
  format,
  formatDistanceToNow,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  isAfter,
  differenceInDays,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import { ExpensesSummary } from './expenses/ExpensesSummary';
import { ExpensesSettingsCard } from './components/ExpensesSettingsCard';
import { ExpensesExportDialog } from './export/ExpensesExportDialog';
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

type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
type ExpenseStats = {
  total_records: number;
  total_expenditure: number;
  top_category?: { category: string; amount: number } | null;
};

function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMM dd, yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMM yyyy');
  if (unit === 'quarter')
    return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

interface ExpensesSectionProps {
  orgId?: string;
  branchIds: string[];
  dateRange?: DateRange;
  template: 'detailed' | 'pivot' | 'summary';
  groupBy: 'category' | 'type';
  setGroupBy?: (v: 'category' | 'type') => void;
  exportOpen: boolean;
  onExportClose: () => void;
}

export function ExpensesSection({
  orgId,
  branchIds,
  dateRange,
  template,
  groupBy,
  setGroupBy,
  exportOpen,
  onExportClose,
}: ExpensesSectionProps) {
  const { formatCurrency } = useCurrency();
  const normalizedBranchIds =
    branchIds && branchIds.length > 0 ? branchIds : undefined;
  const { data: expenses = [] } = useExpenses(orgId, normalizedBranchIds);
  const [groupUnit, setGroupUnit] = useState<GroupUnit>('month');
  const { availableBranches } = useBranchContext();
  const exportBranchNames =
    branchIds && branchIds.length
      ? branchIds
          .map((id) => availableBranches.find((b) => b.id === id)?.name)
          .filter((n): n is string => !!n)
      : [];
  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const da = new Date(
        a.date || a.createdAt || new Date().toISOString()
      ).getTime();
      const db = new Date(
        b.date || b.createdAt || new Date().toISOString()
      ).getTime();
      return db - da;
    });
  }, [expenses]);
  const filteredExpenses = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return sortedExpenses;
    const fromTs = dateRange?.from
      ? startOfDay(dateRange.from).getTime()
      : Number.NEGATIVE_INFINITY;
    const toTs = dateRange?.to
      ? endOfDay(dateRange.to).getTime()
      : Number.POSITIVE_INFINITY;
    return sortedExpenses.filter((e) => {
      const t = new Date(
        e.date || e.createdAt || new Date().toISOString()
      ).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [sortedExpenses, dateRange]);
  const startIso = dateRange?.from
    ? new Date(dateRange.from).toISOString()
    : null;
  const endIso = dateRange?.to ? new Date(dateRange.to).toISOString() : null;
  const { data: expenseStats } = useQuery<ExpenseStats | null>({
    queryKey: [
      'reports',
      'expense_stats',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.rpc('get_expense_stats', {
        p_organization_id: orgId,
        p_branch_ids: (normalizedBranchIds ?? null) as string[] | null,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as ExpenseStats;
    },
    enabled: !!orgId,
    placeholderData: (prev) =>
      prev ?? {
        total_records: 0,
        total_expenditure: 0,
        top_category: null,
      },
  });

  const totalRecords = expenseStats?.total_records ?? filteredExpenses.length;
  const totalExpenditure =
    expenseStats?.total_expenditure ??
    filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const pivotColumns = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      const start = startOfDay(dateRange.from);
      const end = startOfDay(dateRange.to);
      // Snap to unit starts
      const unitStart = (d: Date) => {
        const t = new Date(d);
        if (groupUnit === 'day') return startOfDay(t);
        if (groupUnit === 'week') {
          // Monday as start
          const day = t.getDay();
          const diff = (day + 6) % 7;
          t.setDate(t.getDate() - diff);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        if (groupUnit === 'month') {
          t.setDate(1);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        if (groupUnit === 'quarter') {
          const qStartMonth = Math.floor(t.getMonth() / 3) * 3;
          t.setMonth(qStartMonth, 1);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        t.setMonth(0, 1);
        t.setHours(0, 0, 0, 0);
        return t;
      };
      const unitNext = (d: Date) => {
        const t = new Date(d);
        if (groupUnit === 'day') t.setDate(t.getDate() + 1);
        else if (groupUnit === 'week') t.setDate(t.getDate() + 7);
        else if (groupUnit === 'month') t.setMonth(t.getMonth() + 1);
        else if (groupUnit === 'quarter') t.setMonth(t.getMonth() + 3);
        else t.setFullYear(t.getFullYear() + 1);
        return t;
      };
      const s = unitStart(start);
      const e = unitStart(end);
      const cols: string[] = [];
      let cur = s;
      while (!isAfter(cur, e)) {
        cols.push(dateToBucketKey(cur.toISOString(), groupUnit));
        cur = unitNext(cur);
      }
      return cols.reverse();
    }
    const bucketDates = new Map<string, number>();
    filteredExpenses.forEach((exp) => {
      const d = new Date(exp.date || exp.createdAt || new Date().toISOString());
      // Align to unit start
      const unitStart = (x: Date) => {
        const t = new Date(x);
        if (groupUnit === 'day') return startOfDay(t);
        if (groupUnit === 'week') {
          const day = t.getDay();
          const diff = (day + 6) % 7;
          t.setDate(t.getDate() - diff);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        if (groupUnit === 'month') {
          t.setDate(1);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        if (groupUnit === 'quarter') {
          const qStartMonth = Math.floor(t.getMonth() / 3) * 3;
          t.setMonth(qStartMonth, 1);
          t.setHours(0, 0, 0, 0);
          return t;
        }
        t.setMonth(0, 1);
        t.setHours(0, 0, 0, 0);
        return t;
      };
      const start = unitStart(d);
      const key = dateToBucketKey(start.toISOString(), groupUnit);
      const ts = start.getTime();
      if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
        bucketDates.set(key, ts);
      }
    });
    return Array.from(bucketDates.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [filteredExpenses, dateRange, groupUnit]);

  const pivotRows = useMemo(() => {
    const rowsMap = new Map<string, Record<string, number>>();
    filteredExpenses.forEach((e) => {
      const rowLabel =
        groupBy === 'category'
          ? e.categoryName || 'Uncategorized'
          : e.typeName || 'Unknown Type';
      const bucket = dateToBucketKey(e.date || e.createdAt || '', groupUnit);
      const row = rowsMap.get(rowLabel) || {};
      row[bucket] = (row[bucket] || 0) + (e.amount || 0);
      rowsMap.set(rowLabel, row);
    });
    const rows = Array.from(rowsMap.entries()).map(([rowLabel, columns]) => ({
      rowLabel,
      columns,
    }));
    rows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
    return rows;
  }, [filteredExpenses, groupBy, groupUnit]);

  const expenseTrendConfig: ChartConfig = {
    amount: { label: 'Expenditure' },
  };

  const expenditureColor = '#dc2626';

  const expenseTrendUnit = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'month' as const;
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days <= 45) return 'day' as const;
    if (days <= 180) return 'week' as const;
    return 'month' as const;
  }, [dateRange?.from, dateRange?.to]);

  const expenseTrendData = useMemo(() => {
    const buckets = new Map<number, number>();

    const getBucketStart = (d: Date) => {
      if (expenseTrendUnit === 'day') return startOfDay(d);
      if (expenseTrendUnit === 'week')
        return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    filteredExpenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const bucketStart = getBucketStart(d).getTime();
      buckets.set(bucketStart, (buckets.get(bucketStart) || 0) + (e.amount || 0));
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, amount]) => ({
        period: format(new Date(ts), 'MMMM dd, yyyy'),
        amount,
      }));
  }, [filteredExpenses, expenseTrendUnit]);

  const breakdownConfig: ChartConfig = {
    value: { label: 'Amount' },
  };

  const breakdownData = useMemo(() => {
    const sums = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const key =
        groupBy === 'category'
          ? e.categoryName || 'Uncategorized'
          : e.typeName || 'Unknown Type';
      sums.set(key, (sums.get(key) || 0) + (e.amount || 0));
    });

    const sorted = Array.from(sums.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const restTotal = rest.reduce((sum, r) => sum + r.value, 0);
    return restTotal > 0 ? [...top, { name: 'Other', value: restTotal }] : top;
  }, [filteredExpenses, groupBy]);

  const topBreakdownData = useMemo(() => {
    const sums = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const key =
        groupBy === 'category'
          ? e.categoryName || 'Uncategorized'
          : e.typeName || 'Unknown Type';
      sums.set(key, (sums.get(key) || 0) + (e.amount || 0));
    });

    return Array.from(sums.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredExpenses, groupBy]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Records</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {totalRecords}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Expenditure</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            <CurrencyDisplay amount={totalExpenditure} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {expenseStats?.top_category?.category || '-'}
            </div>
            {expenseStats?.top_category?.amount ? (
              <div className="text-xs text-muted-foreground">
                <CurrencyDisplay amount={expenseStats.top_category.amount} />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {template === 'pivot' && (
          <ExpensesSettingsCard
            title="Pivot Settings"
            groupUnit={groupUnit}
            setGroupUnit={setGroupUnit}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
        )}

        {template === 'summary' && (
          <ExpensesSettingsCard
            title="Summary Settings"
            groupUnit={groupUnit}
            setGroupUnit={setGroupUnit}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenditure Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseTrendData.length ? (
              <ChartContainer config={expenseTrendConfig} className="h-72 w-full">
                <AreaChart data={expenseTrendData} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
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
                    dataKey="amount"
                    type="monotone"
                    stroke={expenditureColor}
                    fill={expenditureColor}
                    fillOpacity={0.15}
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

        <Card>
          <CardHeader>
            <CardTitle>
              Spending Breakdown ({groupBy === 'category' ? 'Category' : 'Type'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownData.length ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  {breakdownData.map((s, i) => (
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
                      <div className="font-bold">
                        {formatCurrency(Number(s.value))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="w-full">
                  <ChartContainer
                    config={breakdownConfig}
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
                              formatCurrency(Number(value ?? 0))
                            }
                          />
                        }
                      />
                      <Pie
                        data={breakdownData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {breakdownData.map((_entry, i) => (
                          <Cell
                            key={`e-cell-${i}`}
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

      <Card>
        <CardHeader>
          <CardTitle>
            Top 10 Spending ({groupBy === 'category' ? 'Category' : 'Type'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topBreakdownData.length ? (
            <ChartContainer config={breakdownConfig} className="h-80 w-full">
              <BarChart
                data={topBreakdownData}
                layout="vertical"
                margin={{ left: 20, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={160}
                  tickLine={false}
                  axisLine={false}
                />
                <XAxis
                  dataKey="value"
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCurrency(Number(v))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="name"
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="var(--chart-4)"
                  radius={[4, 4, 4, 4]}
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

      {template === 'summary' && (
        <ExpensesSummary
          expenses={filteredExpenses}
          groupUnit={groupUnit}
          dateRange={dateRange}
        />
      )}

      {template === 'detailed' && (
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-125 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 min-w-30">Date</th>
                    <th className="text-left p-2">Reference</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Branch</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-left p-2">Recorded By</th>
                    <th className="text-left p-2">Payment</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e) => {
                    const d = new Date(
                      e.date || e.createdAt || new Date().toISOString()
                    );
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="p-2">
                          <div>{format(d, 'MMM dd, yyyy')}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(d, { addSuffix: true })}
                          </div>
                        </td>
                        <td className="p-2">{e.reference || '-'}</td>
                        <td className="p-2">
                          {e.categoryName || 'Uncategorized'}
                        </td>
                        <td className="p-2">{e.typeName || 'Unknown Type'}</td>
                        <td className="p-2">{e.branchName || '-'}</td>
                        <td className="p-2 text-right">
                          <CurrencyDisplay amount={e.amount || 0} />
                        </td>
                        <td className="p-2">{e.createdByName || '-'}</td>
                        <td className="p-2">
                          {(e.paymentMethod || '')
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ') || '-'}
                        </td>
                        <td className="p-2">
                          {(e.status || '')
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ') || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {template === 'pivot' && (
        <Card>
          <CardHeader>
            <CardTitle>
              Expenses Pivot (
              {groupBy === 'category' ? 'By Category' : 'By Type'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">
                      {groupBy === 'category' ? 'Category' : 'Type'}
                    </th>
                    {pivotColumns.map((col) => (
                      <th key={col} className="text-right p-2">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((r) => (
                    <tr key={r.rowLabel}>
                      <td className="p-2 font-medium">{r.rowLabel}</td>
                      {pivotColumns.map((col) => (
                        <td key={col} className="p-2 text-right">
                          <CurrencyDisplay amount={r.columns[col] || 0} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      <ExpensesExportDialog
        template={template}
        expenses={filteredExpenses}
        groupUnit={groupUnit}
        groupBy={groupBy}
        organizationName={undefined}
        dateRange={dateRange}
        open={exportOpen}
        onClose={onExportClose}
        branchNames={exportBranchNames}
      />
    </>
  );
}
