import { format } from 'date-fns';
import { FinanceDataTable } from '@/components/finance/FinanceDataTable';
import { expenseSections } from '@/utils/finance/reports/aggregations';
import type {
  IncomeResponseRow,
  ExpenseRecord,
  PledgePayment,
} from '@/types/finance';
import { paymentMethodOptions } from '@/components/finance/constants';

interface SectionProps<T> {
  title: string;
  data: T[];
}

function humanizeIncomeType(type?: string) {
  if (!type) return '';
  return String(type)
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatCurrency(amount?: number) {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'GHS',
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function paymentMethodLabel(v?: string) {
  if (!v) return '';
  const f = paymentMethodOptions.find((p) => p.value === v);
  return (
    f?.label ||
    String(v)
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function IncomeDetailListSection({
  title,
  data,
}: SectionProps<IncomeResponseRow>) {
  const rows = (data || []).map((r) => ({
    date: r.date || r.created_at,
    item:
      r.occasion_name ||
      r.description ||
      r.category ||
      humanizeIncomeType(r.income_type),
    category: r.category || humanizeIncomeType(r.income_type),
    amount: r.amount,
    method: paymentMethodLabel(r.payment_method) || '',
    source: r.contributor_name || '',
    receipt: r.receipt_number || '',
    check_number: r.check_number || '',
    notes: r.notes || '',
  }));

  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="max-h-[500px] overflow-x-auto overflow-y-auto print:max-h-full print:overflow-visible p-1">
        <FinanceDataTable
          columns={[
            {
              key: 'date',
              label: 'Date',
              render: (v: any) =>
                v ? format(new Date(v), 'MMM dd, yyyy') : '',
            },
            { key: 'item', label: 'Item/Occasion' },
            { key: 'category', label: 'Category' },
            {
              key: 'amount',
              label: 'Amount',
              render: (v: any) => formatCurrency(v as number),
            },
            { key: 'method', label: 'Method' },
            { key: 'source', label: 'Source' },
            { key: 'receipt', label: 'Receipt' },
            { key: 'check_number', label: 'Check No.' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={rows}
          printTitle={title}
          exportable={false}
          showPrintHeader={false}
        />
      </div>
    </section>
  );
}

export function ExpensesDetailListSection({
  title,
  data,
  grouping = 'category',
  categoryLabelMap,
}: SectionProps<ExpenseRecord> & {
  grouping?: 'category' | 'purpose';
  categoryLabelMap?: Record<string, string>;
}) {
  if (grouping === 'category') {
    const { items } = expenseSections(data, 'category', categoryLabelMap);
    const rows = items.map((item) => ({
      item: item.label,
      amount: item.amount,
    }));

    return (
      <section className="space-y-2">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <div className="max-h-[500px] overflow-x-auto overflow-y-auto print:max-h-full print:overflow-visible">
          <FinanceDataTable
            columns={[
              { key: 'item', label: 'Category' },
              {
                key: 'amount',
                label: 'Amount',
                render: (v: any) => formatCurrency(v as number),
              },
            ]}
            data={rows}
            printTitle={title}
            exportable={false}
            showPrintHeader={false}
          />
        </div>
      </section>
    );
  }

  const rows = (data || []).map((r) => ({
    date: r.date || r.created_at,
    item: r.description || r.purpose || '',
    amount: r.amount,
    method: paymentMethodLabel(r.payment_method) || '',
    vendor: r.vendor || '',
    receipt: r.receipt_number || '',
    check_number: r.check_number || '',
    notes: r.notes || '',
  }));

  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="max-h-[500px] overflow-x-auto overflow-y-auto print:max-h-full print:overflow-visible">
        <FinanceDataTable
          columns={[
            {
              key: 'date',
              label: 'Date',
              render: (v: any) =>
                v ? format(new Date(v), 'MMM dd, yyyy') : '',
            },
            { key: 'item', label: 'Item' },
            {
              key: 'amount',
              label: 'Amount',
              render: (v: any) => formatCurrency(v as number),
            },
            { key: 'method', label: 'Method' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'receipt', label: 'Receipt' },
            { key: 'check_number', label: 'Check No.' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={rows}
          printTitle={title}
          exportable={false}
          showPrintHeader={false}
        />
      </div>
    </section>
  );
}

export function PledgePaymentsDetailListSection({
  title,
  data,
}: SectionProps<
  PledgePayment & {
    pledge_label?: string;
    contributor_name?: string;
    created_by_user?: { first_name?: string; last_name?: string };
  }
>) {
  const rows = (data || []).map((r) => ({
    date: r.payment_date || r.created_at,
    pledge: (r as any).pledge_label || '',
    amount: r.amount,
    method: paymentMethodLabel(r.payment_method) || '',
    source: (r as any).contributor_name || '',
    check_number: r.check_number || '',
    recordedBy: r.created_by_user
      ? `${r.created_by_user.first_name || ''} ${
          r.created_by_user.last_name || ''
        }`.trim()
      : '',
    notes: r.notes || '',
  }));

  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="max-h-[500px] overflow-x-auto overflow-y-auto print:max-h-full print:overflow-visible">
        <FinanceDataTable
          columns={[
            {
              key: 'date',
              label: 'Date',
              render: (v: any) =>
                v ? format(new Date(v), 'MMM dd, yyyy') : '',
            },
            { key: 'pledge', label: 'Pledge' },
            {
              key: 'amount',
              label: 'Amount',
              render: (v: any) => formatCurrency(v as number),
            },
            { key: 'method', label: 'Method' },
            { key: 'source', label: 'Source' },
            { key: 'check_number', label: 'Check No.' },
            { key: 'recordedBy', label: 'Recorded By' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={rows}
          printTitle={title}
          exportable={false}
          showPrintHeader={false}
        />
      </div>
    </section>
  );
}

export default function DetailListPlaceholder() {
  return (
    <div className="text-sm text-muted-foreground">
      Detail List layout unavailable. Please select sections to render.
    </div>
  );
}
