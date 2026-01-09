import type { IncomeResponseRow, ExpenseRecord } from '@/types/finance';
import type { GroupUnit } from '@/utils/finance/grouping';
import { dateToBucketKey } from '@/utils/finance/grouping';
import { XLSX, setColumnWidths, styleHeaderRow, amountFmt, fillRow, palette } from '../styles';

export function buildIncomeStatementWorkbook(
  incomes: IncomeResponseRow[],
  expenses: ExpenseRecord[],
  labels: Record<string, string>,
  groupUnit: GroupUnit,
  columnOrder: string[],
  columnLabels: Record<string, string>,
  expenseGrouping: 'category' | 'purpose'
) {
  const wb = XLSX.utils.book_new();
  const header = ['Section', 'Item', 'Amount'];
  const rows: (string | number)[][] = [header];
  const gen = incomes.filter((r) => r.income_type === 'general_income');
  const other = incomes.filter((r) => r.income_type !== 'general_income');
  const sumBy = (arr: typeof incomes) => {
    const m = new Map<string, number>();
    arr.forEach((r) => m.set(r.category || 'Unknown', (m.get(r.category || 'Unknown') || 0) + (r.amount || 0)));
    return Array.from(m.entries());
  };
  const revItems = sumBy(gen);
  const otherItems = sumBy(other);
  const expMap = new Map<string, number>();
  expenses.forEach((r) => {
    const key = expenseGrouping === 'category' ? (r.category || 'Unspecified') : (r.purpose || 'Unspecified');
    expMap.set(key, (expMap.get(key) || 0) + (r.amount || 0));
  });
  const expItems = Array.from(expMap.entries());
  const startRevRow = rows.length;
  revItems.forEach(([label, amt]) => rows.push([labels.revenue, label, amt]));
  const totalRevRow = rows.length;
  rows.push([labels.revenue, labels.total_revenue, gen.reduce((s, r) => s + (r.amount || 0), 0)]);
  rows.push(['', '', '']);
  const startOtherRow = rows.length;
  otherItems.forEach(([label, amt]) => rows.push([labels.other_income, label, amt]));
  const totalOtherRow = rows.length;
  rows.push([labels.other_income, labels.total_other_income, other.reduce((s, r) => s + (r.amount || 0), 0)]);
  rows.push(['', '', '']);
  const startExpRow = rows.length;
  expItems.forEach(([label, amt]) => rows.push([labels.expenditure, label, amt]));
  const totalExpRow = rows.length;
  rows.push([labels.expenditure, labels.total_expenditure, expenses.reduce((s, r) => s + (r.amount || 0), 0)]);
  rows.push(['', '', '']);
  const totalIncome = incomes.reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpense = expenses.reduce((s, r) => s + (r.amount || 0), 0);
  const startSummaryRow = rows.length;
  const totalIncomeRow = rows.length;
  rows.push([labels.summary, labels.total_income, totalIncome]);
  const profitRow = rows.length;
  rows.push([labels.summary, labels.profit, totalIncome - totalExpense]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [18, 40, 16]);
  styleHeaderRow(ws, header);
  for (let r = 1; r < rows.length; r++) {
    const a = XLSX.utils.encode_cell({ r, c: 2 });
    if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
  }
  fillRow(ws, startRevRow, 0, 0, palette.section, true);
  fillRow(ws, startOtherRow, 0, 0, palette.section, true);
  fillRow(ws, startExpRow, 0, 0, palette.section, true);
  fillRow(ws, startSummaryRow, 0, 0, palette.section, true);
  fillRow(ws, totalRevRow, 0, 2, palette.total, true);
  fillRow(ws, totalOtherRow, 0, 2, palette.total, true);
  fillRow(ws, totalExpRow, 0, 2, palette.total, true);
  fillRow(ws, totalIncomeRow, 0, 2, palette.total, true);
  fillRow(ws, profitRow, 0, 2, palette.total, true);
  XLSX.utils.book_append_sheet(wb, ws, (labels.title || 'Income Statement').slice(0, 30));

  const revenueCols: Record<string, number> = {};
  const otherIncomeCols: Record<string, number> = {};
  const expenseCols: Record<string, number> = {};
  gen.forEach((r) => {
    const bucket = dateToBucketKey(r.date, groupUnit);
    if (columnOrder.includes(bucket)) revenueCols[bucket] = (revenueCols[bucket] || 0) + (r.amount || 0);
  });
  other.forEach((r) => {
    const bucket = dateToBucketKey(r.date, groupUnit);
    if (columnOrder.includes(bucket)) otherIncomeCols[bucket] = (otherIncomeCols[bucket] || 0) + (r.amount || 0);
  });
  expenses.forEach((r) => {
    const bucket = dateToBucketKey(r.date, groupUnit);
    if (columnOrder.includes(bucket)) expenseCols[bucket] = (expenseCols[bucket] || 0) + (r.amount || 0);
  });
  const totalIncomeCols: Record<string, number> = {};
  const profitCols: Record<string, number> = {};
  columnOrder.forEach((k) => {
    const ti = (revenueCols[k] || 0) + (otherIncomeCols[k] || 0);
    totalIncomeCols[k] = ti;
    profitCols[k] = ti - (expenseCols[k] || 0);
  });
  if (columnOrder.length > 0) {
    const byPeriodHeader = ['Metric', ...columnOrder.map((k) => columnLabels[k]), 'Total'];
    const byPeriodRows: (string | number)[][] = [byPeriodHeader];
    byPeriodRows.push([labels.revenue, ...columnOrder.map((k) => revenueCols[k] || 0), columnOrder.reduce((s, k) => s + (revenueCols[k] || 0), 0)]);
    byPeriodRows.push([labels.other_income, ...columnOrder.map((k) => otherIncomeCols[k] || 0), columnOrder.reduce((s, k) => s + (otherIncomeCols[k] || 0), 0)]);
    byPeriodRows.push([labels.expenditure, ...columnOrder.map((k) => expenseCols[k] || 0), columnOrder.reduce((s, k) => s + (expenseCols[k] || 0), 0)]);
    byPeriodRows.push([labels.total_income, ...columnOrder.map((k) => totalIncomeCols[k] || 0), columnOrder.reduce((s, k) => s + (totalIncomeCols[k] || 0), 0)]);
    byPeriodRows.push([labels.profit, ...columnOrder.map((k) => profitCols[k] || 0), columnOrder.reduce((s, k) => s + (profitCols[k] || 0), 0)]);
    const wsPeriod = XLSX.utils.aoa_to_sheet(byPeriodRows);
    setColumnWidths(wsPeriod, [18, ...columnOrder.map(() => 12), 14]);
    styleHeaderRow(wsPeriod, byPeriodHeader);
    for (let r = 1; r < byPeriodRows.length; r++) {
      for (let c = 1; c < byPeriodHeader.length; c++) {
        const a = XLSX.utils.encode_cell({ r, c });
        if ((wsPeriod as any)[a]) (wsPeriod as any)[a].s = { ...(wsPeriod as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      }
    }
    const last = byPeriodRows.length - 1;
    fillRow(wsPeriod, last, 0, byPeriodHeader.length - 1, palette.total, true);
    XLSX.utils.book_append_sheet(wb, wsPeriod, (labels.by_period || 'By Period').slice(0, 30));
  }

  return wb;
}
