import type { PivotRow } from '@/components/finance/reports/PivotTable';
import { XLSX, styleHeaderRow, setColumnWidths, amountFmt, fillRow, palette } from './styles';

export function buildPivotWorkbook(
  sections: Array<{ title: string; rows: PivotRow[] }>,
  columnOrder: string[],
  columnLabels: Record<string, string>
) {
  const wb = XLSX.utils.book_new();
  sections.forEach((sec) => {
    const header = ['Item', ...columnOrder.map((k) => columnLabels[k] || k), 'Total'];
    const aoa: (string | number)[][] = [header];
    for (const r of sec.rows) {
      const total = columnOrder.reduce((sum, k) => sum + (r.columns[k] || 0), 0);
      aoa.push([r.rowLabel, ...columnOrder.map((k) => (r.columns[k] || 0)), total]);
    }
    const colTotals: number[] = columnOrder.map(() => 0);
    let grandTotal = 0;
    for (let i = 1; i < aoa.length; i++) {
      for (let c = 0; c < columnOrder.length; c++) {
        colTotals[c] += Number(aoa[i][c + 1] || 0);
      }
      grandTotal += Number(aoa[i][columnOrder.length + 1] || 0);
    }
    aoa.push(new Array(header.length).fill(''));
    aoa.push(['Total', ...colTotals, grandTotal]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    setColumnWidths(ws, [18, ...columnOrder.map(() => 12), 14]);
    styleHeaderRow(ws, header);
    const totalColIndex = columnOrder.length + 1;
    for (let row = 1; row < aoa.length; row++) {
      for (let c = 1; c <= columnOrder.length; c++) {
        const a = XLSX.utils.encode_cell({ r: row, c });
        if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      }
      const t = XLSX.utils.encode_cell({ r: row, c: totalColIndex });
      if ((ws as any)[t]) {
        (ws as any)[t].s = { ...(ws as any)[t].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt, font: { ...(ws as any)[t].s?.font || {}, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: palette.section } } };
      }
    }
    fillRow(ws, aoa.length - 1, 0, header.length - 1, palette.total, true);
    XLSX.utils.book_append_sheet(wb, ws, sec.title.slice(0, 30));
  });
  return wb;
}
