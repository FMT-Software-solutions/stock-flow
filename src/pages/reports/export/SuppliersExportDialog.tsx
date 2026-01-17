import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  buildSuppliersPdfDoc,
  buildSuppliersWorkbook,
} from './utils/suppliersExport';
import { XLSX } from './utils/styles';

type SuppliersReport = {
  total_suppliers: number;
  new_this_month: number;
  new_suppliers: { id: string; name: string; created_at: string }[];
  top_suppliers: { supplier_id: string; name: string; product_count: number }[];
};

type SectionKey = 'stats' | 'new' | 'top';

interface SuppliersExportDialogProps {
  data: SuppliersReport;
  organizationName?: string;
  open: boolean;
  onClose: () => void;
  defaultSections?: SectionKey[];
}

export function SuppliersExportDialog({
  data,
  organizationName,
  open,
  onClose,
  defaultSections = ['stats', 'new', 'top'],
}: SuppliersExportDialogProps) {
  const [selected, setSelected] = useState<SectionKey[]>(defaultSections);

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
    const wb = buildSuppliersWorkbook({
      data,
      sections: selected,
      organizationName,
    });
    if (wb) XLSX.writeFile(wb, `suppliers-report.xlsx`);
    onClose();
  };

  const exportPdf = () => {
    const doc = buildSuppliersPdfDoc({
      data,
      sections: selected,
      organizationName,
      title: 'Suppliers Report',
    });
    doc.save('suppliers-report.pdf');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Suppliers Report</DialogTitle>
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
                checked={selected.includes('new')}
                onCheckedChange={(c) => toggle('new', c)}
                id="sec-new"
              />
              <label htmlFor="sec-new" className="text-sm">
                New Suppliers This Month
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes('top')}
                onCheckedChange={(c) => toggle('top', c)}
                id="sec-top"
              />
              <label htmlFor="sec-top" className="text-sm">
                Top Suppliers by Products
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

