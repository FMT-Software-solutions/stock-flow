import { XLSX, setColumnWidths, styleHeaderRowAt } from './styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LedgerOrder } from '@/hooks/useSalesLedgerReport';
import type { DateRange } from 'react-day-picker';
import { dateToBucketKey, startOfUnit, nextBucket, paymentStatusDisplay, type GroupUnit, type RowGroup } from '../../sales/utils';
import { differenceInDays, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

type Template = 'detailed' | 'pivot' | 'summary';

function bucketKeyFromDate(d: Date, unit: GroupUnit) {
  if (unit === 'day') return format(d, 'MMM, dd yyyy');
  if (unit === 'week') {
    const week = format(d, 'II');
    return `Wk ${week} ${format(d, 'yyyy')}`;
  }
  if (unit === 'month') return format(d, 'MMM yyyy');
  if (unit === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return format(d, 'yyyy');
}

interface CommonParams {
  template: Template;
  orders: LedgerOrder[];
  groupUnit: GroupUnit;
  rowGroup: RowGroup;
  organizationName?: string;
  description?: string;
  formatCurrency?: (amount: number) => string;
  branches?: string[];
  dateRange?: DateRange;
  includeStats?: boolean;
  includeData?: boolean;
  includeChartData?: boolean;
}

export function buildSalesWorkbook({
  template,
  orders,
  groupUnit,
  rowGroup,
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
    const totals = orders.reduce(
      (acc, o) => {
        const total = Number(o.total_amount || 0);
        const paid = Number(o.paid_amount || 0);
        const ps = String(o.payment_status || '').toLowerCase();
        const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
        acc.gross += total;

        if (o.payments && o.payments.length > 0) {
          acc.revenue += o.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        } else {
          acc.revenue += paid;
        }

        acc.owings += due;
        if (ps === 'refunded') acc.refunds += total;
        return acc;
      },
      { revenue: 0, gross: 0, owings: 0, refunds: 0 }
    );
    const body: (string | number)[][] = [
      ['Total Orders', orders.length],
      ['Gross Sales', formatCurrency ? formatCurrency(totals.gross) : totals.gross],
      ['Revenue Collected', formatCurrency ? formatCurrency(totals.revenue) : totals.revenue],
      ['Owings', formatCurrency ? formatCurrency(totals.owings) : totals.owings],
      ['Refunds', formatCurrency ? formatCurrency(totals.refunds) : totals.refunds],
    ];
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Sales & Orders Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length ? `Branches: ${branches.join(', ')}` : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [28, 18]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Stats');
  }

  if (includeData && template === 'detailed') {
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Sales & Orders Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const header = ['Date', 'Order #', 'Customer', 'Items', 'Branch', 'Status', 'Sale Amount', 'Collected in Period', 'Total Paid', 'Due'];
    const body: (string | number)[][] = orders.map((o: any) => {
      const d = new Date(o.date || o.created_at);
      const dateStr = format(d, 'MMM, dd yyyy');
      const customerName =
        ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
        o.customer?.email ||
        o.customer?.name ||
        'Guest';
      const itemsStr = (o.items || []).map((it: any) => `${it.product_name} x${it.quantity}`).join(', ');
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const periodPaid = Number(o.period_collected || 0);
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      const status = (o.status || '').toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

      const row: (string | number)[] = [
        dateStr,
        o.order_number,
        customerName,
        itemsStr,
        o.branch?.name || '-',
        status,
        total,
        periodPaid,
        paid,
        due,
      ];
      return row;
    });

    // Add Ledger Sheet
    const ledgerHeader = ['Order / Payment Date', 'Customer / Method', 'Recorded By / Sale Amt', 'Notes / Collected in Period', 'Amount / Status'];
    const ledgerBody: (string | number)[][] = [];

    orders.forEach((o: any) => {
      if (o.period_collected > 0 && o.payments && o.payments.length > 0) {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        const ps = (o.payment_status || '').toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

        ledgerBody.push([
          `Order #${o.order_number}`,
          customerName,
          `Sale: ${formatCurrency ? formatCurrency(Number(o.total_amount || 0)) : Number(o.total_amount || 0)}`,
          `Collected: ${formatCurrency ? formatCurrency(Number(o.period_collected || 0)) : Number(o.period_collected || 0)}`,
          `Status: ${ps}`
        ]);

        o.payments.forEach((p: any) => {
          ledgerBody.push([
            `   ${format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}`,
            `   ${(p.payment_method || '').replace('_', ' ')}`,
            p.recorded_by || '-',
            p.notes || '-',
            Number(p.amount)
          ]);
        });

        ledgerBody.push(['', '', '', '', '']); // Visual spacing
      }
    });
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [20, 12, 24, 30, 18, 20, 16, 14, 14, 14]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    {
      const ref = (ws as any)['!ref'];
      if (ref) {
        const range = XLSX.utils.decode_range(ref);
        for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: 9 });
          if (ws[addr]) {
            ws[addr].s = {
              ...(ws[addr].s || {}),
              font: { ...(ws[addr].s?.font || {}), color: { rgb: 'FFFF0000' } },
              alignment: { horizontal: 'right' },
            };
          }
          const itemsAddr = XLSX.utils.encode_cell({ r, c: 3 });
          if (ws[itemsAddr]) {
            ws[itemsAddr].s = {
              ...(ws[itemsAddr].s || {}),
              alignment: { ...(ws[itemsAddr].s?.alignment || {}), wrapText: true },
            };
          }
        }
      }
    }
    (ws as any)['!pageSetup'] = { orientation: 'landscape', scale: 90, fitToWidth: 1 };
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Detailed');

    // Add Ledger Sheet to Workbook
    const ledgerAoa = [...meta, ledgerHeader, ...ledgerBody];
    const ledgerWs = XLSX.utils.aoa_to_sheet(ledgerAoa);
    const ledgerHeaderRowIndex = meta.length;
    setColumnWidths(ledgerWs, [20, 12, 24, 18, 18, 24, 16]);
    styleHeaderRowAt(ledgerWs, ledgerHeader, ledgerHeaderRowIndex);
    XLSX.utils.book_append_sheet(wb, ledgerWs, 'Payment Ledger');
  }

  if (includeData && template === 'pivot') {
    const source = orders;
    const cols: string[] = (() => {
      if (dateRange?.from && dateRange?.to) {
        const start = startOfUnit(dateRange.from, groupUnit);
        const end = startOfUnit(dateRange.to, groupUnit);
        const list: string[] = [];
        let cur = start;
        while (cur <= end) {
          list.push(bucketKeyFromDate(cur, groupUnit));
          cur = nextBucket(cur, groupUnit);
        }
        // Newest-first to match the on-screen pivot table order.
        return list.reverse();
      }
      // Generate contiguous buckets from earliest to latest in data
      let minDate: Date | undefined;
      let maxDate: Date | undefined;
      source.forEach((o) => {
        const d = new Date(o.date || o.created_at || new Date().toISOString());
        const s = startOfUnit(d, groupUnit);
        if (!minDate || s < minDate) minDate = s;
        if (!maxDate || s > maxDate) maxDate = s;
      });
      if (!minDate || !maxDate) return [];
      const list: string[] = [];
      let cur = minDate;
      while (cur <= maxDate) {
        list.push(bucketKeyFromDate(cur, groupUnit));
        cur = nextBucket(cur, groupUnit);
      }
      return list.reverse();
    })();

    type Agg = { total: number; paid: number; gross: number; due: number };
    const rowsMap = new Map<string, Record<string, Agg>>();
    let rowItemsMap: Map<string, string[]> | undefined;
    source.forEach((o) => {
      const bucket = dateToBucketKey(startOfUnit(new Date(o.date || o.created_at), groupUnit).toISOString(), groupUnit);
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      let rowLabel = '';
      if (rowGroup === 'order') {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = `#${o.order_number} — ${customerName}`;
        const items = (o.items || []).map((it: any) => `${it.product_name}${it.quantity ? ` x${it.quantity}` : ''}`);
        if (!rowItemsMap) rowItemsMap = new Map<string, string[]>();
        const existing = rowItemsMap.get(rowLabel) || [];
        rowItemsMap.set(rowLabel, existing.concat(items));
      } else if (rowGroup === 'branch') {
        rowLabel = o.branch?.name || 'Unspecified';
      } else if (rowGroup === 'payment_status') {
        const k = (o.payment_status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'payment_method') {
        const pm = o.payments && o.payments.length > 0 ? o.payments[0].payment_method : 'other';
        rowLabel = pm.toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'status') {
        const k = (o.status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = customerName;
      }
      const row = rowsMap.get(rowLabel) || {};
      const cell = row[bucket] || { total: 0, paid: 0, gross: 0, due: 0 };
      cell.total += total;
      cell.gross += total;
      cell.due += due;

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pBucket = dateToBucketKey(startOfUnit(new Date(p.created_at), groupUnit).toISOString(), groupUnit);
          const pCell = row[pBucket] || { total: 0, paid: 0, gross: 0, due: 0 };
          pCell.paid += Number(p.amount);
          row[pBucket] = pCell;
        });
      } else {
        cell.paid += paid;
      }
      row[bucket] = cell;
      rowsMap.set(rowLabel, row);
    });
    const body: (string | number)[][] = [];
    Array.from(rowsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([label, map]) => {
        const labelFull = (() => {
          const items = rowItemsMap?.get(label) || [];
          return items.length ? `${label}\n${items.join('\n')}` : label;
        })();
        const row: (string | number)[] = [labelFull];
        let grossTotal = 0;
        let paidTotal = 0;
        let dueTotal = 0;
        cols.forEach((c) => {
          const v = map[c] || { total: 0, paid: 0, gross: 0, due: 0 };
          row.push(formatCurrency ? formatCurrency(v.gross) : v.gross);
          row.push(formatCurrency ? formatCurrency(v.paid) : v.paid);
          row.push(formatCurrency ? formatCurrency(v.due) : v.due);
          grossTotal += v.gross;
          paidTotal += v.paid;
          dueTotal += v.due;
        });
        row.push(formatCurrency ? formatCurrency(grossTotal) : grossTotal);
        row.push(formatCurrency ? formatCurrency(paidTotal) : paidTotal);
        row.push(formatCurrency ? formatCurrency(dueTotal) : dueTotal);
        body.push(row);
      });
    {
      const meta: (string | number)[][] = [];
      if (organizationName) meta.push([organizationName]);
      meta.push(['Sales & Orders Report']);
      if (description) meta.push([description]);
      meta.push([
        branches && branches.length
          ? `Branches: ${branches.join(', ')}`
          : 'Branches: All Branches',
      ]);
      meta.push([]);
      meta.push([]);
      // Each period spans 3 sub-columns (Gross, Revenue, Due). The top header row places
      // the period label at the leftmost cell of each triple with two blank cells after,
      // so when we merge [c..c+2] the label lands in the centre. Without these blanks the
      // label cells pack sequentially and the merge picks up the wrong period's name —
      // which is why month labels disappeared past the first few columns.
      const headerTop: (string | number)[] = ['Item'];
      cols.forEach((c) => headerTop.push(c, '', ''));
      headerTop.push('Total', '', '');
      const headerSub = ['Item', ...cols.flatMap(() => ['Gross', 'Revenue', 'Due']), 'Gross', 'Revenue', 'Due'];
      const aoa = [...meta, headerTop, headerSub, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const headerTopIndex = meta.length;
      const headerSubIndex = meta.length + 1;
      const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
      for (let i = 0; i < cols.length; i++) {
        const startCol = 1 + i * 3;
        merges.push({ s: { r: headerTopIndex, c: startCol }, e: { r: headerTopIndex, c: startCol + 2 } });
      }
      const totalStart = 1 + cols.length * 3;
      merges.push({ s: { r: headerTopIndex, c: totalStart }, e: { r: headerTopIndex, c: totalStart + 2 } });
      (ws as any)['!merges'] = merges;
      setColumnWidths(ws, [40, ...cols.flatMap(() => [14, 14, 14]), 16, 16, 16]);
      styleHeaderRowAt(ws, headerTop, headerTopIndex);
      styleHeaderRowAt(ws, headerSub, headerSubIndex);
      {
        const ref = (ws as any)['!ref'];
        if (ref) {
          const range = XLSX.utils.decode_range(ref);
          for (let r = headerSubIndex + 1; r <= range.e.r; r++) {
            const addrFirstCol = XLSX.utils.encode_cell({ r, c: 0 });
            if (ws[addrFirstCol]) {
              ws[addrFirstCol].s = {
                ...(ws[addrFirstCol].s || {}),
                alignment: { ...(ws[addrFirstCol].s?.alignment || {}), wrapText: true },
              };
            }
          }
        }
      }
      // Body row layout per period i: Gross @ 1+i*3, Revenue @ 1+i*3+1, Due @ 1+i*3+2.
      // The Total triple at the right uses the same Gross/Revenue/Due order starting at
      // `totalStart`. The previous code used stride 2 here, which painted the wrong
      // columns red as soon as a pivot had more than a couple of periods.
      const dueCols: number[] = [];
      for (let i = 0; i < cols.length; i++) dueCols.push(1 + i * 3 + 2);
      dueCols.push(totalStart + 2);
      const revenueCols: number[] = [];
      for (let i = 0; i < cols.length; i++) revenueCols.push(1 + i * 3 + 1);
      revenueCols.push(totalStart + 1);

      {
        const ref = (ws as any)['!ref'];
        if (ref) {
          const range = XLSX.utils.decode_range(ref);
          for (let r = headerSubIndex + 1; r <= range.e.r; r++) {
            for (const c of dueCols) {
              const addr = XLSX.utils.encode_cell({ r, c });
              if (ws[addr]) {
                ws[addr].s = {
                  ...(ws[addr].s || {}),
                  font: { ...(ws[addr].s?.font || {}), color: { rgb: 'FFFF0000' } },
                  alignment: { horizontal: 'right' },
                };
              }
            }
            for (const c of revenueCols) {
              const addr = XLSX.utils.encode_cell({ r, c });
              if (ws[addr]) {
                ws[addr].s = {
                  ...(ws[addr].s || {}),
                  alignment: { horizontal: 'right' },
                };
              }
            }
          }
        }
      }
      if (cols.length > 4) {
        (ws as any)['!pageSetup'] = { orientation: 'landscape' };
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Pivot');
    }
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
      orders.forEach((o) => {
        const d = new Date(o.date || o.created_at || new Date().toISOString());
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
    const agg: Record<string, { paid: number; gross: number; due: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      const cur = agg[key] || { paid: 0, gross: 0, due: 0 };
      cur.gross += total;
      cur.due += due;
      agg[key] = cur;

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pKey = dateToBucketKey(p.created_at, groupUnit);
          const pCur = agg[pKey] || { paid: 0, gross: 0, due: 0 };
          pCur.paid += Number(p.amount);
          agg[pKey] = pCur;
        });
      } else {
        cur.paid += paid;
      }
    });
    const meta: (string | number)[][] = [];
    if (organizationName) meta.push([organizationName]);
    meta.push(['Sales & Orders Report']);
    if (description) meta.push([description]);
    meta.push([
      branches && branches.length
        ? `Branches: ${branches.join(', ')}`
        : 'Branches: All Branches',
    ]);
    meta.push([]);
    meta.push([]);
    const header = ['Time', 'Gross Sales', 'Revenue Collected', 'Owings (Due)'];
    const body: (string | number)[][] = buckets.map((b) => [
      b,
      formatCurrency ? formatCurrency(agg[b]?.gross || 0) : agg[b]?.gross || 0,
      formatCurrency ? formatCurrency(agg[b]?.paid || 0) : agg[b]?.paid || 0,
      formatCurrency ? formatCurrency(agg[b]?.due || 0) : agg[b]?.due || 0,
    ]);
    const aoa = [...meta, header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = meta.length;
    setColumnWidths(ws, [24, 16, 16, 16]);
    styleHeaderRowAt(ws, header, headerRowIndex);
    {
      const ref = (ws as any)['!ref'];
      if (ref) {
        const range = XLSX.utils.decode_range(ref);
        for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: 2 });
          if (ws[addr]) {
            ws[addr].s = {
              ...(ws[addr].s || {}),
              font: { ...(ws[addr].s?.font || {}), color: { rgb: 'FFFF0000' } },
              alignment: { horizontal: 'right' },
            };
          }
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Summary');
  }

  if (includeChartData) {
    const trendUnit: GroupUnit = (() => {
      if (!dateRange?.from || !dateRange?.to) return 'month';
      const days = differenceInDays(dateRange.to, dateRange.from);
      if (days <= 45) return 'day';
      if (days <= 180) return 'week';
      return 'month';
    })();

    const trendBuckets = new Map<number, { revenue: number; gross_sales: number; orders: number }>();
    const getTrendBucketStart = (d: Date) => {
      if (trendUnit === 'day') return startOfDay(d);
      if (trendUnit === 'week') return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
      const bucketStart = getTrendBucketStart(d).getTime();
      const cur = trendBuckets.get(bucketStart) || { revenue: 0, gross_sales: 0, orders: 0 };
      cur.orders += 1;
      cur.gross_sales += Number(o.total_amount ?? 0);
      trendBuckets.set(bucketStart, cur);

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pDate = new Date(p.created_at);
          const pBucket = getTrendBucketStart(pDate).getTime();
          const pCur = trendBuckets.get(pBucket) || { revenue: 0, gross_sales: 0, orders: 0 };
          pCur.revenue += Number(p.amount);
          trendBuckets.set(pBucket, pCur);
        });
      } else if (Number(o.paid_amount) > 0) {
        cur.revenue += Number(o.paid_amount);
        trendBuckets.set(bucketStart, cur);
      }
    });

    const trendData = Array.from(trendBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, agg]) => ({
        period: format(new Date(ts), 'MMMM d, yyyy'),
        revenue: agg.revenue,
        gross_sales: agg.gross_sales,
        orders: agg.orders,
      }));

    if (trendData.length) {
      const meta: (string | number)[][] = [];
      if (organizationName) meta.push([organizationName]);
      meta.push(['Sales & Orders Report']);
      if (description) meta.push([description]);
      meta.push([
        branches && branches.length
          ? `Branches: ${branches.join(', ')}`
          : 'Branches: All Branches',
      ]);
      meta.push([]);
      meta.push([]);

      const header = ['Period', 'Revenue Collected', 'Gross Sales', 'Orders'];
      const body: (string | number)[][] = trendData.map((d) => [
        d.period,
        formatCurrency ? formatCurrency(d.revenue) : d.revenue,
        formatCurrency ? formatCurrency(d.gross_sales) : d.gross_sales,
        d.orders,
      ]);

      const aoa = [...meta, header, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const headerRowIndex = meta.length;
      setColumnWidths(ws, [26, 16, 16, 10]);
      styleHeaderRowAt(ws, header, headerRowIndex);
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Trend');
    }

    const paymentCounts = new Map<string, number>();
    orders.forEach((o) => {
      const k = paymentStatusDisplay(o.payment_status || 'Unknown');
      paymentCounts.set(k, (paymentCounts.get(k) || 0) + 1);
    });
    const paymentRows = Array.from(paymentCounts.entries())
      .map(([status, count]) => [status, count] as const)
      .sort((a, b) => b[1] - a[1]);

    if (paymentRows.length) {
      const meta: (string | number)[][] = [];
      if (organizationName) meta.push([organizationName]);
      meta.push(['Sales & Orders Report']);
      if (description) meta.push([description]);
      meta.push([
        branches && branches.length
          ? `Branches: ${branches.join(', ')}`
          : 'Branches: All Branches',
      ]);
      meta.push([]);
      meta.push([]);

      const header = ['Payment Status', 'Orders'];
      const body: (string | number)[][] = paymentRows.map(([status, count]) => [
        status,
        count,
      ]);
      const aoa = [...meta, header, ...body];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const headerRowIndex = meta.length;
      setColumnWidths(ws, [26, 12]);
      styleHeaderRowAt(ws, header, headerRowIndex);
      XLSX.utils.book_append_sheet(wb, ws, 'Payment Breakdown');
    }
  }

  return wb;
}

export function buildSalesPdfDoc({
  template,
  orders,
  groupUnit,
  rowGroup,
  organizationName,
  title = 'Sales & Orders Report',
  description,
  formatCurrency,
  branches,
  dateRange,
  includeStats = true,
  includeData = true,
  includeChartData = true,
}: CommonParams & { title?: string }) {
  const doc = new jsPDF({ orientation: (template === 'detailed' || template === 'pivot') ? 'landscape' : 'portrait' });
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

  const drawTable = (
    head: string[],
    rows: (string | number)[][],
    startYLocal: number,
    opts?: { dueColumns?: number[]; colStyles?: Record<number, { cellWidth?: number }>; scaleDown?: boolean }
  ) => {
    const paidFontSize = opts?.scaleDown ? 9 : 10;
    const dueFontSize = opts?.scaleDown ? 7 : 8;
    autoTable(doc, {
      head: [head],
      body: rows,
      startY: startYLocal,
      styles: { fontSize: paidFontSize },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
      columnStyles: opts?.colStyles,
      didParseCell: (data) => {
        if (!opts?.dueColumns || !opts.dueColumns.includes(data.column.index)) return;
        const raw = data.cell.raw;
        if (typeof raw === 'string' && raw.includes('\n')) {
          const parts = raw.split('\n');
          data.cell.text = [parts[0]];
          const cellAny = data.cell as any;
          const padTop =
            typeof cellAny.padding === 'function'
              ? cellAny.padding('top')
              : (cellAny.padding?.top ?? 2);
          const padBottom =
            typeof cellAny.padding === 'function'
              ? cellAny.padding('bottom')
              : (cellAny.padding?.bottom ?? 2);
          const neededHeight = padTop + padBottom + paidFontSize + dueFontSize + 4;
          data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, neededHeight);
        }
      },
      didDrawCell: (data) => {
        if (!opts?.dueColumns || !opts.dueColumns.includes(data.column.index)) return;
        const raw = data.cell.raw;
        if (typeof raw === 'string' && raw.includes('\n')) {
          const parts = raw.split('\n');
          const second = parts[1];
          if (!second) return;
          const cellAny = data.cell as any;
          const padLeft =
            typeof cellAny.padding === 'function'
              ? cellAny.padding('left')
              : (cellAny.padding?.left ?? 2);
          const padTop =
            typeof cellAny.padding === 'function'
              ? cellAny.padding('top')
              : (cellAny.padding?.top ?? 2);
          const x = cellAny.textPos?.x ?? (cellAny.x + padLeft);
          const yBase = (cellAny.textPos?.y ?? (cellAny.y + padTop));
          const y = yBase + paidFontSize + 2;
          const prevSize = doc.getFontSize();
          doc.setTextColor(255, 59, 48);
          doc.setFontSize(dueFontSize);
          doc.text(second, x, y);
          doc.setFontSize(prevSize);
          doc.setTextColor(0);
        }
      },
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

  if (includeStats) {
    const head = ['Metric', 'Value'];
    const totals = orders.reduce(
      (acc, o) => {
        const total = Number(o.total_amount || 0);
        const paid = Number(o.paid_amount || 0);
        const ps = String(o.payment_status || '').toLowerCase();
        const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
        acc.gross += total;

        if (o.payments && o.payments.length > 0) {
          acc.revenue += o.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        } else {
          acc.revenue += paid;
        }

        acc.owings += due;
        if (ps === 'refunded') acc.refunds += total;
        return acc;
      },
      { revenue: 0, gross: 0, owings: 0, refunds: 0 }
    );
    const rows: (string | number)[][] = [
      ['Total Orders', orders.length],
      ['Gross Sales', formatCurrency ? formatCurrency(totals.gross) : totals.gross],
      ['Revenue Collected', formatCurrency ? formatCurrency(totals.revenue) : totals.revenue],
      ['Owings', formatCurrency ? formatCurrency(totals.owings) : totals.owings],
      ['Refunds', formatCurrency ? formatCurrency(totals.refunds) : totals.refunds],
    ];
    y = drawTable(head, rows, y);
    y += 8;
  }

  if (includeData && template === 'detailed') {
    const head = ['Date', 'Order #', 'Customer', 'Items', 'Branch', 'Status', 'Sale Amount', 'Collected in Period', 'Total Paid'];
    const rows: (string | number)[][] = orders.map((o: any) => {
      const d = new Date(o.date || o.created_at);
      const dateStr = format(d, 'MMM, dd yyyy');
      const customerName =
        ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
        o.customer?.email ||
        o.customer?.name ||
        'Guest';
      const itemsStr = (o.items || []).map((it: any) => `${it.product_name} x${it.quantity}`).join(', ');

      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const periodPaid = Number(o.period_collected || 0);
      const status = (o.status || '').toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

      return [
        dateStr,
        o.order_number,
        customerName,
        itemsStr,
        o.branch?.name || '-',
        status,
        formatCurrency ? formatCurrency(total) : total,
        formatCurrency ? formatCurrency(periodPaid) : periodPaid,
        formatCurrency ? formatCurrency(paid) : paid,
      ];
    });

    // Draw Overview Table
    y = drawTable(head, rows, y, { dueColumns: [] });

    // Draw Ledger Table
    const ledgerHeader = ['Order / Payment Date', 'Customer / Method', 'Recorded By / Sale Amt', 'Notes / Collected', 'Amount / Status'];
    const ledgerBody: (string | number)[][] = [];

    orders.forEach((o: any) => {
      if (o.period_collected > 0 && o.payments && o.payments.length > 0) {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        const ps = (o.payment_status || '').toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

        ledgerBody.push([
          `Order #${o.order_number}`,
          customerName,
          `Sale: ${formatCurrency ? formatCurrency(Number(o.total_amount || 0)) : Number(o.total_amount || 0)}`,
          `Collected: ${formatCurrency ? formatCurrency(Number(o.period_collected || 0)) : Number(o.period_collected || 0)}`,
          `Status: ${ps}`
        ]);

        o.payments.forEach((p: any) => {
          ledgerBody.push([
            `    ${format(new Date(p.created_at), 'MMM dd, yyyy h:mm a')}`,
            `    ${(p.payment_method || '').replace('_', ' ')}`,
            p.recorded_by || '-',
            p.notes || '-',
            formatCurrency ? formatCurrency(Number(p.amount)) : Number(p.amount)
          ]);
        });
      }
    });

    if (ledgerBody.length > 0) {
      y += 10;
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Payment Ledger', 14, y);
      y += 6;
      y = drawTable(ledgerHeader, ledgerBody, y, { dueColumns: [] });
    }
  }

  if (includeData && template === 'pivot') {
    const source = orders;
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
      source.forEach((o) => {
        const d = new Date(o.date || o.created_at || new Date().toISOString());
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

    type Agg = { total: number; paid: number; gross: number; due: number };
    const rowsMap = new Map<string, Record<string, Agg>>();
    let rowItemsMap: Map<string, string[]> | undefined;
    source.forEach((o) => {
      const bucket = dateToBucketKey(o.date || o.created_at, groupUnit);
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      let rowLabel = '';
      if (rowGroup === 'order') {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = `#${o.order_number} — ${customerName}`;
        const items = (o.items || []).map((it) => `${it.product_name}${it.quantity ? ` x${it.quantity}` : ''}`);
        if (!rowItemsMap) rowItemsMap = new Map<string, string[]>();
        const existing = rowItemsMap.get(rowLabel) || [];
        rowItemsMap.set(rowLabel, existing.concat(items));
      } else if (rowGroup === 'branch') {
        rowLabel = o.branch?.name || 'Unspecified';
      } else if (rowGroup === 'payment_status') {
        const k = (o.payment_status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'payment_method') {
        const pm = o.payments && o.payments.length > 0 ? o.payments[0].payment_method : 'other';
        rowLabel = pm.toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'status') {
        const k = (o.status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = customerName;
      }
      const row = rowsMap.get(rowLabel) || {};
      const cell = row[bucket] || { total: 0, paid: 0, gross: 0, due: 0 };
      cell.total += total;
      cell.gross += total;
      cell.due += due;

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pBucket = bucketKeyFromDate(startOfUnit(new Date(p.created_at), groupUnit), groupUnit);
          const pCell = row[pBucket] || { total: 0, paid: 0, gross: 0, due: 0 };
          pCell.paid += Number(p.amount);
          row[pBucket] = pCell;
        });
      } else {
        cell.paid += paid;
      }

      row[bucket] = cell;
      rowsMap.set(rowLabel, row);
    });
    const head = ['Item', ...cols, 'Total'];
    const rows: (string | number)[][] = [];
    source.forEach((o) => {
      let rowLabel = '';
      if (rowGroup === 'order') {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = `#${o.order_number} — ${customerName}`;
        const items = (o.items || []).map((it: any) => `${it.product_name}${it.quantity ? ` x${it.quantity}` : ''}`);
        if (!rowItemsMap) rowItemsMap = new Map<string, string[]>();
        const existing = rowItemsMap.get(rowLabel) || [];
        rowItemsMap.set(rowLabel, existing.concat(items));
      } else if (rowGroup === 'branch') {
        rowLabel = o.branch?.name || 'Unspecified';
      } else if (rowGroup === 'payment_status') {
        const k = (o.payment_status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'payment_method') {
        const pm = o.payments && o.payments.length > 0 ? o.payments[0].payment_method : 'other';
        rowLabel = pm.toString().split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else if (rowGroup === 'status') {
        const k = (o.status || '').toString();
        rowLabel = k.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      } else {
        const customerName =
          ((o.customer?.first_name || '') + ' ' + (o.customer?.last_name || '')).trim() ||
          o.customer?.email ||
          o.customer?.name ||
          'Guest';
        rowLabel = customerName;
      }
      if (rowItemsMap && !rowItemsMap.has(rowLabel)) rowItemsMap.set(rowLabel, []);
    });
    Array.from(rowsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([label, map]) => {
        const labelFull = (() => {
          const items = rowItemsMap?.get(label) || [];
          return items.length ? `${label}\n${items.join('\n')}` : label;
        })();
        const row: (string | number)[] = [labelFull];
        let grossTotal = 0;
        let paidTotal = 0;
        let dueTotal = 0;
        cols.forEach((c) => {
          const v = map[c] || { total: 0, paid: 0, gross: 0, due: 0 };
          const cell =
            v.due > 0
              ? `${formatCurrency ? formatCurrency(v.gross) : v.gross}\n${formatCurrency ? formatCurrency(v.paid) : v.paid}\n${formatCurrency ? formatCurrency(v.due) : v.due}`
              : `${formatCurrency ? formatCurrency(v.gross) : v.gross}\n${formatCurrency ? formatCurrency(v.paid) : v.paid}`;
          row.push(cell);
          grossTotal += v.gross;
          paidTotal += v.paid;
          dueTotal += v.due;
        });
        const totalCell =
          dueTotal > 0
            ? `${formatCurrency ? formatCurrency(grossTotal) : grossTotal}\n${formatCurrency ? formatCurrency(paidTotal) : paidTotal}\n${formatCurrency ? formatCurrency(dueTotal) : dueTotal}`
            : `${formatCurrency ? formatCurrency(grossTotal) : grossTotal}\n${formatCurrency ? formatCurrency(paidTotal) : paidTotal}`;
        row.push(totalCell);
        rows.push(row);
      });

    const maxCols = (rowGroup === 'order' || rowGroup === 'customer') ? 8 : 9;
    for (const chunk of splitIfWide(head, rows, maxCols)) {
      const dueCols: number[] = [];
      for (let i = 1; i < chunk.head.length; i++) {
        dueCols.push(i);
      }
      const itemWidth = (rowGroup === 'order' || rowGroup === 'customer') ? 90 : 70;
      const bucketWidth = 24;
      const totalWidth = 28;
      const colStyles: Record<number, { cellWidth?: number }> = { 0: { cellWidth: itemWidth } };
      for (let i = 1; i < chunk.head.length - 1; i++) colStyles[i] = { cellWidth: bucketWidth };
      colStyles[chunk.head.length - 1] = { cellWidth: totalWidth };
      const scaleDown = chunk.head.length > 7;
      y = drawTable(chunk.head, chunk.rows, y, { dueColumns: dueCols, colStyles, scaleDown });
      y += 6;
    }
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
      orders.forEach((o) => {
        const d = new Date(o.date || o.created_at || new Date().toISOString());
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
    const agg: Record<string, { paid: number; gross: number; due: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
      const key = dateToBucketKey(d.toISOString(), groupUnit);
      const total = Number(o.total_amount || 0);
      const paid = Number(o.paid_amount || 0);
      const ps = String(o.payment_status || '').toLowerCase();
      const due = ps === 'refunded' ? 0 : Math.max(0, total - paid);
      const cur = agg[key] || { paid: 0, gross: 0, due: 0 };
      cur.gross += total;
      cur.due += due;
      agg[key] = cur;

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pKey = dateToBucketKey(p.created_at, groupUnit);
          const pCur = agg[pKey] || { paid: 0, gross: 0, due: 0 };
          pCur.paid += Number(p.amount);
          agg[pKey] = pCur;
        });
      } else {
        cur.paid += paid;
      }
    });
    const head = ['Time', 'Gross Sales', 'Revenue Collected', 'Owings (Due)'];
    const rows: (string | number)[][] = buckets.map((b) => [
      b,
      formatCurrency ? formatCurrency(agg[b]?.gross || 0) : agg[b]?.gross || 0,
      formatCurrency ? formatCurrency(agg[b]?.paid || 0) : agg[b]?.paid || 0,
      formatCurrency ? formatCurrency(agg[b]?.due || 0) : agg[b]?.due || 0,
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

    const trendBuckets = new Map<number, { revenue: number; gross_sales: number; orders: number }>();
    const getTrendBucketStart = (d: Date) => {
      if (trendUnit === 'day') return startOfDay(d);
      if (trendUnit === 'week') return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    orders.forEach((o) => {
      const d = new Date(o.date || o.created_at || new Date().toISOString());
      const bucketStart = getTrendBucketStart(d).getTime();
      const cur = trendBuckets.get(bucketStart) || { revenue: 0, gross_sales: 0, orders: 0 };
      cur.orders += 1;
      cur.gross_sales += Number(o.total_amount ?? 0);
      trendBuckets.set(bucketStart, cur);

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p: any) => {
          const pDate = new Date(p.created_at);
          const pBucket = getTrendBucketStart(pDate).getTime();
          const pCur = trendBuckets.get(pBucket) || { revenue: 0, gross_sales: 0, orders: 0 };
          pCur.revenue += Number(p.amount);
          trendBuckets.set(pBucket, pCur);
        });
      } else if (Number(o.paid_amount) > 0) {
        cur.revenue += Number(o.paid_amount);
        trendBuckets.set(bucketStart, cur);
      }
    });

    const trendData = Array.from(trendBuckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, agg]) => ({
        period: format(new Date(ts), 'MMMM d, yyyy'),
        revenue: agg.revenue,
        gross_sales: agg.gross_sales,
        orders: agg.orders,
      }));

    const paymentCounts = new Map<string, number>();
    orders.forEach((o) => {
      const k = paymentStatusDisplay(o.payment_status || 'Unknown');
      paymentCounts.set(k, (paymentCounts.get(k) || 0) + 1);
    });
    const paymentRows = Array.from(paymentCounts.entries())
      .map(([status, count]) => [status, count] as const)
      .sort((a, b) => b[1] - a[1]);

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
      doc.text('Revenue Collected & Gross Sales Trend', 14, y);
      doc.setFontSize(10);
      y += 6;

      const head = ['Period', 'Revenue Collected', 'Gross Sales', 'Orders'];
      const rows: (string | number)[][] = trendData.map((d) => [
        d.period,
        formatCurrency ? formatCurrency(d.revenue) : d.revenue,
        formatCurrency ? formatCurrency(d.gross_sales) : d.gross_sales,
        d.orders,
      ]);
      y = drawTable(head, rows, y);
      y += 6;
    }

    if (paymentRows.length) {
      ensureSpace(14);
      doc.setFontSize(12);
      doc.text('Payment Status Breakdown', 14, y);
      doc.setFontSize(10);
      y += 6;

      const head = ['Payment Status', 'Orders'];
      const rows: (string | number)[][] = paymentRows.map(([status, count]) => [
        status,
        count,
      ]);
      y = drawTable(head, rows, y);
    }
  }

  return doc;
}
