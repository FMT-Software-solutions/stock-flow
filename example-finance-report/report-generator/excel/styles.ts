import * as XLSXBase from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
export const XLSX = XLSXStyle as unknown as typeof XLSXBase;

export const palette = {
  header: 'FFDDEBF7',
  section: 'FFE0E0E0',
  total: 'FFFCE4E4',
};

export const amountFmt = '#,##0.00';

export function setColumnWidths(ws: any, widths: number[]) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

export function styleHeaderRow(ws: any, headers: (string | number)[]) {
  for (let c = 0; c < headers.length; c++) {
    const a = XLSX.utils.encode_cell({ r: 0, c });
    ws[a] = ws[a] || { t: 's', v: headers[c] };
    ws[a].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: palette.header } }, alignment: { horizontal: 'center' } };
  }
}

export function rightAlignNumbers(ws: any, startRow: number, startCol: number, endCol: number) {
  for (let r = startRow; ; r++) {
    const exists = XLSX.utils.encode_cell({ r, c: startCol });
    if (!ws[exists] && !ws[XLSX.utils.encode_cell({ r, c: startCol + 1 })]) break;
    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = { ...(ws[addr].s || {}), alignment: { horizontal: 'right' }, numFmt: amountFmt };
    }
  }
}

export function fillRow(ws: any, rowIndex: number, startCol: number, endCol: number, rgb: string, bold = false) {
  for (let c = startCol; c <= endCol; c++) {
    const a = XLSX.utils.encode_cell({ r: rowIndex, c });
    ws[a] = ws[a] || { t: 's', v: '' };
    ws[a].s = { ...(ws[a].s || {}), font: bold ? { bold: true } : undefined, fill: { patternType: 'solid', fgColor: { rgb } } };
  }
}
