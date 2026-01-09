import { XLSX, setColumnWidths, styleHeaderRowAt, rightAlignNumbers } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface WorkbookParams {
  data: InventoryReport;
  sections: SectionKey[];
  organizationName?: string;
  description?: string;
  formatCurrency?: (amount: number) => string;
  branches?: string[];
}

export function buildInventoryWorkbook({
  data,
  sections,
  organizationName,
  description,
  formatCurrency,
  branches,
}: WorkbookParams) {
  const wb = XLSX.utils.book_new();

  if (sections.includes('stats')) {
    const header = ['Metric', 'Value'];
    const body = [
      ['Total Items', data.total_items || 0],
      ['Low Stock', data.low_stock_items || 0],
      ['Out of Stock', data.out_of_stock_items || 0],
      ['Revenue', formatCurrency ? formatCurrency(Number(data.total_revenue || 0)) : Number(data.total_revenue || 0)],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Inventory Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 1, 1, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Stats');
  }

  if (sections.includes('category')) {
    const header = ['Category', 'Quantity'];
    const bodyRows: (string | number)[][] =
      (data.stock_by_category || []).map((r) => [
        r.category || 'Uncategorized',
        r.quantity || 0,
      ]);
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Inventory Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
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

  if (sections.includes('value')) {
    const header = ['Category', 'Value'];
    const bodyRows: (string | number)[][] =
      (data.inventory_value_by_category || []).map((r) => [
        r.category || 'Uncategorized',
        formatCurrency ? formatCurrency(Number(r.value || 0)) : Number(r.value || 0),
      ]);
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Inventory Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 1, 1, true);
    XLSX.utils.book_append_sheet(wb, ws, 'Value');
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
    meta.push(['Inventory Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
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
    meta.push(['Inventory Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
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

interface PdfParams {
  data: InventoryReport;
  sections: SectionKey[];
  organizationName?: string;
  title?: string;
  description?: string;
  formatCurrency?: (amount: number) => string;
  branches?: string[];
}

export function buildInventoryPdfDoc({
  data,
  sections,
  organizationName,
  title = 'Inventory Report',
  description,
  formatCurrency,
  branches,
}: PdfParams) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(organizationName || '', 14, 16);
  doc.setFontSize(16);
  doc.text(title, 14, 24);
  doc.setFontSize(10);
  if (description) doc.text(description, 14, 30);
  const branchesText =
    branches && branches.length
      ? `Branches: ${branches.join(', ')}`
      : 'Branches: All Branches';
  if (description) {
    doc.text(branchesText, 14, 36);
  } else {
    doc.text(branchesText, 14, 30);
  }

  let startY = description ? 42 : 36;

  const drawTable = (head: string[], rows: (string | number)[][], startYLocal: number) => {
    autoTable(doc, {
      head: [head],
      body: rows,
      startY: startYLocal,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
    });
    return (doc as any).lastAutoTable.finalY + 6;
  };

  const splitIfWide = (head: string[], rows: (string | number)[][], maxCols: number) => {
    const chunks: { head: string[]; rows: (string | number)[][] }[] = [];
    if (head.length <= maxCols) return [{ head, rows }];
    for (let i = 0; i < head.length; i += maxCols) {
      chunks.push({
        head: head.slice(i, i + maxCols),
        rows: rows.map((r) => r.slice(i, i + maxCols)),
      });
    }
    return chunks;
  };

  let y = startY;

  if (sections.includes('stats')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Inventory Stats', 14, y);
    y += 6;
    const head = ['Metric', 'Value'];
    const body = [
      ['Total Items', data.total_items || 0],
      ['Low Stock', data.low_stock_items || 0],
      ['Out of Stock', data.out_of_stock_items || 0],
      ['Revenue', formatCurrency ? formatCurrency(Number(data.total_revenue || 0)) : Number(data.total_revenue || 0)],
    ];
    y = drawTable(head, body, y);
    y += 8;
  }

  if (sections.includes('category')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Stock by Category', 14, y);
    y += 6;
    const head = ['Category', 'Quantity'];
    const body = (data.stock_by_category || []).map((r) => [
      r.category || 'Uncategorized',
      r.quantity || 0,
    ]);
    y = drawTable(head, body, y);
    y += 8;
  }

  if (sections.includes('value')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Inventory Value by Category', 14, y);
    y += 6;
    const head = ['Category', 'Value'];
    const body = (data.inventory_value_by_category || []).map((r) => [
      r.category || 'Uncategorized',
      formatCurrency ? formatCurrency(Number(r.value || 0)) : Number(r.value || 0),
    ]);
    y = drawTable(head, body, y);
    y += 8;
  }

  if (sections.includes('low')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Low Stock Items', 14, y);
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
    doc.text('Out of Stock Items', 14, y);
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
