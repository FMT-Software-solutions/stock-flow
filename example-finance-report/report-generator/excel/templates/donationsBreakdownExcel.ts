import type { IncomeResponseRow } from '@/types/finance';
import { XLSX, setColumnWidths, styleHeaderRow, amountFmt } from '../styles';

export function buildDonationsBreakdownWorkbook(incomes: IncomeResponseRow[], labels: Record<string, string>) {
  const wb = XLSX.utils.book_new();
  const header = [labels.categories || 'Category', 'Amount'];
  const rows: (string | number)[][] = [header];
  incomes
    .filter((r) => r.income_type === 'contribution' || r.income_type === 'donation')
    .reduce((m, r) => {
      const key = r.category || 'Unknown';
      m.set(key, (m.get(key) || 0) + (r.amount || 0));
      return m;
    }, new Map<string, number>())
    .forEach((amt, label) => rows.push([label, amt]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [30, 14]);
  styleHeaderRow(ws, header);
  for (let r = 1; r < rows.length; r++) {
    const a = XLSX.utils.encode_cell({ r, c: 1 });
    if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
  }
  XLSX.utils.book_append_sheet(wb, ws, (labels.title || 'Contributions & Donations').slice(0, 30));
  return wb;
}
