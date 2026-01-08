import { useState } from 'react';
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
import { getExpenseStatsGroups } from './expenses/fields';
import { useMemo } from 'react';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { Expense } from '@/types/expenses';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export function Expenses() {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { formatCurrency } = useCurrency();
  const { data: expenses = [] } = useExpenses(
    currentOrganization?.id,
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined
  );
  const expenseStatsGroups = useMemo(
    () => getExpenseStatsGroups(formatCurrency),
    [formatCurrency]
  );
  const { checkPermission } = useRoleCheck();
  const canCreateExpenses = checkPermission('expenses', 'create');
  const canManageCategories = checkPermission('expense_categories');
  const canManageTypes = checkPermission('expense_types');

  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [summaryMode, setSummaryMode] = useLocalStorage<'filtered' | 'all'>(
    `stockflow-expenses-summary-mode-${currentOrganization?.id || 'global'}`,
    'filtered'
  );
  const summaryData = summaryMode === 'filtered' ? filteredExpenses : expenses;

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
        groups={expenseStatsGroups}
        data={summaryData}
        storageKey="expenses-stats-is-open"
        summaryLabel="Expenses Summary"
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
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
