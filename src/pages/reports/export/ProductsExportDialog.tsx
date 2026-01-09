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
  buildProductsWorkbook,
  buildProductsPdfDoc,
} from './utils/productsExport';
import { XLSX } from './utils/styles';

type ProductsReport = {
  total_products: number;
  active_products: number;
  inactive_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  category_distribution: { category: string; count: number }[];
  low_stock_list: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
  out_of_stock_list: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
};

type SectionKey = 'stats' | 'category' | 'low' | 'out';

interface ProductsExportDialogProps {
  data: ProductsReport;
  organizationName?: string;
  dateRange?: DateRange;
  open: boolean;
  onClose: () => void;
  defaultSections?: SectionKey[];
}

export function ProductsExportDialog({
  data,
  organizationName,
  dateRange,
  open,
  onClose,
  defaultSections = ['stats', 'category', 'low', 'out'],
}: ProductsExportDialogProps) {
  const [selected, setSelected] = useState<SectionKey[]>(defaultSections);

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
    const wb = buildProductsWorkbook({
      data,
      sections: selected,
      organizationName,
      description,
    });
    if (wb) XLSX.writeFile(wb, `products-report.xlsx`);
    onClose();
  };

  const exportPdf = () => {
    const doc = buildProductsPdfDoc({
      data,
      sections: selected,
      organizationName,
      title: 'Products Report',
      description,
    });
    doc.save('products-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Products Report</DialogTitle>
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
                checked={selected.includes('category')}
                onCheckedChange={(c) => toggle('category', c)}
                id="sec-category"
              />
              <label htmlFor="sec-category" className="text-sm">
                Category Distribution
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('low')}
                onCheckedChange={(c) => toggle('low', c)}
                id="sec-low"
              />
              <label htmlFor="sec-low" className="text-sm">
                Low Stock Products
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('out')}
                onCheckedChange={(c) => toggle('out', c)}
                id="sec-out"
              />
              <label htmlFor="sec-out" className="text-sm">
                Out of Stock Products
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
