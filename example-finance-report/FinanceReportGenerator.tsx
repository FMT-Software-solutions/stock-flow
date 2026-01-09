import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, FileSpreadsheet, Printer } from 'lucide-react';
import type { FinanceFilter, IncomeResponseRow, ExpenseRecord, PledgeRecord, PledgePayment } from '@/types/finance';
import { DatePresetPicker, type DatePresetValue } from '@/components/attendance/reports/DatePresetPicker';
import { mapPickerToDateFilter, mapDateFilterToPicker } from '@/utils/finance/dateFilter';
import { buildPivotSpec, type GroupUnit } from '@/utils/finance/grouping';
import { formatDateFilterLabel } from '@/utils/finance/dateRange';
import { expenseSections } from '@/utils/finance/reports/aggregations';
import { PivotTable, type PivotRow } from '@/components/finance/reports/PivotTable';
import { IncomeStatement } from '@/components/finance/reports/templates/IncomeStatement';
import { PledgesSummary } from '@/components/finance/reports/templates/PledgesSummary';
import { DonationsBreakdown } from '@/components/finance/reports/templates/DonationsBreakdown';
import { IncomeDetailListSection, ExpensesDetailListSection, PledgePaymentsDetailListSection } from '@/components/finance/reports/DetailList';
import { PledgesTable } from '@/components/finance/pledges/PledgesTable';
import * as XLSXBase from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
const XLSX = XLSXStyle as unknown as typeof XLSXBase;
import { useReactToPrint } from 'react-to-print';
import { parseISO, format as formatDate } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useReportTemplateLabels } from '@/hooks/reports/useReportTemplateLabels';
import { useExpensePreferences } from '@/hooks/finance/useExpensePreferences';
import { BranchSelector } from '@/components/shared/BranchSelector';
import { useBranches } from '@/hooks/useBranchQueries';
import {
  DEFAULT_INCOME_STATEMENT_LABELS,
  DEFAULT_PLEDGES_SUMMARY_LABELS,
  DEFAULT_DONATIONS_BREAKDOWN_LABELS,
} from '@/db/reportTemplatePrefsDb';
import { buildIncomePivot as buildIncomePivotExt, buildExpensesPivot as buildExpensesPivotExt, buildPledgesPivot as buildPledgesPivotExt } from '@/components/finance/report-generator/pivot';
import { buildPivotWorkbook } from '@/components/finance/report-generator/excel/pivotExcel';
import { buildListWorkbook } from '@/components/finance/report-generator/excel/listExcel';
import { buildIncomeStatementWorkbook } from '@/components/finance/report-generator/excel/templates/incomeStatementExcel';
import { buildPledgesSummaryWorkbook } from '@/components/finance/report-generator/excel/templates/pledgesSummaryExcel';
import { buildDonationsBreakdownWorkbook } from '@/components/finance/report-generator/excel/templates/donationsBreakdownExcel';
import { paymentMethodOptions } from '@/components/finance/constants';

type FinanceItemType = 'general_income' | 'contributions' | 'donations' | 'pledge_payments' | 'expenses' | 'pledges' | 'all_income';

interface FinanceReportGeneratorProps {
  filters: FinanceFilter;
  onFiltersChange?: (next: FinanceFilter) => void;
  incomes?: IncomeResponseRow[];
  expenses?: ExpenseRecord[];
  pledges?: PledgeRecord[];
  payments?: PledgePayment[];
  loading?: boolean;
}

export const FinanceReportGenerator: React.FC<FinanceReportGeneratorProps> = ({
  filters,
  onFiltersChange,
  incomes = [],
  expenses = [],
  pledges = [],
  payments = [],
  loading,
}) => {
  const [selectedItems, setSelectedItems] = React.useState<FinanceItemType[]>(['general_income']);
  const [groupUnit, setGroupUnit] = React.useState<GroupUnit>('month');
  const [layout, setLayout] = React.useState<'pivot' | 'list' | 'template'>('pivot');
  const [templateStyle, setTemplateStyle] = React.useState<'income_statement' | 'pledges_summary' | 'donations_breakdown'>('income_statement');
  const [expenseGrouping, setExpenseGrouping] = React.useState<'category' | 'purpose'>('purpose');
  const [datePresetValue, setDatePresetValue] = React.useState<DatePresetValue>(mapDateFilterToPicker(filters.date_filter));
  const reportTitle = 'Finance Report';

  // Persistent editable titles for pivot sections (Dexie-backed)
  type PivotLabelKey =
    | 'all_income'
    | 'general_income'
    | 'contributions'
    | 'donations'
    | 'pledge_payments'
    | 'expenses'
    | 'pledges';
  type PivotLabels = Record<PivotLabelKey, string>;
  const DEFAULT_PIVOT_LABELS: PivotLabels = {
    all_income: 'All Income',
    general_income: 'General Income',
    contributions: 'Contributions',
    donations: 'Donations',
    pledge_payments: 'Pledge Payments',
    expenses: 'Expenses',
    pledges: 'Pledges',
  };
  const { labels: pivotLabels, setLabel: setPivotLabel } =
    useReportTemplateLabels<PivotLabels>('finance_pivot', DEFAULT_PIVOT_LABELS);

  // Editable labels for template exports to ensure CSV/Excel reflect user changes
  const { labels: incomeLabels } = useReportTemplateLabels('income_statement', DEFAULT_INCOME_STATEMENT_LABELS);
  const { labels: pledgesLabels } = useReportTemplateLabels('pledges_summary', DEFAULT_PLEDGES_SUMMARY_LABELS);
  const { labels: donationsLabels } = useReportTemplateLabels('donations_breakdown', DEFAULT_DONATIONS_BREAKDOWN_LABELS);
  
  const { prefs: expensePrefs } = useExpensePreferences();
  const categoryLabelMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (expensePrefs?.categories) {
      expensePrefs.categories.forEach((c: any) => {
        map[c.key] = c.label;
      });
    }
    return map;
  }, [expensePrefs]);

  React.useEffect(() => {
    setDatePresetValue(mapDateFilterToPicker(filters.date_filter));
  }, [filters.date_filter]);

  const handleDatePresetChange = (val: DatePresetValue) => {
    setDatePresetValue(val);
    const df = mapPickerToDateFilter(val);
    const next: FinanceFilter = { ...filters, date_filter: df };
    onFiltersChange?.(next);
  };

  const toggleItem = (type: FinanceItemType, checked: boolean | 'indeterminate') => {
    setSelectedItems((prev) => {
      const exists = prev.includes(type);
      if (checked && !exists) return [...prev, type];
      if (!checked && exists) return prev.filter((t) => t !== type);
      return prev;
    });
  };

  const spec = buildPivotSpec(filters.date_filter, groupUnit);
  const columnOrder = spec.buckets.map((b) => b.key);
  const columnLabels = spec.buckets.reduce<Record<string, string>>((acc, b) => {
    acc[b.key] = b.label;
    return acc;
  }, {});
  const rangeLabel = formatDateFilterLabel(filters.date_filter) || '';


  // (Optional) payments pivot can be added later using payments[] when needed

  const sections = React.useMemo(() => {
    const s: Array<{ key: string; title: string; rows: PivotRow[]; rowHeaderLabel?: string }> = [];
    if (selectedItems.includes('all_income')) {
      const { rows } = buildIncomePivotExt(incomes, pivotLabels['all_income'], groupUnit, columnOrder);
      s.push({ key: 'all_income', title: pivotLabels['all_income'], rows });
    }
    if (selectedItems.includes('general_income')) {
      const { rows } = buildIncomePivotExt(incomes, pivotLabels['general_income'], groupUnit, columnOrder, 'general_income');
      s.push({ key: 'general_income', title: pivotLabels['general_income'], rows });
    }
    if (selectedItems.includes('contributions')) {
      const { rows } = buildIncomePivotExt(incomes, pivotLabels['contributions'], groupUnit, columnOrder, 'contribution');
      s.push({ key: 'contributions', title: pivotLabels['contributions'], rows });
    }
    if (selectedItems.includes('donations')) {
      const { rows } = buildIncomePivotExt(incomes, pivotLabels['donations'], groupUnit, columnOrder, 'donation');
      s.push({ key: 'donations', title: pivotLabels['donations'], rows });
    }
    if (selectedItems.includes('pledge_payments')) {
      const { rows } = buildIncomePivotExt(incomes, pivotLabels['pledge_payments'], groupUnit, columnOrder, 'pledge_payment');
      s.push({ key: 'pledge_payments', title: pivotLabels['pledge_payments'], rows });
    }
    if (selectedItems.includes('expenses')) {
      const { rows } = buildExpensesPivotExt(expenses, groupUnit, columnOrder, expenseGrouping, categoryLabelMap);
      s.push({ 
        key: 'expenses', 
        title: pivotLabels['expenses'], 
        rows,
        rowHeaderLabel: expenseGrouping === 'category' ? 'Category' : 'Purpose'
      });
    }
    if (selectedItems.includes('pledges')) {
      const { rows } = buildPledgesPivotExt(pledges, groupUnit, columnOrder);
      s.push({ key: 'pledges', title: pivotLabels['pledges'], rows });
    }
    return s;
  }, [selectedItems, incomes, expenses, pledges, payments, groupUnit, filters.date_filter, pivotLabels, expenseGrouping]);

  const handlePivotTitleSave = (key: string, value: string) => {
    setPivotLabel(key as PivotLabelKey, value);
  };

  // Export helpers
  const printRef = React.useRef<HTMLDivElement | null>(null);
  const { currentOrganization } = useOrganization();
  const { data: allBranches = [] } = useBranches(currentOrganization?.id);
  const branchName = React.useMemo(() => {
    const bid = filters.branch_id_filter?.[0];
    if (!bid) return undefined;
    const b = (allBranches as any[]).find((br) => br.id === bid);
    return b?.name as string | undefined;
  }, [filters.branch_id_filter, allBranches]);

  

  const exportWorkbook = (format: 'excel' | 'csv' | 'pdf' | 'print') => {
    const safeTitle = reportTitle;
    if (format === 'print') {
      handlePrint();
      return;
    }
    if (format === 'excel') {
      let wb: any;
      if (layout === 'pivot') {
        wb = buildPivotWorkbook(sections.map((s) => ({ title: s.title, rows: s.rows })), columnOrder, columnLabels);
      } else if (layout === 'list') {
        wb = buildListWorkbook(incomes, expenses, pledges, selectedItems, expenseGrouping, pivotLabels);
      } else if (layout === 'template') {
        if (templateStyle === 'income_statement') {
          wb = buildIncomeStatementWorkbook(incomes, expenses, incomeLabels as any, groupUnit, columnOrder, columnLabels, expenseGrouping);
        } else if (templateStyle === 'pledges_summary') {
          wb = buildPledgesSummaryWorkbook(pledges, pledgesLabels as any);
        } else {
          wb = buildDonationsBreakdownWorkbook(incomes, donationsLabels as any);
        }
      }
      XLSX.writeFile(wb, `${safeTitle}.xlsx`);
      return;
    }
    if (format === 'csv') {
      // Combine sections or template into CSV
      const lines: string[] = [];
      const pmLabel = (v?: string) => {
        if (!v) return '';
        const f = paymentMethodOptions.find((p) => p.value === v);
        return f?.label || String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
      };
      if (layout === 'pivot') {
        for (const sec of sections) {
          lines.push(`# ${sec.title}`);
          const header = ['Item', ...columnOrder.map((k) => columnLabels[k] || k), 'Total'];
          lines.push(header.join(','));
          const colTotals = columnOrder.map(() => 0);
          for (const r of sec.rows) {
            const total = columnOrder.reduce((sum, k) => sum + (r.columns[k] || 0), 0);
            const values = columnOrder.map((k, idx) => {
              const v = r.columns[k] || 0;
              colTotals[idx] += v;
              return String(v);
            });
            const row = [r.rowLabel, ...values, String(total)].join(',');
            lines.push(row);
          }
          const grandTotal = colTotals.reduce((s, n) => s + n, 0);
          lines.push(['Total', ...colTotals.map((n) => String(n)), String(grandTotal)].join(','));
          lines.push('');
        }
      } else if (layout === 'list') {
        const pushIncome = (title: string, src: IncomeResponseRow[]) => {
          lines.push(`# ${title}`);
          lines.push('Date,Item/Occasion,Category,Amount,Method,Source,Receipt,Cheque Number,Notes');
          src.forEach((r) => {
            const row = [
              r.date || r.created_at || '',
              r.occasion_name || r.description || r.category || '',
              r.category || '',
              String(r.amount || 0),
              pmLabel(r.payment_method) || '',
              r.contributor_name || '',
              r.receipt_number || '',
              r.check_number || '',
              (r.notes || '').replace(/\n/g, ' '),
            ].join(',');
            lines.push(row);
          });
          lines.push('');
        };
        const pushExpenses = (src: ExpenseRecord[]) => {
          lines.push(`# ${pivotLabels['expenses']}`);
          if (expenseGrouping === 'category') {
            lines.push('Category,Amount');
            const { items } = expenseSections(src, 'category');
            items.forEach((item) => {
              lines.push(`${item.label},${item.amount}`);
            });
          } else {
            lines.push('Date,Item,Amount,Method,Vendor,Receipt,Cheque Number,Notes');
            src.forEach((r) => {
              const row = [
                r.date || r.created_at || '',
                r.description || r.purpose || '',
                String(r.amount || 0),
                pmLabel(r.payment_method) || '',
                r.vendor || '',
                r.receipt_number || '',
                r.check_number || '',
                (r.notes || '').replace(/\n/g, ' '),
              ].join(',');
              lines.push(row);
            });
          }
          lines.push('');
        };

        if (selectedItems.includes('all_income')) pushIncome(pivotLabels['all_income'], incomes);
        if (selectedItems.includes('general_income')) pushIncome(pivotLabels['general_income'], incomes.filter((r) => r.income_type === 'general_income'));
        if (selectedItems.includes('contributions')) pushIncome(pivotLabels['contributions'], incomes.filter((r) => r.income_type === 'contribution'));
        if (selectedItems.includes('donations')) pushIncome(pivotLabels['donations'], incomes.filter((r) => r.income_type === 'donation'));
        if (selectedItems.includes('pledge_payments')) pushIncome(pivotLabels['pledge_payments'], incomes.filter((r) => r.income_type === 'pledge_payment'));
        if (selectedItems.includes('expenses')) pushExpenses(expenses);
        if (selectedItems.includes('pledges')) {
          lines.push(`# ${pivotLabels['pledges']}`);
          lines.push('Type,Campaign,Source,Amount,Start Date,End Date,Amount Paid,Outstanding');
          pledges.forEach((p) => {
            const source = p.member_name || p.group_name || p.tag_item_name || p.source || (p.source_type === 'church' ? 'Church' : '') || '';
            const row = [
              p.pledge_type || 'Pledge',
              p.campaign_name || '',
              source,
              String(p.pledge_amount || 0),
              p.start_date || '',
              p.end_date || '',
              String(p.amount_paid || 0),
              String(p.amount_remaining ?? Math.max(0, (p.pledge_amount || 0) - (p.amount_paid || 0))),
            ].join(',');
            lines.push(row);
          });
          lines.push('');
        }
      } else if (layout === 'template') {
        if (templateStyle === 'income_statement') {
          lines.push('Section,Item,Amount');
          const gen = incomes.filter((r) => r.income_type === 'general_income');
          const other = incomes.filter((r) => r.income_type !== 'general_income');
          const sumBy = (arr: typeof incomes) => {
            const m = new Map<string, number>();
            arr.forEach((r) => m.set(r.category || 'Unknown', (m.get(r.category || 'Unknown') || 0) + (r.amount || 0)));
            return Array.from(m.entries());
          };
          sumBy(gen).forEach(([label, amt]) => lines.push(`${incomeLabels.revenue},${label},${amt}`));
          lines.push(`${incomeLabels.revenue},${incomeLabels.total_revenue},${gen.reduce((s, r) => s + (r.amount || 0), 0)}`);
          sumBy(other).forEach(([label, amt]) => lines.push(`${incomeLabels.other_income},${label},${amt}`));
          lines.push(`${incomeLabels.other_income},${incomeLabels.total_other_income},${other.reduce((s, r) => s + (r.amount || 0), 0)}`);
          const expMap = new Map<string, number>();
          expenses.forEach((r) => expMap.set(r.purpose || 'Unspecified', (expMap.get(r.purpose || 'Unspecified') || 0) + (r.amount || 0)));
          Array.from(expMap.entries()).forEach(([label, amt]) => lines.push(`${incomeLabels.expenditure},${label},${amt}`));
          lines.push(`${incomeLabels.expenditure},${incomeLabels.total_expenditure},${expenses.reduce((s, r) => s + (r.amount || 0), 0)}`);
          const totalIncome = incomes.reduce((s, r) => s + (r.amount || 0), 0);
          const totalExpense = expenses.reduce((s, r) => s + (r.amount || 0), 0);
          lines.push(`${incomeLabels.summary},${incomeLabels.total_income},${totalIncome}`);
          lines.push(`${incomeLabels.summary},${incomeLabels.profit},${totalIncome - totalExpense}`);
        } else if (templateStyle === 'pledges_summary') {
          lines.push('Metric,Amount');
          const totalPledged = pledges.reduce((s, r) => s + (r.pledge_amount || 0), 0);
          const totalPaid = pledges.reduce((s, r) => s + (r.amount_paid || 0), 0);
          const totalRemaining = pledges.reduce((s, r) => s + (r.amount_remaining ?? Math.max(0, (r.pledge_amount || 0) - (r.amount_paid || 0))), 0);
          lines.push(`${pledgesLabels.total_pledged},${totalPledged}`);
          lines.push(`${pledgesLabels.total_paid},${totalPaid}`);
          lines.push(`${pledgesLabels.outstanding},${totalRemaining}`);
          const m = new Map<string, number>();
          pledges.forEach((p) => m.set(p.pledge_type || 'Pledge', (m.get(p.pledge_type || 'Pledge') || 0) + (p.pledge_amount || 0)));
          lines.push('');
          lines.push(`${pledgesLabels.by_pledge_type},Amount`);
          Array.from(m.entries()).forEach(([label, amt]) => lines.push(`${label},${amt}`));
        } else if (templateStyle === 'donations_breakdown') {
          lines.push(`${donationsLabels.categories || 'Category'},Amount`);
          incomes
            .filter((r) => r.income_type === 'contribution' || r.income_type === 'donation')
            .reduce((m, r) => {
              const key = r.category || 'Unknown';
              m.set(key, (m.get(key) || 0) + (r.amount || 0));
              return m;
            }, new Map<string, number>())
            .forEach((amt, label) => lines.push(`${label},${amt}`));
        }
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${safeTitle}.csv`;
      a.click();
      return;
    }
    if (format === 'pdf') {
      // For templates, rely on print to preserve layout
      if (layout === 'template') {
        handlePrint();
        return;
      }
      (async () => {
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(safeTitle, 10, 12);
        let y = 20;
        const addLine = (txt: string) => {
          doc.text(txt, 10, y);
          y += 6;
          if (y > 280) { doc.addPage(); y = 20; }
        };
        sections.forEach((sec, idx) => {
          if (idx > 0) { addLine(''); }
          addLine(`${sec.title} (${rangeLabel})`);
          const LIMIT = 7;
          const chunks: string[][] = [];
          for (let i = 0; i < columnOrder.length; i += LIMIT) {
            chunks.push(columnOrder.slice(i, i + LIMIT));
          }
          (chunks.length <= 1 ? [columnOrder] : chunks).forEach((chunk, cidx) => {
            if (cidx > 0) addLine('');
            addLine(['Item', ...chunk.map((k) => columnLabels[k] || k), 'Total'].join(' | '));
            sec.rows.slice(0, 80).forEach((r) => {
              const total = columnOrder.reduce((sum, k) => sum + (r.columns[k] || 0), 0);
              const values = chunk.map((k) => String(r.columns[k] || 0));
              addLine([r.rowLabel, ...values, String(total)].join(' | '));
            });
          });
        });
        doc.save(`${safeTitle}.pdf`);
      })();
    }
  };

  const formatCurrency = (n: number) => `GHS${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Print layout tuning: switch to landscape when pivot has many columns
  // Also force landscape for Income Statement template when By Period columns > 5
  const isLandscapePivot =
    (layout === 'pivot' && columnOrder.length > 5) ||
    (layout === 'template' && templateStyle === 'income_statement' && spec.buckets.length > 5);
  // Compute column width percentages and expose to CSS via variables
  const itemWidthPct = 18; // give item column room for labels
  const totalWidthPct = 10; // compact total column
  const remainingPct = Math.max(100 - itemWidthPct - totalWidthPct, 50);
  const dateColWidthPct = Math.max(6, remainingPct / Math.max(columnOrder.length, 1));

  const printStyle = `
    @page { size: ${isLandscapePivot ? 'A4 landscape' : 'A4 portrait'}; margin: 0.5in; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
      /* Ensure pivot tables fit the page and avoid horizontal scrollbars */
      .pivot-table { font-size: ${isLandscapePivot ? '11px' : '12px'}; line-height: 1.25; }
      .pivot-table table { table-layout: fixed; width: 100%; }
      .pivot-table thead th { white-space: nowrap; overflow: hidden; text-overflow: clip; }
      .pivot-table tbody td, .pivot-table tfoot td { white-space: nowrap; }
      .pivot-table thead th, .pivot-table tbody td, .pivot-table tfoot td { padding: ${isLandscapePivot ? '6px 6px' : '8px 8px'}; }
      .pivot-table .overflow-x-auto { overflow: visible !important; }
      /* Widths controlled by CSS variables set on the component root */
      .pivot-table th[data-col="item"], .pivot-table td[data-col="item"] { width: var(--pivot-item-width, ${itemWidthPct}%); }
      .pivot-table th[data-col="total"], .pivot-table td[data-col="total"] { width: var(--pivot-total-width, ${totalWidthPct}%); }
      .pivot-table th[data-col="date"], .pivot-table td[data-col="date"] { width: var(--pivot-col-width, ${dateColWidthPct}%); }
    }
  `;

  // Compact labels for dense day-columns when printing landscape
  const compactColumnLabels = React.useMemo(() => {
    if (!isLandscapePivot) return columnLabels;
    if (groupUnit !== 'day') return columnLabels;
    const next: Record<string, string> = { ...columnLabels };
    spec.buckets.forEach((b) => {
      // bucket keys for day are yyyy-MM-dd
      try {
        next[b.key] = formatDate(parseISO(b.key), 'MMM dd');
      } catch {
        next[b.key] = b.label.replace(/,?\s*\d{4}$/,''); // fallback remove year
      }
    });
    return next;
  }, [isLandscapePivot, groupUnit, columnLabels, spec.buckets]);

  const handlePrint = useReactToPrint({ contentRef: printRef as any, pageStyle: printStyle });

  return (
    <Card className="w-full bg-card/45">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Report Generator
          <span className="text-sm font-normal text-muted-foreground">{rangeLabel}</span>
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportWorkbook('excel')} disabled={loading}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportWorkbook('csv')} disabled={loading}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className='hidden' onClick={() => exportWorkbook('pdf')} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportWorkbook('print')} disabled={loading}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <DatePresetPicker value={datePresetValue} onChange={handleDatePresetChange} />
            </div>
            <div>
              <Label className="mb-1 block">Branch</Label>
              <BranchSelector
                variant="single"
                value={filters.branch_id_filter?.[0]}
                onValueChange={(v) => onFiltersChange?.({
                  ...filters,
                  branch_id_filter: v ? [v as string] : undefined,
                })}
                allowClear
                placeholder="All branches"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Group by</Label>
                <Select value={groupUnit} onValueChange={(v) => setGroupUnit(v as GroupUnit)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Layout</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as 'pivot' | 'list' | 'template')}>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pivot">Pivot Table</SelectItem>
                    <SelectItem value="list">Detail List</SelectItem>
                    <SelectItem value="template">Report Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(((layout === 'pivot' || layout === 'list') && selectedItems.includes('expenses')) || (layout === 'template' && templateStyle === 'income_statement')) && (
              <div className="mt-3">
                <Label className="mb-1 block">Expense Grouping</Label>
                <Select value={expenseGrouping} onValueChange={(v) => setExpenseGrouping(v as any)}>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purpose">By Purpose</SelectItem>
                    <SelectItem value="category">By Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {layout === 'template' ? (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="mb-1 block">Report Style</Label>
                  <Select value={templateStyle} onValueChange={(v) => setTemplateStyle(v as any)}>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income_statement">Income & Expenditure Statement</SelectItem>
                      <SelectItem value="pledges_summary">Pledges Summary</SelectItem>
                      <SelectItem value="donations_breakdown">Contributions & Donations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div>
                <Label className="mb-2 block">Items</Label>
                <div className="space-y-2">
                  {[
                    { value: 'all_income', label: 'All Income' },
                    { value: 'general_income', label: 'General Income' },
                    { value: 'contributions', label: 'Contributions' },
                    { value: 'donations', label: 'Donations' },
                    { value: 'pledge_payments', label: 'Pledge payments' },
                    { value: 'expenses', label: 'Expenses' },
                    { value: 'pledges', label: 'Pledges' },
                  ].map((opt) => (
                    <div className="flex items-center gap-2" key={opt.value}>
                      <Checkbox id={`item-${opt.value}`} checked={selectedItems.includes(opt.value as FinanceItemType)} onCheckedChange={(c) => toggleItem(opt.value as FinanceItemType, c)} />
                      <Label htmlFor={`item-${opt.value}`} className="text-sm">{opt.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="lg:col-span-3" ref={printRef}>
            {/* Inject print styles to control orientation and layout */}
            <style>{printStyle}</style>
            {/* Global print-only header to unify report title */}
            <div className="hidden print:block mb-4">
              {currentOrganization?.name && (
              <h2 className="text-gray-700 dark:text-gray-300 text-base">
                {currentOrganization.name}
              </h2>
            )}
            <h1 className="text-lg font-bold">{reportTitle}</h1>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
            <p className="text-sm text-muted-foreground">{branchName ? `Branch: ${branchName}` : 'Branch: All branches'}</p>
          </div>
            {layout === 'pivot' ? (
              <div className="space-y-6">
                {sections.map((sec) => (
                  <PivotTable
                    key={sec.key}
                    title={sec.title}
                    titleKey={sec.key}
                    onTitleSave={handlePivotTitleSave}
                    rows={sec.rows}
                    columnOrder={columnOrder}
                    columnLabels={compactColumnLabels}
                    valueFormatter={formatCurrency}
                    rowHeaderLabel={sec.rowHeaderLabel}
                    className="pivot-table"
                    style={{
                      // inject CSS variables to control print widths
                      ['--pivot-col-width' as any]: `${dateColWidthPct}%`,
                      ['--pivot-item-width' as any]: `${itemWidthPct}%`,
                      ['--pivot-total-width' as any]: `${totalWidthPct}%`,
                    }}
                  />
                ))}
              </div>
            ) : layout === 'list' ? (
              <div className="space-y-6">
                {selectedItems.includes('all_income') && (
                  <IncomeDetailListSection title={`All Income (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} data={incomes}/>
                )}

                {selectedItems.includes('general_income') && (
                  <IncomeDetailListSection title={`General Income (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} data={incomes.filter((r) => r.income_type === 'general_income')} />
                )}
                {selectedItems.includes('contributions') && (
                  <IncomeDetailListSection title={`Contributions (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} data={incomes.filter((r) => r.income_type === 'contribution')} />
                )}
                {selectedItems.includes('donations') && (
                  <IncomeDetailListSection title={`Donations (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} data={incomes.filter((r) => r.income_type === 'donation')} />
                )}
                {selectedItems.includes('pledge_payments') && (
                  <PledgePaymentsDetailListSection title={`Pledge Payments (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} data={payments as any} />
                )}
                
                {selectedItems.includes('expenses') && (
                  <ExpensesDetailListSection 
                    title={`Expenses (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`} 
                    data={expenses} 
                    grouping={expenseGrouping} 
                    categoryLabelMap={categoryLabelMap}
                  />
                )}
                {selectedItems.includes('pledges') && (
                  <section className="space-y-2">
                    <h3 className="text-base font-semibold tracking-tight">{`Pledges (${rangeLabel})${branchName ? ` • Branch: ${branchName}` : ''}`}</h3>
                    <PledgesTable data={pledges} exportable={false} showPrintHeader={false} />
                  </section>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {templateStyle === 'income_statement' && (
                  <IncomeStatement
                    incomes={incomes}
                    expenses={expenses}
                    periodLabel={rangeLabel}
                    groupUnit={groupUnit}
                    dateFilter={filters.date_filter}
                    branchLabel={branchName}
                    expenseGrouping={expenseGrouping}
                  />
                )}
                {templateStyle === 'pledges_summary' && (
                  <PledgesSummary pledges={pledges} periodLabel={rangeLabel} branchLabel={branchName} />
                )}
                {templateStyle === 'donations_breakdown' && (
                  <DonationsBreakdown contributionsAndDonations={incomes.filter((r) => r.income_type === 'contribution' || r.income_type === 'donation')} periodLabel={rangeLabel} branchLabel={branchName} />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick export buttons retained for potential reuse elsewhere
export const QuickExportButtons: React.FC<{ onExport: (format: string) => void; loading?: boolean; }> = ({ onExport, loading = false }) => {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => onExport('pdf')} disabled={loading}>
        <FileText className="h-4 w-4 mr-1" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => onExport('excel')} disabled={loading}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => onExport('print')} disabled={loading}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>
    </div>
  );
};

// Email report dialog (shared by attendance ReportExportMenu and others)
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail } from 'lucide-react';

export const EmailReportDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendEmail: (config: {
    recipients: string[];
    subject: string;
    message: string;
  }) => void;
  loading?: boolean;
}> = ({ open, onOpenChange, onSendEmail, loading = false }) => {
  const [recipients, setRecipients] = React.useState('');
  const [subject, setSubject] = React.useState('Finance Report');
  const [message, setMessage] = React.useState('Please find the attached finance report.');

  const handleSend = () => {
    const recipientList = recipients
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    onSendEmail({ recipients: recipientList, subject, message });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email Report</DialogTitle>
          <DialogDescription>Send the generated report via email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipients">Recipients</Label>
            <Input
              id="recipients"
              placeholder="email1@example.com, email2@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Separate multiple email addresses with commas</p>
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading || !recipients.trim()}>
            <Mail className="h-4 w-4 mr-2" />
            Send Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
