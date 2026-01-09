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
import {
  buildInventoryWorkbook,
  buildInventoryPdfDoc,
} from './utils/inventoryExport';
import { XLSX } from './utils/styles';
import { useCurrency } from '@/hooks/useCurrency';

type SectionKey = 'stats' | 'category' | 'value' | 'low' | 'out';

type InventoryReport = {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  stock_by_category: { category: string; quantity: number }[];
  total_revenue?: number;
  inventory_value_by_category?: { category: string; value: number }[];
  low_stock_list?: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
  out_of_stock_list?: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
};

interface InventoryExportDialogProps {
  data: InventoryReport;
  organizationName?: string;
  dateRange?: DateRange;
  open: boolean;
  onClose: () => void;
  defaultSections?: SectionKey[];
  branchNames?: string[];
}

export function InventoryExportDialog({
  data,
  organizationName,
  dateRange,
  open,
  onClose,
  defaultSections = ['stats', 'category', 'value', 'low', 'out'],
  branchNames,
}: InventoryExportDialogProps) {
  const [selected, setSelected] = useState<SectionKey[]>(defaultSections);
  const { formatCurrency } = useCurrency();

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
    const wb = buildInventoryWorkbook({
      data,
      sections: selected,
      organizationName,
      description,
      formatCurrency,
      branches: branchNames,
    });
    if (wb) XLSX.writeFile(wb, `inventory-report.xlsx`);
    onClose();
  };

  const exportPdf = () => {
    const doc = buildInventoryPdfDoc({
      data,
      sections: selected,
      organizationName,
      title: 'Inventory Report',
      description,
      formatCurrency,
      branches: branchNames,
    });
    doc.save('inventory-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Inventory Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('stats')}
                onCheckedChange={(c) => toggle('stats', c)}
                id="i-sec-stats"
              />
              <label htmlFor="i-sec-stats" className="text-sm">
                Stats
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('category')}
                onCheckedChange={(c) => toggle('category', c)}
                id="i-sec-category"
              />
              <label htmlFor="i-sec-category" className="text-sm">
                Stock by Category
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('value')}
                onCheckedChange={(c) => toggle('value', c)}
                id="i-sec-value"
              />
              <label htmlFor="i-sec-value" className="text-sm">
                Inventory Value by Category
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('low')}
                onCheckedChange={(c) => toggle('low', c)}
                id="i-sec-low"
              />
              <label htmlFor="i-sec-low" className="text-sm">
                Low Stock Items
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('out')}
                onCheckedChange={(c) => toggle('out', c)}
                id="i-sec-out"
              />
              <label htmlFor="i-sec-out" className="text-sm">
                Out of Stock Items
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
