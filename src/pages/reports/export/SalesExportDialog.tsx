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
import { buildSalesWorkbook, buildSalesPdfDoc } from './utils/salesExport';
import { useCurrency } from '@/hooks/useCurrency';
import type { Order } from '@/types/orders';
import type { GroupUnit, RowGroup } from '../sales/utils';

interface SalesExportDialogProps {
  template: 'detailed' | 'pivot' | 'summary';
  orders: Order[];
  groupUnit: GroupUnit;
  rowGroup: RowGroup;
  organizationName?: string;
  dateRange?: DateRange;
  open: boolean;
  onClose: () => void;
  branchNames?: string[];
}

export function SalesExportDialog({
  template,
  orders,
  groupUnit,
  rowGroup,
  organizationName,
  dateRange,
  open,
  onClose,
  branchNames,
}: SalesExportDialogProps) {
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
    const wb = buildSalesWorkbook({
      template,
      orders,
      groupUnit,
      rowGroup,
      organizationName,
      description,
      formatCurrency,
      branches: branchNames,
      dateRange,
      includeStats,
      includeData,
    });
    XLSX.writeFile(wb, 'sales-report.xlsx');
    onClose();
  };

  const exportPdf = () => {
    const doc = buildSalesPdfDoc({
      template,
      orders,
      groupUnit,
      rowGroup,
      organizationName,
      title: 'Sales & Orders Report',
      description,
      formatCurrency,
      branches: branchNames,
      dateRange,
      includeStats,
      includeData,
    });
    doc.save('sales-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Sales Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeStats}
                onCheckedChange={(c) => setIncludeStats(!!c)}
                id="sales-inc-stats"
              />
              <label htmlFor="sales-inc-stats" className="text-sm">
                Include Stats
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeData}
                onCheckedChange={(c) => setIncludeData(!!c)}
                id="sales-inc-data"
              />
              <label htmlFor="sales-inc-data" className="text-sm">
                Include{' '}
                {template === 'detailed'
                  ? 'Detailed Table'
                  : template === 'pivot'
                  ? 'Pivot Tables'
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
