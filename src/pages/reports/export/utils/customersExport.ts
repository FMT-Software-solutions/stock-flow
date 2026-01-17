import { XLSX, setColumnWidths, styleHeaderRowAt, rightAlignNumbers } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type SectionKey = 'stats' | 'top' | 'owing';

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

export function buildCustomersWorkbook(args: {
  data: CustomersReport;
  sections: SectionKey[];
  organizationName?: string;
  description?: string;
}) {
  const { data, sections, organizationName, description } = args;
  const wb = XLSX.utils.book_new();

  if (sections.includes('stats')) {
    const header = ['Metric', 'Value'];
    const bodyRows: (string | number)[][] = [
      ['Total Customers', data.total_customers || 0],
      ['New This Month', data.new_this_month || 0],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Customers Report']);
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

  if (sections.includes('top')) {
    const header = ['Rank', 'Customer', 'Orders', 'Total Spent'];
    const bodyRows: (string | number)[][] = (data.top_customers || []).map(
      (c, i) => [
        i + 1,
        c.name || 'Unknown',
        Number(c.orders_count ?? 0),
        Number(c.total_spent ?? 0),
      ]
    );
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Customers Report']);
    if (description) meta.push([description]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [8, 30, 12, 18]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 0, 0, false);
    rightAlignNumbers(ws, headerRowIndex + 1, 2, 2, false);
    rightAlignNumbers(ws, headerRowIndex + 1, 3, 3, true);
    XLSX.utils.book_append_sheet(wb, ws, 'Top Customers');
  }

  if (sections.includes('owing')) {
    const header = ['Rank', 'Customer', 'Open Orders', 'Total Owing', 'Last Owing Date'];
    const bodyRows: (string | number)[][] = (data.customers_owing || []).map(
      (c, i) => [
        i + 1,
        c.name || 'Unknown',
        Number(c.open_orders ?? 0),
        Number(c.total_owing ?? 0),
        c.last_owing_date ? format(new Date(c.last_owing_date), 'MMMM dd, yyyy') : '',
      ]
    );
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Customers Report']);
    if (description) meta.push([description]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...bodyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [8, 30, 14, 18, 20]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    rightAlignNumbers(ws, headerRowIndex + 1, 0, 0, false);
    rightAlignNumbers(ws, headerRowIndex + 1, 2, 3, true);
    XLSX.utils.book_append_sheet(wb, ws, 'Customers Owing');
  }

  return wb;
}

export function buildCustomersPdfDoc(args: {
  data: CustomersReport;
  sections: SectionKey[];
  organizationName?: string;
  title?: string;
  description?: string;
}) {
  const { data, sections, organizationName, title = 'Customers Report', description } = args;
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
    doc.text('Customer Stats', 14, y);
    y += 6;
    y = drawTable(
      ['Metric', 'Value'],
      [
        ['Total Customers', data.total_customers || 0],
        ['New This Month', data.new_this_month || 0],
      ],
      y
    );
    y += 8;
  }

  if (sections.includes('top')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Top Customers by Spend', 14, y);
    y += 6;
    y = drawTable(
      ['Rank', 'Customer', 'Orders', 'Total Spent'],
      (data.top_customers || []).map((c, i) => [
        i + 1,
        c.name || 'Unknown',
        c.orders_count || 0,
        Number(c.total_spent ?? 0).toFixed(2),
      ]),
      y
    );
    y += 8;
  }

  if (sections.includes('owing')) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Customers Owing Us', 14, y);
    y += 6;
    y = drawTable(
      ['Rank', 'Customer', 'Open Orders', 'Total Owing', 'Last Owing Date'],
      (data.customers_owing || []).map((c, i) => [
        i + 1,
        c.name || 'Unknown',
        c.open_orders || 0,
        Number(c.total_owing ?? 0).toFixed(2),
        c.last_owing_date ? format(new Date(c.last_owing_date), 'MMMM dd, yyyy') : '',
      ]),
      y
    );
    y += 8;
  }

  return doc;
}

