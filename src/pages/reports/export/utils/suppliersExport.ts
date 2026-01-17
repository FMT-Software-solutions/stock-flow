import { XLSX, setColumnWidths, styleHeaderRowAt, rightAlignNumbers } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type SectionKey = 'stats' | 'new' | 'top';

type SuppliersReport = {
  total_suppliers: number;
  new_this_month: number;
  new_suppliers: { id: string; name: string; created_at: string }[];
  top_suppliers: { supplier_id: string; name: string; product_count: number }[];
};

export function buildSuppliersWorkbook(args: {
  data: SuppliersReport;
  sections: SectionKey[];
  organizationName?: string;
}) {
  const { data, sections, organizationName } = args;
  const wb = XLSX.utils.book_new();

  if (sections.includes('stats')) {
    const header = ['Metric', 'Value'];
    const bodyRows: (string | number)[][] = [
      ['Total Suppliers', data.total_suppliers || 0],
      ['New This Month', data.new_this_month || 0],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Suppliers Report']);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [24, 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 1, 1, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Stats');
  }

  if (sections.includes('new')) {
    const header = ['Supplier', 'Created At'];
    const bodyRows: (string | number)[][] = (data.new_suppliers || []).map(
      (s) => [s.name || 'Unknown', format(new Date(s.created_at), 'MMMM dd, yyyy')]
    );
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Suppliers Report']);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [32, 22]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, 'New Suppliers');
  }

  if (sections.includes('top')) {
    const header = ['Rank', 'Supplier', 'Products'];
    const bodyRows: (string | number)[][] = (data.top_suppliers || []).map(
      (s, i) => [i + 1, s.name || 'Unknown', Number(s.product_count ?? 0)]
    );
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Suppliers Report']);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [8, 32, 14]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 0, 0, false);
    rightAlignNumbers(ws, headerRowIndex + 1, 2, 2, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Top Suppliers');
  }

  return wb;
}

export function buildSuppliersPdfDoc(args: {
  data: SuppliersReport;
  sections: SectionKey[];
  organizationName?: string;
  title?: string;
}) {
  const { data, sections, organizationName, title = 'Suppliers Report' } = args;
  const doc = new jsPDF({ orientation: 'landscape' });

  let currentY = 15;
  if (organizationName) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(organizationName, 14, currentY);
    currentY += 10;
  }

  if (title) {
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text(title, 14, currentY);
    currentY += 10;
  }

  const startY = currentY + 5;

  const drawTable = (head: string[], body: (string | number)[][], y: number) => {
    autoTable(doc, {
      head: [head],
      body,
      theme: 'grid',
      startY: y,
      styles: { fontSize: 8, minCellHeight: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
    });
    return (doc as any).lastAutoTable.finalY as number;
  };

  let y = startY;

  if (sections.includes('stats')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Supplier Stats', 14, y);
    y += 6;
    y = drawTable(
      ['Metric', 'Value'],
      [
        ['Total Suppliers', data.total_suppliers || 0],
        ['New This Month', data.new_this_month || 0],
      ],
      y
    );
    y += 8;
  }

  if (sections.includes('new')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('New Suppliers This Month', 14, y);
    y += 6;
    y = drawTable(
      ['Supplier', 'Created At'],
      (data.new_suppliers || []).map((s) => [
        s.name || 'Unknown',
        format(new Date(s.created_at), 'MMMM dd, yyyy'),
      ]),
      y
    );
    y += 8;
  }

  if (sections.includes('top')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Top Suppliers by Products', 14, y);
    y += 6;
    y = drawTable(
      ['Rank', 'Supplier', 'Products'],
      (data.top_suppliers || []).map((s, i) => [
        i + 1,
        s.name || 'Unknown',
        s.product_count || 0,
      ]),
      y
    );
    y += 8;
  }

  return doc;
}

