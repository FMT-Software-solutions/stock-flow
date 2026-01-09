import type { IncomeResponseRow, ExpenseRecord, PledgeRecord } from '@/types/finance';
import { XLSX, styleHeaderRow, setColumnWidths, amountFmt } from './styles';
import { paymentMethodOptions } from '@/components/finance/constants';

type FinanceItemType = 'general_income' | 'contributions' | 'donations' | 'pledge_payments' | 'expenses' | 'pledges' | 'all_income';

export function buildListWorkbook(
  incomes: IncomeResponseRow[],
  expenses: ExpenseRecord[],
  pledges: PledgeRecord[],
  selectedItems: FinanceItemType[],
  expenseGrouping: 'category' | 'purpose',
  pivotLabels: Record<string, string>
) {
  const wb = XLSX.utils.book_new();
  const pmLabel = (v?: string) => {
    if (!v) return '';
    const f = paymentMethodOptions.find((p) => p.value === v);
    return f?.label || String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  };

  const pushIncomeSheet = (title: string, src: IncomeResponseRow[]) => {
    const header = ['Date', 'Item/Occasion', 'Category', 'Amount', 'Method', 'Source', 'Receipt', 'Cheque Number', 'Notes'];
    const rows: (string | number)[][] = [header];
    src.forEach((r) => {
      rows.push([
        r.date || r.created_at || '',
        r.occasion_name || r.description || r.category || '',
        r.category || '',
        r.amount || 0,
        pmLabel(r.payment_method) || '',
        r.contributor_name || '',
        r.receipt_number || '',
        r.check_number || '',
        r.notes || '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    setColumnWidths(ws, [12, 26, 18, 14, 14, 18, 16, 16, 26]);
    styleHeaderRow(ws, header);
    for (let r = 1; r < rows.length; r++) {
      const a = XLSX.utils.encode_cell({ r, c: 3 });
      if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
    }
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
  };

  const pushExpenseSheet = (title: string, src: ExpenseRecord[]) => {
    if (expenseGrouping === 'category') {
      const header = ['Category', 'Amount'];
      const rows: (string | number)[][] = [header];
      const m = new Map<string, number>();
      src.forEach((r) => m.set(r.category || 'Unspecified', (m.get(r.category || 'Unspecified') || 0) + (r.amount || 0)));
      Array.from(m.entries()).forEach(([label, amt]) => rows.push([label, amt]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      setColumnWidths(ws, [24, 14]);
      styleHeaderRow(ws, header);
      for (let r = 1; r < rows.length; r++) {
        const a = XLSX.utils.encode_cell({ r, c: 1 });
        if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      }
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
    } else {
      const header = ['Date', 'Item', 'Amount', 'Method', 'Vendor', 'Receipt', 'Cheque Number', 'Notes'];
      const rows: (string | number)[][] = [header];
      src.forEach((r) => rows.push([
        r.date || r.created_at || '',
        r.description || r.purpose || '',
        r.amount || 0,
        pmLabel(r.payment_method) || '',
        r.vendor || '',
        r.receipt_number || '',
        r.check_number || '',
        r.notes || '',
      ]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      setColumnWidths(ws, [12, 26, 14, 14, 18, 16, 16, 26]);
      styleHeaderRow(ws, header);
      for (let r = 1; r < rows.length; r++) {
        const a = XLSX.utils.encode_cell({ r, c: 2 });
        if ((ws as any)[a]) (ws as any)[a].s = { ...(ws as any)[a].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      }
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
    }
  };

  if (selectedItems.includes('all_income')) pushIncomeSheet(pivotLabels['all_income'], incomes);
  if (selectedItems.includes('general_income')) pushIncomeSheet(pivotLabels['general_income'], incomes.filter((r) => r.income_type === 'general_income'));
  if (selectedItems.includes('contributions')) pushIncomeSheet(pivotLabels['contributions'], incomes.filter((r) => r.income_type === 'contribution'));
  if (selectedItems.includes('donations')) pushIncomeSheet(pivotLabels['donations'], incomes.filter((r) => r.income_type === 'donation'));
  if (selectedItems.includes('pledge_payments')) pushIncomeSheet(pivotLabels['pledge_payments'], incomes.filter((r) => r.income_type === 'pledge_payment'));
  if (selectedItems.includes('expenses')) pushExpenseSheet(pivotLabels['expenses'], expenses);
  if (selectedItems.includes('pledges')) {
    const header = ['Pledge Type', 'Campaign', 'Source', 'Amount', 'Start Date', 'End Date', 'Amount Paid', 'Outstanding'];
    const rows: (string | number)[][] = [header];
    pledges.forEach((p) => {
      const source = p.member_name || p.group_name || p.tag_item_name || p.source || (p.source_type === 'church' ? 'Church' : '') || '';
      rows.push([
        p.pledge_type || 'Pledge',
        p.campaign_name || '',
        source,
        p.pledge_amount || 0,
        p.start_date || '',
        p.end_date || '',
        p.amount_paid || 0,
        p.amount_remaining ?? Math.max(0, (p.pledge_amount || 0) - (p.amount_paid || 0)),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    setColumnWidths(ws, [18, 20, 22, 14, 12, 12, 14, 14]);
    styleHeaderRow(ws, header);
    for (let r = 1; r < rows.length; r++) {
      const a1 = XLSX.utils.encode_cell({ r, c: 3 });
      const a2 = XLSX.utils.encode_cell({ r, c: 6 });
      const a3 = XLSX.utils.encode_cell({ r, c: 7 });
      if ((ws as any)[a1]) (ws as any)[a1].s = { ...(ws as any)[a1].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      if ((ws as any)[a2]) (ws as any)[a2].s = { ...(ws as any)[a2].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
      if ((ws as any)[a3]) (ws as any)[a3].s = { ...(ws as any)[a3].s || {}, alignment: { horizontal: 'right' }, numFmt: amountFmt };
    }
    XLSX.utils.book_append_sheet(wb, ws, pivotLabels['pledges'].slice(0, 30));
  }

  return wb;
}
