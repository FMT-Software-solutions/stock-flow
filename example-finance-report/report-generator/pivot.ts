import type { GroupUnit } from '@/utils/finance/grouping';
import { dateToBucketKey } from '@/utils/finance/grouping';
import type { IncomeResponseRow, ExpenseRecord, PledgeRecord } from '@/types/finance';
import type { PivotRow } from '@/components/finance/reports/PivotTable';
import { formatCategoryLabel } from '@/utils/finance/reports/aggregations';

export function buildIncomePivot(
  source: IncomeResponseRow[],
  label: string,
  groupUnit: GroupUnit,
  columnOrder: string[],
  filterType?: 'general_income' | 'contribution' | 'donation' | 'pledge_payment'
): { title: string; rows: PivotRow[] } {
  const filtered = filterType ? source.filter((r) => r.income_type === filterType) : source;
  const rowsMap = new Map<string, { label: string; columns: Record<string, number> }>();
  for (const r of filtered) {
    const bucket = dateToBucketKey(r.date, groupUnit);
    if (!columnOrder.includes(bucket)) continue;
    if (filterType === 'pledge_payment') {
      const key = String(r.pledge_id || 'Pledge');
      const displayLabel = String(r.occasion_name || r.description || 'Pledge');
      const entry = rowsMap.get(key) || { label: displayLabel, columns: {} };
      entry.columns[bucket] = (entry.columns[bucket] || 0) + (r.amount || 0);
      rowsMap.set(key, entry);
    } else {
      const rowLabel = String(r.category || 'Unknown');
      const entry = rowsMap.get(rowLabel) || { label: rowLabel, columns: {} };
      entry.columns[bucket] = (entry.columns[bucket] || 0) + (r.amount || 0);
      rowsMap.set(rowLabel, entry);
    }
  }
  const rows: PivotRow[] = Array.from(rowsMap.values()).map(({ label, columns }) => ({ rowLabel: label, columns }));
  rows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
  return { title: label, rows };
}

export function buildExpensesPivot(
  source: ExpenseRecord[],
  groupUnit: GroupUnit,
  columnOrder: string[],
  grouping: 'category' | 'purpose',
  categoryLabelMap: Record<string, string>
): { title: string; rows: PivotRow[] } {
  const rowsMap = new Map<string, Record<string, number>>();
  for (const r of source) {
    const bucket = dateToBucketKey(r.date, groupUnit);
    if (!columnOrder.includes(bucket)) continue;
    const rowLabel =
      grouping === 'category' ? formatCategoryLabel(r.category || 'Unspecified', categoryLabelMap) : r.purpose || 'Unspecified';
    const row = rowsMap.get(rowLabel) || {};
    row[bucket] = (row[bucket] || 0) + (r.amount || 0);
    rowsMap.set(rowLabel, row);
  }
  const rows: PivotRow[] = Array.from(rowsMap.entries()).map(([rowLabel, columns]) => ({ rowLabel, columns }));
  rows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
  return { title: 'Expenses', rows };
}

export function buildPledgesPivot(
  source: PledgeRecord[],
  groupUnit: GroupUnit,
  columnOrder: string[]
): { title: string; rows: PivotRow[] } {
  const rowsMap = new Map<string, Record<string, number>>();
  for (const r of source) {
    const bucket = dateToBucketKey(r.start_date, groupUnit);
    if (!columnOrder.includes(bucket)) continue;
    const rowLabel = String(r.pledge_type || 'Pledge');
    const row = rowsMap.get(rowLabel) || {};
    row[bucket] = (row[bucket] || 0) + (r.pledge_amount || 0);
    rowsMap.set(rowLabel, row);
  }
  const rows: PivotRow[] = Array.from(rowsMap.entries()).map(([rowLabel, columns]) => ({ rowLabel, columns }));
  rows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
  return { title: 'Pledges', rows };
}
