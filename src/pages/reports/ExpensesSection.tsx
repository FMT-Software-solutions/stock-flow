import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table/data-table';
import { columns as expenseColumns } from '@/pages/expenses/columns';
import { useExpenses } from '@/hooks/useExpenseQueries';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import type { Expense } from '@/types/expenses';
import { getExpenseFilterFields } from '@/pages/expenses/fields';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';

type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMMM dd, yyyy');
  if (unit === 'week') return `${format(d, 'wo')} week, ${format(d, 'yyyy')}`;
  if (unit === 'month') return format(d, 'MMMM yyyy');
  if (unit === 'quarter')
    return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

interface ExpensesSectionProps {
  orgId?: string;
  branchIds: string[];
  dateRange?: DateRange;
  template: 'compact' | 'detailed' | 'pivot';
  groupBy: 'category' | 'type';
}

export function ExpensesSection({
  orgId,
  branchIds,
  dateRange,
  template,
  groupBy,
}: ExpensesSectionProps) {
  const normalizedBranchIds =
    branchIds && branchIds.length > 0 ? branchIds : undefined;
  const { data: expenses = [] } = useExpenses(orgId, normalizedBranchIds);
  const [filtered, setFiltered] = useState<Expense[]>(expenses);
  const [groupUnit, setGroupUnit] = useState<GroupUnit>('month');
  const startIso = dateRange?.from
    ? new Date(dateRange.from).toISOString()
    : null;
  const endIso = dateRange?.to ? new Date(dateRange.to).toISOString() : null;
  const { data: expenseStats } = useQuery({
    queryKey: [
      'reports',
      'expense_stats',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      if (!orgId) return null as any;
      const { data, error } = await supabase.rpc('get_expense_stats', {
        p_organization_id: orgId,
        p_branch_ids: (normalizedBranchIds ?? null) as any,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as {
        total_records: number;
        total_expenditure: number;
        top_category?: { category: string; amount: number } | null;
      };
    },
    enabled: !!orgId,
    placeholderData: (prev) =>
      prev ?? {
        total_records: 0,
        total_expenditure: 0,
        top_category: null,
      },
  });

  const {
    categories,
    types,
    branches,
    creators,
    paymentMethods,
    statuses,
  } = useMemo(() => {
    const catSet = new Set<string>();
    const typeSet = new Set<string>();
    const branchSet = new Set<string>();
    const creatorSet = new Set<string>();
    const pmSet = new Set<string>();
    const statusSet = new Set<string>();
    const catOpts: { label: string; value: string }[] = [];
    const typeOpts: { label: string; value: string }[] = [];
    const branchOpts: { label: string; value: string }[] = [];
    const creatorOpts: { label: string; value: string }[] = [];
    const pmOpts: { label: string; value: string }[] = [];
    const statusOpts: { label: string; value: string }[] = [];

    expenses.forEach((e) => {
      const c = e.categoryName || 'Uncategorized';
      if (!catSet.has(c)) {
        catSet.add(c);
        catOpts.push({ label: c, value: c });
      }
      const t = e.typeName || 'Unknown Type';
      if (!typeSet.has(t)) {
        typeSet.add(t);
        typeOpts.push({ label: t, value: t });
      }
      const b = e.branchName || 'All Branches';
      if (!branchSet.has(b)) {
        branchSet.add(b);
        branchOpts.push({ label: b, value: b });
      }
      const creator = e.createdByName || 'Unknown';
      if (!creatorSet.has(creator)) {
        creatorSet.add(creator);
        creatorOpts.push({ label: creator, value: creator });
      }
      const pm = e.paymentMethod;
      if (pm && !pmSet.has(pm)) {
        pmSet.add(pm);
        pmOpts.push({
          label: pm
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          value: pm,
        });
      }
      const s = e.status;
      if (s && !statusSet.has(s)) {
        statusSet.add(s);
        statusOpts.push({
          label: s.charAt(0).toUpperCase() + s.slice(1),
          value: s,
        });
      }
    });

    catOpts.sort((a, b) => a.label.localeCompare(b.label));
    typeOpts.sort((a, b) => a.label.localeCompare(b.label));
    branchOpts.sort((a, b) => a.label.localeCompare(b.label));
    creatorOpts.sort((a, b) => a.label.localeCompare(b.label));
    pmOpts.sort((a, b) => a.label.localeCompare(b.label));
    statusOpts.sort((a, b) => a.label.localeCompare(b.label));

    return {
      categories: catOpts,
      types: typeOpts,
      branches: branchOpts,
      creators: creatorOpts,
      paymentMethods: pmOpts,
      statuses: statusOpts,
    };
  }, [expenses]);

  const filterFields = useMemo(() => {
    return getExpenseFilterFields(
      categories,
      types,
      branches,
      creators,
      paymentMethods,
      statuses
    );
  }, [categories, types, branches, creators, paymentMethods, statuses]);

  const totalRecords = expenseStats?.total_records ?? filtered.length;
  const totalExpenditure =
    expenseStats?.total_expenditure ??
    filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  const pivotColumns = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const buckets = new Set<string>();
    filtered.forEach((e) => {
      const k = dateToBucketKey(e.date || e.createdAt || '', groupUnit);
      buckets.add(k);
    });
    return Array.from(buckets).sort((a, b) => a.localeCompare(b));
  }, [filtered, dateRange, groupUnit]);

  const pivotRows = useMemo(() => {
    const rowsMap = new Map<string, Record<string, number>>();
    filtered.forEach((e) => {
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
  }, [filtered, groupBy, groupUnit]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {totalRecords}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Expenditure</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
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
      </div>

      {template !== 'pivot' && (
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<Expense, unknown>
              columns={expenseColumns}
              data={expenses}
              searchKey="date"
              filterFields={filterFields}
              storageKey="reports-expenses"
              onFilteredDataChange={setFiltered}
            />
          </CardContent>
        </Card>
      )}

      {template === 'pivot' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Expenses Pivot (
                {groupBy === 'category' ? 'By Category' : 'By Type'})
              </CardTitle>
              <select
                value={groupUnit}
                onChange={(e) => setGroupUnit(e.target.value as GroupUnit)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
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
    </>
  );
}
