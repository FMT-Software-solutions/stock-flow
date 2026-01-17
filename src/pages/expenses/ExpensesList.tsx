import { DataTable } from '@/components/shared/data-table/data-table';
import { columns } from './columns';
import {
  useExpenses,
  useExpenseCategories,
  useExpenseTypes,
} from '@/hooks/useExpenseQueries';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { getExpenseFilterFields, expenseExportFields } from './fields';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import type { Expense } from '@/types/expenses';
import type { DateRange } from 'react-day-picker';

export function ExpensesList({
  onFilteredDataChange,
  dateConstraints,
  defaultDateRange,
}: {
  onFilteredDataChange?: (rows: Expense[]) => void;
  dateConstraints?: { minDate?: Date; maxDate?: Date; defaultValue?: DateRange };
  defaultDateRange: DateRange;
}) {
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds } = useBranchContext();
  const { checkPermission } = useRoleCheck();

  const branchIds =
    selectedBranchIds.length > 0 ? selectedBranchIds : undefined;

  const { data: expenses = [], isLoading } = useExpenses(
    currentOrganization?.id,
    branchIds
  );

  // No longer using these for filters, but might keep if needed elsewhere,
  // or remove if unused. The linter complained they were unused.
  useExpenseCategories(currentOrganization?.id);
  useExpenseTypes(currentOrganization?.id);

  const { availableBranches } = useBranchContext();

  // Extract unique values for filters from the actual data
  const {
    categoryOptions,
    typeOptions,
    paymentMethodOptions,
    statusOptions,
  } = useMemo(() => {
    const uniqueCategories = new Set<string>();
    const uniqueTypes = new Set<string>();
    const uniquePaymentMethods = new Set<string>();
    const uniqueStatuses = new Set<string>();

    const catOptions: { label: string; value: string }[] = [];
    const typeOpts: { label: string; value: string }[] = [];
    const pmOptions: { label: string; value: string }[] = [];
    const statOptions: { label: string; value: string }[] = [];

    let hasUncategorized = false;
    let hasUnknownType = false;

    expenses.forEach((expense) => {
      // Categories
      if (!expense.categoryName) {
        hasUncategorized = true;
      } else if (!uniqueCategories.has(expense.categoryName)) {
        uniqueCategories.add(expense.categoryName);
        catOptions.push({
          label: expense.categoryName,
          value: expense.categoryName,
        });
      }

      // Types
      if (!expense.typeName) {
        hasUnknownType = true;
      } else if (!uniqueTypes.has(expense.typeName)) {
        uniqueTypes.add(expense.typeName);
        typeOpts.push({ label: expense.typeName, value: expense.typeName });
      }

      // Payment Methods
      if (
        expense.paymentMethod &&
        !uniquePaymentMethods.has(expense.paymentMethod)
      ) {
        uniquePaymentMethods.add(expense.paymentMethod);
        // Format label nicely (e.g. credit_card -> Credit Card)
        const label = expense.paymentMethod
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        pmOptions.push({ label: label, value: expense.paymentMethod });
      }

      // Statuses
      if (expense.status && !uniqueStatuses.has(expense.status)) {
        uniqueStatuses.add(expense.status);
        const label =
          expense.status.charAt(0).toUpperCase() + expense.status.slice(1);
        statOptions.push({ label: label, value: expense.status });
      }
    });

    const sortedCategories = catOptions.sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    const sortedTypes = typeOpts.sort((a, b) => a.label.localeCompare(b.label));
    const sortedPaymentMethods = pmOptions.sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    const sortedStatuses = statOptions.sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    if (hasUncategorized) {
      sortedCategories.unshift({
        label: 'Uncategorized',
        value: 'Uncategorized',
      });
    }
    if (hasUnknownType) {
      sortedTypes.unshift({ label: 'Unknown Type', value: 'Unknown Type' });
    }

    return {
      categoryOptions: sortedCategories,
      typeOptions: sortedTypes,
      paymentMethodOptions: sortedPaymentMethods,
      statusOptions: sortedStatuses,
    };
  }, [expenses]);

  // Extract unique creators for filter
  const creators = useMemo(() => {
    const uniqueCreators = new Set<string>();
    const creatorOptions: { label: string; value: string }[] = [];

    expenses.forEach((expense) => {
      if (expense.createdByName && !uniqueCreators.has(expense.createdByName)) {
        uniqueCreators.add(expense.createdByName);
        creatorOptions.push({
          label: expense.createdByName,
          value: expense.createdByName,
        });
      }
    });

    return creatorOptions;
  }, [expenses]);

  const filterFields = getExpenseFilterFields(
    categoryOptions,
    typeOptions,
    availableBranches.map((b) => ({ label: b.name, value: b.name })),
    creators,
    paymentMethodOptions,
    statusOptions,
    dateConstraints
  );

  return (
    <div className={cn(isLoading ? 'opacity-50' : '')}>
      <DataTable
        key={`${currentOrganization?.id ?? 'no-org'}-${
          dateConstraints?.minDate?.toISOString() ?? 'no-min'
        }`}
        columns={columns}
        data={expenses}
        searchKey="search"
        filterFields={filterFields}
        exportFields={expenseExportFields}
        defaultColumnVisibility={{ search: false }}
        defaultColumnFilters={[{ id: 'date', value: defaultDateRange }]}
        canExport={checkPermission('expenses', 'export')}
        onFilteredDataChange={
          onFilteredDataChange as ((rows: Expense[]) => void) | undefined
        }
        orgId={currentOrganization?.id}
        storageKey="stockflow-expenses-table"
      />
    </div>
  );
}
