import { XLSX, setColumnWidths, styleHeaderRowAt } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Expense } from '@/types/expenses';
import type { DateRange } from 'react-day-picker';
import { differenceInDays, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

type Template = 'detailed' | 'pivot' | 'summary';
type GroupUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
type GroupBy = 'category' | 'type';

interface CommonParams {
  template: Template;
  expenses: Expense[];
  groupUnit: GroupUnit;
  groupBy: GroupBy;
  organizationName?: string;
  description?: string;
  formatCurrency?: (amount: number) => string;
  branches?: string[];
  dateRange?: DateRange;
  includeStats?: boolean;
  includeData?: boolean;
  includeChartData?: boolean;
}

function dateToBucketKey(dateStr: string, unit: GroupUnit) {
  const d = new Date(dateStr);
  if (unit === 'day') return format(d, 'MMMM dd, yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMMM yyyy');
  if (unit === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

function startOfUnit(date: Date, unit: GroupUnit): Date {
  const t = new Date(date);
  if (unit === 'day') return startOfDay(t);
  if (unit === 'week') {
    const day = t.getDay();
    const diff = (day + 6) % 7;
    t.setDate(t.getDate() - diff);
    t.setHours(0, 0, 0, 0);
    return t;
  }
  if (unit === 'month') {
    t.setDate(1);
    t.setHours(0, 0, 0, 0);
    return t;
  }
  if (unit === 'quarter') {
    const qStartMonth = Math.floor(t.getMonth() / 3) * 3;
    t.setMonth(qStartMonth, 1);
    t.setHours(0, 0, 0, 0);
    return t;
  }
  t.setMonth(0, 1);
  t.setHours(0, 0, 0, 0);
  return t;
}

function nextBucket(date: Date, unit: GroupUnit): Date {
  const t = new Date(date);
  if (unit === 'day') t.setDate(t.getDate() + 1);
  else if (unit === 'week') t.setDate(t.getDate() + 7);
  else if (unit === 'month') t.setMonth(t.getMonth() + 1);
  else if (unit === 'quarter') t.setMonth(t.getMonth() + 3);
  else t.setFullYear(t.getFullYear() + 1);
  return t;
}

export function buildExpensesWorkbook({
  template,
  expenses,
  groupUnit,
  groupBy,
  organizationName,
  description,
  formatCurrency,
  branches,
  dateRange,
  includeStats = true,
  includeData = true,
  includeChartData = true,
}: CommonParams) {
  const wb = XLSX.utils.book_new();

  if (includeStats) {
    const header = ['Metric', 'Value'];
    const totals = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const byCat = new Map<string, number>();
    expenses.forEach((e) => {
      const k = e.categoryName || 'Uncategorized';
      byCat.set(k, (byCat.get(k) || 0) + Number(e.amount || 0));
    });
    let topCategory = '';
    let topAmount = 0;
    for (const [k, v] of byCat.entries()) {
      if (v > topAmount) {
        topAmount = v;
        topCategory = k;
      }
    }
    const body: (string | number)[][] = [
      ['Total Records', expenses.length],
      ['Total Expenditure', formatCurrency ? formatCurrency(totals) : totals],
      ['Top Category', topCategory || '-'],
      ['Top Category Amount', formatCurrency ? formatCurrency(topAmount) : topAmount],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Expenses Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length ? `Branches: ${branches.join(', ')}` : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 22]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses Stats');
  }

  if (includeData && template === 'detailed') {
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Expenses Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const header = ['Date', 'Reference', 'Category', 'Type', 'Branch', 'Amount', 'Recorded By', 'Payment', 'Status'];
    const body: (string | number)[][] = expenses.map((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const dateStr = format(d, 'MMMM dd, yyyy');
      const payment = (e.paymentMethod || '')
        .toString()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const status = (e.status || '')
        .toString()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return [
        dateStr,
        e.reference || '',
        e.categoryName || 'Uncategorized',
        e.typeName || 'Unknown Type',
        e.branchName || '',
        formatCurrency ? formatCurrency(Number(e.amount || 0)) : Number(e.amount || 0),
        e.createdByName || '',
        payment || '',
        status || '',
      ];
    });
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [22, 18, 22, 18, 18, 14, 22, 16, 14]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses Detailed');
  }

  if (includeData && template === 'pivot') {
    const source = expenses;
    const cols: string[] = (() => {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfUnit(dateRange.from, groupUnit);
        const end = startOfUnit(dateRange.to, groupUnit);
        const list: string[] = [];
        let cur = start;
        while (cur <= end) {
          list.push(dateToBucketKey(cur.toISOString(), groupUnit));
          cur = nextBucket(cur, groupUnit);
        }
        return list.reverse();
      }
      const bucketDates = new Map<string, number>();
      source.forEach((e) => {
        const d = new Date(e.date || e.createdAt || new Date().toISOString());
        const start = startOfUnit(d, groupUnit);
        const key = dateToBucketKey(start.toISOString(), groupUnit);
        const ts = start.getTime();
        if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
          bucketDates.set(key, ts);
        }
      });
      return Array.from(bucketDates.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);
    })();

    const rowsMap = new Map<string, Record<string, number>>();
    source.forEach((e) => {
      const rowLabel = groupBy === 'category' ? (e.categoryName || 'Uncategorized') : (e.typeName || 'Unknown Type');
      const bucket = dateToBucketKey(e.date || e.createdAt || new Date().toISOString(), groupUnit);
      const row = rowsMap.get(rowLabel) || {};
      const amt = Number(e.amount || 0);
      row[bucket] = (row[bucket] || 0) + amt;
      rowsMap.set(rowLabel, row);
    });

    const header = [groupBy === 'category' ? 'Category' : 'Type', ...cols, 'Total'];
    const body: (string | number)[][] = [];
    Array.from(rowsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([label, map]) => {
        const row: (string | number)[] = [label];
        let total = 0;
        cols.forEach((c) => {
          const v = Number(map[c] || 0);
          row.push(formatCurrency ? formatCurrency(v) : v);
          total += v;
        });
        row.push(formatCurrency ? formatCurrency(total) : total);
        body.push(row);
      });

    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Expenses Report']);
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
    setColumnWidths(ws, [28, ...cols.map(() => 14), 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, `Expenses Pivot (${groupBy === 'category' ? 'Category' : 'Type'})`);
  }

  if (includeData && template === 'summary') {
    const buckets: string[] = (() => {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfUnit(dateRange.from, groupUnit);
        const end = startOfUnit(dateRange.to, groupUnit);
        const list: string[] = [];
        let cur = start;
        while (cur <= end) {
          list.push(dateToBucketKey(cur.toISOString(), groupUnit));
          cur = nextBucket(cur, groupUnit);
        }
        return list.reverse();
      }
      const bucketDates = new Map<string, number>();
      expenses.forEach((e) => {
        const d = new Date(e.date || e.createdAt || new Date().toISOString());
        const start = startOfUnit(d, groupUnit);
        const key = dateToBucketKey(start.toISOString(), groupUnit);
        const ts = start.getTime();
        if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
          bucketDates.set(key, ts);
        }
      });
      return Array.from(bucketDates.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);
    })();

    const agg: Record<string, number> = {};
    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const amt = Number(e.amount || 0);
      agg[key] = (agg[key] || 0) + amt;
    });

    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Expenses Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const header = ['Time', 'Expenditure'];
    const body: (string | number)[][] = buckets.map((b) => [
      b,
      formatCurrency ? formatCurrency(agg[b] || 0) : (agg[b] || 0),
    ]);
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [24, 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses Summary');
  }

  if (includeChartData) {
    const trendUnit: GroupUnit = (() => {
      if (!dateRange?.from || !dateRange?.to) return 'month';
      const days = differenceInDays(dateRange.to, dateRange.from);
      if (days <= 45) return 'day';
      if (days <= 180) return 'week';
      return 'month';
    })();

    const trendBuckets = new Map<number, number>();
    const getTrendBucketStart = (d: Date) => {
      if (trendUnit === 'day') return startOfDay(d);
      if (trendUnit === 'week') return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const bucketStart = getTrendBucketStart(d).getTime();
      trendBuckets.set(bucketStart, (trendBuckets.get(bucketStart) || 0) + Number(e.amount || 0));
    });

    const trendData = Array.from(trendBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, amount]) => ({
        period: format(new Date(ts), 'MMMM d, yyyy'),
        amount,
      }));

    if (trendData.length) {
      const meta: (string | number)[][] = [];
      if (organizationName) meta.push([organizationName]);
      meta.push(['Expenses Report']);
      if (description) meta.push([description]);
      meta.push([
        branches && branches.length
          ? `Branches: ${branches.join(', ')}`
          : 'Branches: All Branches',
      ]);
      meta.push([]);
      meta.push([]);

      const header = ['Period', 'Expenditure'];
      const body: (string | number)[][] = trendData.map((d) => [
        d.period,
        formatCurrency ? formatCurrency(d.amount) : d.amount,
      ]);
      const aoa = [...meta, header, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const headerRowIndex = meta.length;
      setColumnWidths(ws, [26, 18]);
      styleHeaderRowAt(ws, header, headerRowIndex);
      XLSX.utils.book_append_sheet(wb, ws, 'Expenditure Trend');
    }

    const breakdownSums = new Map<string, number>();
    expenses.forEach((e) => {
      const key =
        groupBy === 'category'
          ? e.categoryName || 'Uncategorized'
          : e.typeName || 'Unknown Type';
      breakdownSums.set(key, (breakdownSums.get(key) || 0) + Number(e.amount || 0));
    });
    const breakdown = Array.from(breakdownSums.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    if (breakdown.length) {
      const meta: (string | number)[][] = [];
      if (organizationName) meta.push([organizationName]);
      meta.push(['Expenses Report']);
      if (description) meta.push([description]);
      meta.push([
        branches && branches.length
          ? `Branches: ${branches.join(', ')}`
          : 'Branches: All Branches',
      ]);
      meta.push([]);
      meta.push([]);

      const header = [groupBy === 'category' ? 'Category' : 'Type', 'Amount'];
      const body: (string | number)[][] = breakdown.map((r) => [
        r.name,
        formatCurrency ? formatCurrency(r.amount) : r.amount,
      ]);
      const aoa = [...meta, header, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const headerRowIndex = meta.length;
      setColumnWidths(ws, [30, 18]);
      styleHeaderRowAt(ws, header, headerRowIndex);
      XLSX.utils.book_append_sheet(wb, ws, 'Spending Breakdown');
    }
  }

  return wb;
}

export function buildExpensesPdfDoc({
  template,
  expenses,
  groupUnit,
  groupBy,
  organizationName,
  title = 'Expenses Report',
  description,
  formatCurrency,
  branches,
  dateRange,
  includeStats = true,
  includeData = true,
  includeChartData = true,
}: CommonParams & { title?: string }) {
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

  let y = startY;

  if (includeStats) {
    const head = ['Metric', 'Value'];
    const totals = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const byCat = new Map<string, number>();
    expenses.forEach((e) => {
      const k = e.categoryName || 'Uncategorized';
      byCat.set(k, (byCat.get(k) || 0) + Number(e.amount || 0));
    });
    let topCategory = '';
    let topAmount = 0;
    for (const [k, v] of byCat.entries()) {
      if (v > topAmount) {
        topAmount = v;
        topCategory = k;
      }
    }
    const rows: (string | number)[][] = [
      ['Total Records', expenses.length],
      ['Total Expenditure', formatCurrency ? formatCurrency(totals) : totals],
      ['Top Category', topCategory || '-'],
      ['Top Category Amount', formatCurrency ? formatCurrency(topAmount) : topAmount],
    ];
    y = drawTable(head, rows, y);
    y += 8;
  }

  if (includeData && template === 'detailed') {
    const head = ['Date', 'Reference', 'Category', 'Type', 'Branch', 'Amount', 'Recorded By', 'Payment', 'Status'];
    const rows: (string | number)[][] = expenses.map((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const dateStr = format(d, 'MMMM dd, yyyy');
      const payment = (e.paymentMethod || '')
        .toString()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const status = (e.status || '')
        .toString()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return [
        dateStr,
        e.reference || '',
        e.categoryName || 'Uncategorized',
        e.typeName || 'Unknown Type',
        e.branchName || '',
        formatCurrency ? formatCurrency(Number(e.amount || 0)) : Number(e.amount || 0),
        e.createdByName || '',
        payment || '',
        status || '',
      ];
    });
    y = drawTable(head, rows, y);
  }

  if (includeData && template === 'pivot') {
    const source = expenses;
    const cols: string[] = (() => {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfUnit(dateRange.from, groupUnit);
        const end = startOfUnit(dateRange.to, groupUnit);
        const list: string[] = [];
        let cur = start;
        while (cur <= end) {
          list.push(dateToBucketKey(cur.toISOString(), groupUnit));
          cur = nextBucket(cur, groupUnit);
        }
        return list.reverse();
      }
      const bucketDates = new Map<string, number>();
      source.forEach((e) => {
        const d = new Date(e.date || e.createdAt || new Date().toISOString());
        const start = startOfUnit(d, groupUnit);
        const key = dateToBucketKey(start.toISOString(), groupUnit);
        const ts = start.getTime();
        if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
          bucketDates.set(key, ts);
        }
      });
      return Array.from(bucketDates.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);
    })();

    const rowsMap = new Map<string, Record<string, number>>();
    source.forEach((e) => {
      const rowLabel = groupBy === 'category' ? (e.categoryName || 'Uncategorized') : (e.typeName || 'Unknown Type');
      const bucket = dateToBucketKey(e.date || e.createdAt || new Date().toISOString(), groupUnit);
      const row = rowsMap.get(rowLabel) || {};
      const amt = Number(e.amount || 0);
      row[bucket] = (row[bucket] || 0) + amt;
      rowsMap.set(rowLabel, row);
    });

    const head = [groupBy === 'category' ? 'Category' : 'Type', ...cols, 'Total'];
    const rows: (string | number)[][] = [];
    Array.from(rowsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([label, map]) => {
        const row: (string | number)[] = [label];
        let total = 0;
        cols.forEach((c) => {
          const v = Number(map[c] || 0);
          row.push(formatCurrency ? formatCurrency(v) : v);
          total += v;
        });
        row.push(formatCurrency ? formatCurrency(total) : total);
        rows.push(row);
      });
    y = drawTable(head, rows, y);
  }

  if (includeData && template === 'summary') {
    const buckets: string[] = (() => {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfUnit(dateRange.from, groupUnit);
        const end = startOfUnit(dateRange.to, groupUnit);
        const list: string[] = [];
        let cur = start;
        while (cur <= end) {
          list.push(dateToBucketKey(cur.toISOString(), groupUnit));
          cur = nextBucket(cur, groupUnit);
        }
        return list.reverse();
      }
      const bucketDates = new Map<string, number>();
      expenses.forEach((e) => {
        const d = new Date(e.date || e.createdAt || new Date().toISOString());
        const start = startOfUnit(d, groupUnit);
        const key = dateToBucketKey(start.toISOString(), groupUnit);
        const ts = start.getTime();
        if (!bucketDates.has(key) || (bucketDates.get(key) || 0) < ts) {
          bucketDates.set(key, ts);
        }
      });
      return Array.from(bucketDates.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);
    })();

    const agg: Record<string, number> = {};
    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const amt = Number(e.amount || 0);
      agg[key] = (agg[key] || 0) + amt;
    });

    const head = ['Time', 'Expenditure'];
    const rows: (string | number)[][] = buckets.map((b) => [
      b,
      formatCurrency ? formatCurrency(agg[b] || 0) : (agg[b] || 0),
    ]);
    y = drawTable(head, rows, y);
  }

  if (includeChartData) {
    const trendUnit: GroupUnit = (() => {
      if (!dateRange?.from || !dateRange?.to) return 'month';
      const days = differenceInDays(dateRange.to, dateRange.from);
      if (days <= 45) return 'day';
      if (days <= 180) return 'week';
      return 'month';
    })();

    const trendBuckets = new Map<number, number>();
    const getTrendBucketStart = (d: Date) => {
      if (trendUnit === 'day') return startOfDay(d);
      if (trendUnit === 'week') return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    expenses.forEach((e) => {
      const d = new Date(e.date || e.createdAt || new Date().toISOString());
      const bucketStart = getTrendBucketStart(d).getTime();
      trendBuckets.set(bucketStart, (trendBuckets.get(bucketStart) || 0) + Number(e.amount || 0));
    });

    const trendData = Array.from(trendBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, amount]) => ({
        period: format(new Date(ts), 'MMMM d, yyyy'),
        amount,
      }));

    const breakdownSums = new Map<string, number>();
    expenses.forEach((e) => {
      const key =
        groupBy === 'category'
          ? e.categoryName || 'Uncategorized'
          : e.typeName || 'Unknown Type';
      breakdownSums.set(key, (breakdownSums.get(key) || 0) + Number(e.amount || 0));
    });
    const breakdown = Array.from(breakdownSums.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const pageHeight = doc.internal.pageSize.getHeight();
    const ensureSpace = (h: number) => {
      if (y + h <= pageHeight - 14) return;
      doc.addPage();
      doc.setFontSize(10);
      y = 20;
    };

    if (trendData.length) {
      ensureSpace(14);
      doc.setFontSize(12);
      doc.text('Expenditure Trend', 14, y);
      doc.setFontSize(10);
      y += 6;

      const head = ['Period', 'Expenditure'];
      const rows: (string | number)[][] = trendData.map((d) => [
        d.period,
        formatCurrency ? formatCurrency(d.amount) : d.amount,
      ]);
      y = drawTable(head, rows, y);
      y += 6;
    }

    if (breakdown.length) {
      ensureSpace(14);
      doc.setFontSize(12);
      doc.text(
        `Spending Breakdown (${groupBy === 'category' ? 'Category' : 'Type'})`,
        14,
        y
      );
      doc.setFontSize(10);
      y += 6;

      const head = [groupBy === 'category' ? 'Category' : 'Type', 'Amount'];
      const rows: (string | number)[][] = breakdown.map((r) => [
        r.name,
        formatCurrency ? formatCurrency(r.amount) : r.amount,
      ]);
      y = drawTable(head, rows, y);
    }
  }

  return doc;
}
