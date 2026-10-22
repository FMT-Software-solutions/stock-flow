import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay } from 'date-fns';
import { Download } from 'lucide-react';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import { Button } from '@/components/ui/button';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgPreference } from '@/hooks/preferences/useOrgPreference';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { supabase } from '@/utils/supabase';
import { CustomersSection } from './reports/CustomersSection';
import { DiscountsSection } from './reports/DiscountsSection';
import { ExpensesSection } from './reports/ExpensesSection';
import { ProductSalesSection } from './reports/ProductSalesSection';
import { SalesSection } from './reports/SalesSection';
import { StockActivitySection } from './reports/StockActivitySection';
import { StockOnHandSection } from './reports/StockOnHandSection';
import { SuppliersSection } from './reports/SuppliersSection';
import { BranchFilter } from './reports/components/BranchFilter';
import {
  LEGACY_TABS,
  REPORT_GROUPS,
  REPORTS,
  reportById,
  type ReportDef,
  type ReportId,
} from './reports/registry';

type CustomersReport = {
  total_customers: number;
  new_this_month: number;
  top_customers: { customer_id: string; name: string; total_spent: number; orders_count: number }[];
  customers_owing: {
    customer_id: string;
    name: string;
    total_owing: number;
    open_orders: number;
    last_owing_date: string | null;
  }[];
};

type SuppliersReport = {
  total_suppliers: number;
  new_this_month: number;
  new_suppliers: { id: string; name: string; created_at: string }[];
  top_suppliers: { supplier_id: string; name: string; product_count: number }[];
};

export function Reports() {
  const { formatCurrency } = useCurrency();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds: globalBranchIds, availableBranches } = useBranchContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = currentOrganization?.id;

  // Which report: the URL wins (links, refresh), then the last one used here.
  const [lastReport, setLastReport] = useOrgPreference<ReportId>(orgId, 'reports.last', 'sales_overview');
  const fromUrl = searchParams.get('report') ?? LEGACY_TABS[searchParams.get('tab') ?? ''];
  const report: ReportDef = reportById(fromUrl) ?? reportById(lastReport) ?? REPORTS[0];

  const openReport = (id: string) => {
    setSearchParams({ report: id }, { replace: true });
    setLastReport(id as ReportId);
    setExportOpen(false);
  };

  // One period and one branch selection shared by every report. Branches are
  // remembered; the period starts at All time.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [savedBranchIds, setSavedBranchIds] = useOrgPreference<string[] | null>(orgId, 'reports.branches', null);
  const branchIds = useMemo(
    () =>
      (savedBranchIds ?? globalBranchIds).filter((id) => availableBranches.some((b) => b.id === id)),
    [savedBranchIds, globalBranchIds, availableBranches]
  );

  const [exportOpen, setExportOpen] = useState(false);
  const [expensesGroupBy, setExpensesGroupBy] = useState<'category' | 'type'>('category');

  const startIso = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
  const endIso = dateRange?.to
    ? endOfDay(dateRange.to).toISOString()
    : dateRange?.from
      ? endOfDay(dateRange.from).toISOString()
      : null;

  const customersReport = useQuery({
    queryKey: ['reports', 'customers', orgId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customers_report', {
        p_organization_id: orgId,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as CustomersReport;
    },
    enabled: !!orgId && report.id === 'customers',
  });

  const suppliersReport = useQuery({
    queryKey: ['reports', 'suppliers', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_suppliers_report', { p_organization_id: orgId });
      if (error) throw error;
      return data as SuppliersReport;
    },
    enabled: !!orgId && report.id === 'suppliers',
  });

  const exportProps = { exportOpen, onExportClose: () => setExportOpen(false) };
  const periodProps = { orgId, branchIds, dateRange };

  const renderReport = () => {
    switch (report.id) {
      case 'sales_overview':
        return <SalesSection {...periodProps} {...exportProps} view="overview" />;
      case 'product_sales':
        return <ProductSalesSection {...periodProps} {...exportProps} />;
      case 'sales_list':
        return <SalesSection {...periodProps} {...exportProps} view="list" />;
      case 'payments':
        return <SalesSection {...periodProps} {...exportProps} view="payments" />;
      case 'sales_breakdown':
        return <SalesSection {...periodProps} {...exportProps} view="breakdown" />;
      case 'discounts':
        return <DiscountsSection {...periodProps} {...exportProps} />;
      case 'stock_on_hand':
        return (
          <StockOnHandSection
            orgId={orgId}
            branchIds={branchIds}
            organizationName={currentOrganization?.name}
            {...exportProps}
          />
        );
      case 'stock_activity':
        return <StockActivitySection {...periodProps} {...exportProps} />;
      case 'expenses':
      case 'expenses_breakdown':
        return (
          <ExpensesSection
            {...periodProps}
            {...exportProps}
            view={report.id === 'expenses' ? 'overview' : 'breakdown'}
            groupBy={expensesGroupBy}
            setGroupBy={setExpensesGroupBy}
          />
        );
      case 'customers':
        return (
          <CustomersSection
            data={customersReport.data}
            formatCurrency={formatCurrency}
            organizationName={currentOrganization?.name}
            dateRange={dateRange}
            {...exportProps}
          />
        );
      case 'suppliers':
        return (
          <SuppliersSection
            data={suppliersReport.data}
            organizationName={currentOrganization?.name}
            {...exportProps}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Reports</h1>

      {/* Report menu: area tabs, then that area's reports. Both rows scroll
          sideways when narrow, so the reports keep the full page width. */}
      <div className="space-y-2">
        <nav aria-label="Report areas" className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-1">
          {REPORT_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => openReport(REPORTS.find((r) => r.group === group)!.id)}
              aria-current={group === report.group ? 'true' : undefined}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                group === report.group
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {group}
            </button>
          ))}
        </nav>
        <nav aria-label="Reports" className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
          {REPORTS.filter((r) => r.group === report.group).map((r) => (
            <button
              key={r.id}
              type="button"
              title={r.hint}
              onClick={() => openReport(r.id)}
              aria-current={r.id === report.id ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-sm transition-colors',
                r.id === report.id
                  ? 'bg-primary/15 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </nav>
      </div>

      {/* One filter bar for every report; each shows what applies to it. */}
      <div className="flex flex-wrap items-center gap-2">
        {report.period && (
          <DatePickerWithRange
            date={dateRange}
            setDate={setDateRange}
            placeholder="All time"
            className="w-full sm:w-64"
          />
        )}
        {report.branches && availableBranches.length > 1 && (
          <BranchFilter
            branches={availableBranches}
            value={branchIds}
            onChange={setSavedBranchIds}
            className="w-full sm:w-48"
          />
        )}
        <Button variant="outline" className="sm:ml-auto" onClick={() => setExportOpen(true)}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      <div key={report.id} className="space-y-4">
        {renderReport()}
      </div>
    </div>
  );
}
