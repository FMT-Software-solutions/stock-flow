import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  buildCustomersPdfDoc,
  buildCustomersWorkbook,
} from './utils/customersExport';
import { XLSX } from './utils/styles';

type CustomersReport = {
  total_customers: number;
  new_this_month: number;
  top_customers: {
    customer_id: string;
    name: string;
    total_spent: number;
    orders_count: number;
  }[];
  customers_owing: {
    customer_id: string;
    name: string;
    total_owing: number;
    open_orders: number;
    last_owing_date: string | null;
  }[];
};

type SectionKey = 'stats' | 'top' | 'owing';

interface CustomersExportDialogProps {
  data: CustomersReport;
  organizationName?: string;
  dateRange?: DateRange;
  open: boolean;
  onClose: () => void;
  defaultSections?: SectionKey[];
}

export function CustomersExportDialog({
  data,
  organizationName,
  dateRange,
  open,
  onClose,
  defaultSections = ['stats', 'top', 'owing'],
}: CustomersExportDialogProps) {
  const [selected, setSelected] = useState<SectionKey[]>(defaultSections);

  const description = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return undefined;
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMMM dd, yyyy')} — ${format(
        dateRange.to,
        'MMMM dd, yyyy'
      )}`;
    }
    const d = dateRange?.from || dateRange?.to;
    return d ? format(d, 'MMMM dd, yyyy') : undefined;
  }, [dateRange]);

  const toggle = (key: SectionKey, checked: boolean | string) => {
    const isChecked = checked === true || checked === 'indeterminate';
    setSelected((prev) => {
      if (isChecked && !prev.includes(key)) return [...prev, key];
      if (!isChecked && prev.includes(key))
        return prev.filter((k) => k !== key);
      return prev;
    });
  };

  const exportExcel = () => {
    const wb = buildCustomersWorkbook({
      data,
      sections: selected,
      organizationName,
      description,
    });
    if (wb) XLSX.writeFile(wb, `customers-report.xlsx`);
    onClose();
  };

  const exportPdf = () => {
    const doc = buildCustomersPdfDoc({
      data,
      sections: selected,
      organizationName,
      title: 'Customers Report',
      description,
    });
    doc.save('customers-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Customers Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('stats')}
                onCheckedChange={(c) => toggle('stats', c)}
                id="sec-stats"
              />
              <label htmlFor="sec-stats" className="text-sm">
                Stats
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('top')}
                onCheckedChange={(c) => toggle('top', c)}
                id="sec-top"
              />
              <label htmlFor="sec-top" className="text-sm">
                Top Customers by Spend
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('owing')}
                onCheckedChange={(c) => toggle('owing', c)}
                id="sec-owing"
              />
              <label htmlFor="sec-owing" className="text-sm">
                Customers Owing Us
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportExcel}>Export Excel</Button>
            <Button onClick={exportPdf} variant="outline">
              Export PDF
            </Button>
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

