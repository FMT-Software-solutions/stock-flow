import type { PledgeRecord } from '@/types/finance';
import { XLSX, setColumnWidths, styleHeaderRow, amountFmt, fillRow, palette } from '../styles';

export function buildPledgesSummaryWorkbook(pledges: PledgeRecord[], labels: Record<string, string>) {
  const wb = XLSX.utils.book_new();
  const header = ['Metric', 'Amount'];
  const rows: (string | number)[][] = [header];
  const totalPledged = pledges.reduce((s, r) => s + (r.pledge_amount || 0), 0);
  const totalPaid = pledges.reduce((s, r) => s + (r.amount_paid || 0), 0);
  const totalRemaining = pledges.reduce((s, r) => s + (r.amount_remaining ?? Math.max(0, (r.pledge_amount || 0) - (r.amount_paid || 0))), 0);
  rows.push([labels.total_pledged, totalPledged]);
  rows.push([labels.total_paid, totalPaid]);
  rows.push([labels.outstanding, totalRemaining]);
  rows.push(['', '']);
  rows.push([labels.by_pledge_type, 'Amount']);
  const startTypes = rows.length;
  const m = new Map<string, number>();
  pledges.forEach((p) => m.set(p.pledge_type || 'Pledge', (m.get(p.pledge_type || 'Pledge') || 0) + (p.pledge_amount || 0)));
  Array.from(m.entries()).forEach(([label, amt]) => rows.push([label, amt]));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [24, 14]);
  styleHeaderRow(ws, header);
  for (let r = 1; r < rows.length; r++) {
    const a = XLSX.utils.encode_cell({ r, c: 1 });
    if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
  }
  fillRow(ws, startTypes - 1, 0, 1, palette.section, true);
  XLSX.utils.book_append_sheet(wb, ws, (labels.title || 'Pledges Summary').slice(0, 30));
  return wb;
}
