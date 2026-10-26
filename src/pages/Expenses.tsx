import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExpensesList } from './expenses/ExpensesList';
import { ExpenseConfiguration } from './expenses/ExpenseConfiguration';
import { AddExpenseDialog } from './expenses/AddExpenseDialog';
import { StatsContainer } from '@/components/shared/stats/StatsContainer';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { useExpenses } from '@/hooks/useExpenseQueries';
import { useCurrency } from '@/hooks/useCurrency';
import { getExpenseStatTiles } from './expenses/expenseStats';
import { buildPeriod } from './dashboard/period';
import { useTableFilters } from '@/hooks/useTableFilters';
import { usePeriodFigures } from '@/hooks/usePeriodFigures';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { Expense } from '@/types/expenses';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { endOfDay, startOfDay, subDays, subMonths, subYears } from 'date-fns';
import type { DataLookback, UserPermissions } from '@/modules/permissions';
import type { DateRange } from 'react-day-picker';

/** The table's date filter, if any. */
const currentDateRange = (filters: { id: string; value: unknown }[]) => {
  const value = filters.find((f) => f.id === 'date')?.value as { from?: Date | string; to?: Date | string } | undefined;
  return value?.from ? { from: new Date(value.from), to: value.to ? new Date(value.to) : undefined } : null;
};

export function Expenses() {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { formatCurrency } = useCurrency();
  const { data: expenses = [] } = useExpenses(
    currentOrganization?.id,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined
  );
  const { checkPermission } = useRoleCheck();
  const canCreateExpenses = checkPermission('expenses', 'create');
  const canManageCategories = checkPermission('expense_categories');
  const canManageTypes = checkPermission('expense_types');

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
      userPermissions?.expenses?.dataAccess?.maxLookback ?? {
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

  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [summaryMode, setSummaryMode] = useOrgPreference<'filtered' | 'all'>(
    currentOrganization?.id,
    'expenses.summaryMode',
    'filtered'
  );
  const summaryData =
    minDate ? filteredExpenses : summaryMode === 'filtered' ? filteredExpenses : expenses;

  const table = useTableFilters([{ id: 'date', value: defaultDateRange }]);
  const { setFilters } = table;
  useEffect(() => {
    setFilters([{ id: 'date', value: defaultDateRange }]);
  }, [defaultDateRange, setFilters]);

  // Compare with the period before when the table is filtered by date only.
  const dateOnly = summaryData === filteredExpenses ? table.onlyDateRange() : null;
  const comparison = useMemo(
    () => (dateOnly ? buildPeriod(dateOnly, new Date(), minDate) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateOnly?.from?.getTime(), dateOnly?.to?.getTime(), minDate]
  );
  const prevRange =
    comparison?.prevStart && comparison.prevEnd ? { start: comparison.prevStart, end: comparison.prevEnd } : null;
  const { data: previous } = usePeriodFigures(currentOrganization?.id, selectedBranchIds, prevRange);

  const tiles = getExpenseStatTiles({
    expenses: summaryData,
    money: formatCurrency,
    previousTotal: prevRange ? previous?.expenses : null,
    prevLabel: comparison?.prevLabel,
    range: summaryData === filteredExpenses ? table.onlyDateRange() ?? currentDateRange(table.filters) : null,
    isActive: table.isActive,
    toggle: table.toggle,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Manage your expenses and categories.
          </p>
        </div>
        {canCreateExpenses && (
          <div className="flex gap-2">
            <AddExpenseDialog
              open={isAddExpenseOpen}
              onOpenChange={setIsAddExpenseOpen}
            >
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Record Expenses
              </Button>
            </AddExpenseDialog>
          </div>
        )}
      </div>

      <StatsContainer
        tiles={tiles}
        storageKey="expenses-stats-is-open"
        summaryLabel="Expenses Summary"
        orgId={currentOrganization?.id}
        summaryMode={minDate ? undefined : summaryMode}
        onSummaryModeChange={minDate ? undefined : setSummaryMode}
      />

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Expenses List</TabsTrigger>
          {(canManageCategories || canManageTypes) && (
            <TabsTrigger value="configuration">Categories & Types</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <ExpensesList
            dateConstraints={{
              minDate,
              maxDate,
              defaultValue: minDate ? defaultDateRange : undefined,
            }}
            defaultDateRange={defaultDateRange}
            columnFilters={table.filters}
            onColumnFiltersChange={table.setFilters}
            onFilteredDataChange={(rows) =>
              setFilteredExpenses(rows as Expense[])
            }
          />
        </TabsContent>

        {(canManageCategories || canManageTypes) && (
          <TabsContent value="configuration" className="space-y-4">
            <ExpenseConfiguration />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
