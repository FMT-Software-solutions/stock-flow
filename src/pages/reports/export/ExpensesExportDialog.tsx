import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { XLSX } from './utils/styles';
import {
  buildExpensesWorkbook,
  buildExpensesPdfDoc,
} from './utils/expensesExport';
import { useCurrency } from '@/hooks/useCurrency';
import type { Expense } from '@/types/expenses';

interface ExpensesExportDialogProps {
  template: 'detailed' | 'pivot' | 'summary';
  expenses: Expense[];
  groupUnit: 'day' | 'week' | 'month' | 'quarter' | 'year';
  groupBy: 'category' | 'type';
  organizationName?: string;
  dateRange?: DateRange;
  open: boolean;
  onClose: () => void;
  branchNames?: string[];
}

export function ExpensesExportDialog({
  template,
  expenses,
  groupUnit,
  groupBy,
  organizationName,
  dateRange,
  open,
  onClose,
  branchNames,
}: ExpensesExportDialogProps) {
  const { formatCurrency } = useCurrency();
  const [includeStats, setIncludeStats] = useState(true);
  const [includeData, setIncludeData] = useState(true);

  const description = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return undefined;
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMMM d, yyyy')} — ${format(
        dateRange.to,
        'MMMM d, yyyy'
      )}`;
    }
    const d = dateRange?.from || dateRange?.to;
    return d ? format(d, 'MMMM d, yyyy') : undefined;
  }, [dateRange]);

  const exportExcel = () => {
    const wb = buildExpensesWorkbook({
      template,
      expenses,
      groupUnit,
      groupBy,
      organizationName,
      description,
      formatCurrency,
      branches: branchNames,
      dateRange,
      includeStats,
      includeData,
    });
    XLSX.writeFile(wb, 'expenses-report.xlsx');
    onClose();
  };

  const exportPdf = () => {
    const doc = buildExpensesPdfDoc({
      template,
      expenses,
      groupUnit,
      groupBy,
      organizationName,
      title: 'Expenses Report',
      description,
      formatCurrency,
      branches: branchNames,
      dateRange,
      includeStats,
      includeData,
    });
    doc.save('expenses-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Expenses Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeStats}
                onCheckedChange={(c) => setIncludeStats(!!c)}
                id="exp-inc-stats"
              />
              <label htmlFor="exp-inc-stats" className="text-sm">
                Include Stats
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeData}
                onCheckedChange={(c) => setIncludeData(!!c)}
                id="exp-inc-data"
              />
              <label htmlFor="exp-inc-data" className="text-sm">
                Include{' '}
                {template === 'detailed'
                  ? 'Detailed Table'
                  : template === 'pivot'
                  ? `Pivot (${groupBy === 'category' ? 'Category' : 'Type'})`
                  : 'Summary Table'}
              </label>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {description || 'No date range applied'}
          </div>
          <div className="flex gap-2">
            <Button onClick={exportExcel} className="flex-1">
              Export Excel
            </Button>
            <Button onClick={exportPdf} className="flex-1" variant="outline">
              Export PDF
            </Button>
            <Button onClick={onClose} className="flex-1" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
