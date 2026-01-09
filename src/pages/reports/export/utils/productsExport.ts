import { XLSX, setColumnWidths, styleHeaderRowAt, rightAlignNumbers } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SectionKey = 'stats' | 'category' | 'low' | 'out';

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

export function buildProductsWorkbook(args: {
  data: ProductsReport;
  sections: SectionKey[];
  organizationName?: string;
  description?: string;
}) {
  const { data, sections, organizationName, description } = args;
  const wb = XLSX.utils.book_new();

  if (sections.includes('stats')) {
    const header = ['Metric', 'Value'];
    const bodyRows: (string | number)[][] = [
      ['Total Products', data.total_products || 0],
      ['Active', data.active_products || 0],
      ['Inactive', data.inactive_products || 0],
      ['Low Stock', data.low_stock_products || 0],
      ['Out of Stock', data.out_of_stock_products || 0],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Products Report']);
    if (description) meta.push([description]);
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

  if (sections.includes('category')) {
    const header = ['Category', 'Count'];
    const bodyRows: (string | number)[][] =
      (data.category_distribution || []).map((r) => [
        r.category || 'Uncategorized',
        r.count || 0,
      ]);
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Products Report']);
    if (description) meta.push([description]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 12]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 1, 1, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Category');
  }

  if (sections.includes('low')) {
    const header = ['Product', 'SKU', 'Category', 'Qty', 'Min'];
    const bodyRows: (string | number)[][] =
      (data.low_stock_list || []).map((p) => [
        p.name,
        p.sku || '',
        p.category_name || 'Uncategorized',
        Number(p.quantity ?? 0),
        Number(p.min_stock_level ?? 0),
      ]);
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Products Report']);
    if (description) meta.push([description]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 16, 22, 10, 10]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 3, 4, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Low Stock');
  }

  if (sections.includes('out')) {
    const header = ['Product', 'SKU', 'Category', 'Qty', 'Min'];
    const bodyRows: (string | number)[][] =
      (data.out_of_stock_list || []).map((p) => [
        p.name,
        p.sku || '',
        p.category_name || 'Uncategorized',
        Number(p.quantity ?? 0),
        Number(p.min_stock_level ?? 0),
      ]);
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Products Report']);
    if (description) meta.push([description]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 16, 22, 10, 10]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 3, 4, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Out of Stock');
  }

  return wb;
}

export function buildProductsPdfDoc(args: {
  data: ProductsReport;
  sections: SectionKey[];
  organizationName?: string;
  title?: string;
  description?: string;
}) {
  const { data, sections, organizationName, title = 'Products Report', description } = args;
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

  if (description) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(description, 14, currentY);
    currentY += 10;
  }

  const startY = currentY + 5;

  const drawTable = (head: string[], body: any[][], y: number) => {
    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      theme: 'grid',
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
    doc.text('Product Stats', 14, y);
    y += 6;
    const head = ['Metric', 'Value'];
    const body = [
      ['Total Products', data.total_products || 0],
      ['Active', data.active_products || 0],
      ['Inactive', data.inactive_products || 0],
      ['Low Stock', data.low_stock_products || 0],
      ['Out of Stock', data.out_of_stock_products || 0],
    ];
    y = drawTable(head, body, y);
    y += 8;
  }

  if (sections.includes('category')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Category Distribution', 14, y);
    y += 6;
    const head = ['Category', 'Count'];
    const body = (data.category_distribution || []).map((r) => [
      r.category || 'Uncategorized',
      r.count || 0,
    ]);
    y = drawTable(head, body, y);
    y += 8;
  }

  const splitIfWide = (head: string[], rows: any[][], maxCols: number) => {
    if (head.length <= maxCols) return [{ head, rows }];
    const topHead = head.slice(0, maxCols);
    const bottomHead = head.slice(maxCols);
    const topRows = rows.map((r) => r.slice(0, maxCols));
    const bottomRows = rows.map((r) => r.slice(maxCols));
    return [
      { head: topHead, rows: topRows },
      { head: bottomHead, rows: bottomRows },
    ];
  };

  if (sections.includes('low')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Low Stock Products', 14, y);
    y += 6;
    const head = ['Product', 'SKU', 'Category', 'Qty', 'Min'];
    const rows = (data.low_stock_list || []).map((p) => [
      p.name,
      p.sku || '',
      p.category_name || 'Uncategorized',
      Number(p.quantity ?? 0),
      Number(p.min_stock_level ?? 0),
    ]);
    const tables = splitIfWide(head, rows, 6);
    for (const t of tables) {
      y = drawTable(t.head, t.rows, y);
      y += 6;
    }
    y += 4;
  }

  if (sections.includes('out')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Out of Stock Products', 14, y);
    y += 6;
    const head = ['Product', 'SKU', 'Category', 'Qty', 'Min'];
    const rows = (data.out_of_stock_list || []).map((p) => [
      p.name,
      p.sku || '',
      p.category_name || 'Uncategorized',
      Number(p.quantity ?? 0),
      Number(p.min_stock_level ?? 0),
    ]);
    const tables = splitIfWide(head, rows, 6);
    for (const t of tables) {
      y = drawTable(t.head, t.rows, y);
      y += 6;
    }
  }

  return doc;
}
