import React from 'react';
import {
  FinanceStatsCards,
  incomeStatsConfig,
  expenseStatsConfig,
  pledgeStatsConfig,
  balanceStatsConfig,
} from '@/components/finance';
import { contributionDonationStatsConfig } from '@/components/finance/contributions/ContributionDonationStatsConfig';
import { FinanceReportGenerator } from '@/components/finance/FinanceReportGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsFilterBar, type StatsFilter } from '@/components/finance/StatsFilterBar';
import { useBranches } from '@/hooks/useBranchQueries';
import {
  useIncomeStatsData,
  useExpenseStatsData,
  useContributionStatsData,
  usePledgeStatsData,
} from '@/hooks/finance/useFinanceStats';
import { mapDateFilterToPicker, mapPickerToDateFilter } from '@/utils/finance/dateFilter';
import { useIncomes } from '@/hooks/finance/income';
import { useExpenses } from '@/hooks/finance/expenses';
import { usePledges } from '@/hooks/finance/pledges';
import { useAllPledgePayments, usePledgePaymentsAsIncome } from '@/hooks/finance/payments';
import type { FinanceFilter, IncomeResponseRow, ExpenseRecord, PledgeRecord, PledgePayment } from '@/types/finance';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Separator } from '@/components/ui/separator';

export function InsightsReports() {
  const [filters, setFilters] = React.useState<FinanceFilter>({
    date_filter: mapPickerToDateFilter(
      mapDateFilterToPicker({ type: 'preset', preset: 'this_month' })
    ),
  });
  const [mode, setMode] = React.useState<'stats' | 'builder'>('stats');
  const [statsFilters, setStatsFilters] = React.useState<StatsFilter>({
    date_filter: mapPickerToDateFilter(
      mapDateFilterToPicker({ type: 'preset', preset: 'this_month' })
    ),
    item: 'all',
    branch_id_filter: undefined,
  });
  const [pageSize] = React.useState<number>(10000);
  const { currentOrganization } = useOrganization();
  const { data: allBranches = [] } = useBranches(currentOrganization?.id);
  const statsBranchName = React.useMemo(() => {
    const bid = statsFilters.branch_id_filter?.[0];
    if (!bid) return undefined;
    const b = (allBranches as any[]).find((br) => br.id === bid);
    return b?.name as string | undefined;
  }, [statsFilters.branch_id_filter, allBranches]);

  // Effective branch/date filters per mode
  const effectiveBranchFilter = mode === 'stats' ? statsFilters.branch_id_filter : filters.branch_id_filter;
  const effectiveDateFilter = mode === 'stats' ? statsFilters.date_filter : filters.date_filter;

  // --- RPC Stats Queries (Used in 'stats' mode) ---
  const incomeStatsQuery = useIncomeStatsData({
    filters: {
      date_filter: effectiveDateFilter,
      branch_id_filter: effectiveBranchFilter,
    },
    income_type: 'general_income',
  });

  const expenseStatsQuery = useExpenseStatsData({
    filters: {
      date_filter: effectiveDateFilter,
      branch_id_filter: effectiveBranchFilter,
    },
  });

  const contribDonateStatsQuery = useContributionStatsData({
    filters: {
      date_filter: effectiveDateFilter,
      branch_id_filter: effectiveBranchFilter,
    },
    income_types: ['contribution', 'donation'],
  });

  const pledgeStatsQuery = usePledgeStatsData({
    filters: {
      date_filter: effectiveDateFilter,
      branch_id_filter: effectiveBranchFilter,
    },
  });

  // --- Stats Mode: Pledge Payments Calculation ---
  // We fetch pledge payments in stats mode to correctly calculate total revenue,
  // as the RPC pledgeStatsQuery might filter by pledge creation date rather than payment date.
  const pledgePaymentsStatsQ = usePledgePaymentsAsIncome({
    page: 1,
    pageSize: 10000,
    dateFilter: effectiveDateFilter,
    filters: { date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    enabled: mode === 'stats',
  });

  const totalPledgePayments = React.useMemo(() => {
    const items = pledgePaymentsStatsQ.data?.data || [];
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [pledgePaymentsStatsQ.data]);

  // --- Paginated Queries (Used in 'builder' mode) ---
  const isBuilderMode = mode === 'builder';
  
  const generalIncomeQ = useIncomes({
    page: 1,
    pageSize,
    filters: { ...filters, date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    income_type: 'general_income',
    enabled: isBuilderMode,
  });
  const contribDonateQ = useIncomes({
    page: 1,
    pageSize,
    filters: { ...filters, date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    income_types: ['contribution', 'donation'],
    enabled: isBuilderMode,
  });
  const pledgePaymentsIncomeQ = usePledgePaymentsAsIncome({
    page: 1,
    pageSize,
    dateFilter: effectiveDateFilter,
    filters: { date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    enabled: isBuilderMode,
  });
  const expensesQ = useExpenses({ 
    page: 1, 
    pageSize, 
    filters: { ...filters, date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    enabled: isBuilderMode,
  });
  const pledgesQ = usePledges({
    page: 1,
    pageSize,
    filters: { date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    enabled: isBuilderMode,
  });
  const paymentsQ = useAllPledgePayments({
    page: 1,
    pageSize,
    dateFilter: effectiveDateFilter,
    filters: { date_filter: effectiveDateFilter, branch_id_filter: effectiveBranchFilter },
    enabled: isBuilderMode,
  });

  // Derived arrays (only populated in builder mode)
  const generalIncome = (generalIncomeQ.data?.data ||
    []) as IncomeResponseRow[];
  const contribDonateIncome = (contribDonateQ.data?.data ||
    []) as IncomeResponseRow[];
  const pledgePaymentsIncome = (pledgePaymentsIncomeQ.data?.data || []) as IncomeResponseRow[];
  const expenses = (expensesQ.data?.data || []) as ExpenseRecord[];
  const pledges = (pledgesQ.data?.data || []) as PledgeRecord[];
  const payments = (paymentsQ.data?.data || []) as PledgePayment[];

  // Stats — Income (RPC)
  const incomeStats = React.useMemo(() => {
    const data = incomeStatsQuery.data;
    if (!data) return incomeStatsConfig({
      totalIncome: 0,
      recordCount: 0,
      averageIncome: 0,
      topOccasion: 'N/A',
      topOccasionAmount: 0,
    });
    return incomeStatsConfig({
      totalIncome: data.total_income,
      recordCount: data.record_count,
      averageIncome: data.average_income,
      topOccasion: data.top_occasion,
      topOccasionAmount: data.top_occasion_amount,
    });
  }, [incomeStatsQuery.data]);

  // Stats — Contributions & Donations (RPC)
  const contribDonateStats = React.useMemo(() => {
    const data = contribDonateStatsQuery.data;
    if (!data) return contributionDonationStatsConfig({
      totalContributionAmount: 0,
      totalDonationAmount: 0,
      recordCount: 0,
      averageAmount: 0,
      topContributor: 'N/A',
      topContributorAmount: 0,
    });
    return contributionDonationStatsConfig({
      totalContributionAmount: data.totalContributionAmount,
      totalDonationAmount: data.totalDonationAmount,
      recordCount: data.recordCount,
      averageAmount: data.averageAmount,
      topContributor: data.topContributor,
      topContributorAmount: data.topContributorAmount,
    });
  }, [contribDonateStatsQuery.data]);

  // Stats — Expenses (RPC)
  const expenseStats = React.useMemo(() => {
    const data = expenseStatsQuery.data;
    if (!data) return expenseStatsConfig({
      totalExpenses: 0,
      recordCount: 0,
      averageExpense: 0,
      topCategory: 'N/A',
      topCategoryAmount: 0,
    });
    return expenseStatsConfig({
      totalExpenses: data.total_expenses,
      recordCount: data.record_count,
      averageExpense: data.average_expense,
      topCategory: data.top_purpose,
      topCategoryAmount: data.top_purpose_amount,
    });
  }, [expenseStatsQuery.data]);

  // Stats — Pledges summary (RPC)
  const pledgeStats = React.useMemo(() => {
    const data = pledgeStatsQuery.data;
    if (!data) return pledgeStatsConfig({
      totalPledges: 0,
      recordCount: 0,
      fulfilledAmount: 0,
      pendingAmount: 0,
      fulfillmentRate: 0,
    });
    return pledgeStatsConfig({
      totalPledges: data.totalPledges,
      recordCount: data.recordCount,
      fulfilledAmount: data.fulfilledAmount,
      pendingAmount: data.pendingAmount,
      fulfillmentRate: data.fulfillmentRate,
    });
  }, [pledgeStatsQuery.data]);

  // Stats — Balance (Derived)
  const balanceStats = React.useMemo(() => {
    const generalIncome = incomeStatsQuery.data?.total_income || 0;
    const contribDonateTotal = contribDonateStatsQuery.data?.totalAmount || 0;
    const totalExpenses = expenseStatsQuery.data?.total_expenses || 0;

    return balanceStatsConfig({
      totalIncome: generalIncome + contribDonateTotal + totalPledgePayments,
      totalExpenses,
    });
  }, [incomeStatsQuery.data, contribDonateStatsQuery.data, expenseStatsQuery.data, totalPledgePayments]);

  // Report generation is handled by the embedded FinanceReportGenerator section

  const loading =
    generalIncomeQ.isLoading ||
    contribDonateQ.isLoading ||
    pledgePaymentsIncomeQ.isLoading ||
    expensesQ.isLoading ||
    pledgesQ.isLoading ||
    paymentsQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Insights & Reports</h2>
        <Button
          variant="outline"
          onClick={() => setMode(mode === 'stats' ? 'builder' : 'stats')}
        >
          {mode === 'stats' ? 'Generate Finance Report' : 'Back to General Stats'}
        </Button>
      </div>

      {mode === 'stats' ? (
        <>
          <StatsFilterBar value={statsFilters} onChange={setStatsFilters} />

          <Card>
            <CardHeader>
              <CardTitle>General Stats</CardTitle>
              <p className="text-sm text-muted-foreground">{statsBranchName ? `Branch: ${statsBranchName}` : 'Branch: All branches'}</p>
            </CardHeader>
            <CardContent>
              {statsFilters.item === 'all' && (
                <div className="grid grid-cols-1 gap-4">
                  <FinanceStatsCards stats={balanceStats} loading={incomeStatsQuery.isLoading || expenseStatsQuery.isLoading || contribDonateStatsQuery.isLoading || pledgePaymentsStatsQ.isLoading} />
                  <Separator className="my-4" />
                  <FinanceStatsCards stats={incomeStats} loading={incomeStatsQuery.isLoading} />
                  <FinanceStatsCards stats={expenseStats} loading={expenseStatsQuery.isLoading} />
                  <FinanceStatsCards stats={contribDonateStats} loading={contribDonateStatsQuery.isLoading} />
                  <FinanceStatsCards stats={pledgeStats} loading={pledgeStatsQuery.isLoading} />
                </div>
              )}

              {statsFilters.item === 'income' && (
                <FinanceStatsCards stats={incomeStats} loading={incomeStatsQuery.isLoading} />
              )}
              {statsFilters.item === 'expenses' && (
                <FinanceStatsCards stats={expenseStats} loading={expenseStatsQuery.isLoading} />
              )}
              {statsFilters.item === 'contrib' && (
                <FinanceStatsCards stats={contribDonateStats} loading={contribDonateStatsQuery.isLoading} />
              )}
              {statsFilters.item === 'pledges' && (
                <FinanceStatsCards stats={pledgeStats} loading={pledgeStatsQuery.isLoading} />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <FinanceReportGenerator
          filters={filters}
          onFiltersChange={setFilters}
          incomes={[...generalIncome, ...contribDonateIncome, ...pledgePaymentsIncome].sort((a, b) => {
            const da = new Date(a.date || a.created_at || 0).getTime();
            const db = new Date(b.date || b.created_at || 0).getTime();
            return db - da;
          })}
          expenses={[...expenses].sort((a, b) => {
            const da = new Date(a.date || a.created_at || 0).getTime();
            const db = new Date(b.date || b.created_at || 0).getTime();
            return db - da;
          })}
          pledges={pledges}
          payments={payments}
          loading={loading}
        />
      )}
    </div>
  );
}
