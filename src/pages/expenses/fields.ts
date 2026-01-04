import type { DataTableFilterField } from '@/types/data-table';
import type { ExportField } from '@/hooks/useExport';
import type { StatsGroup } from '@/types/stats';
import type { Expense } from '@/types/expenses';
import { DollarSign, ClipboardList, Clock, Tag } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export const getExpenseFilterFields = (
  categories: { label: string; value: string }[],
  types: { label: string; value: string }[],
  branches: { label: string; value: string }[],
  creators: { label: string; value: string }[],
  paymentMethods?: { label: string; value: string }[],
  statuses?: { label: string; value: string }[]
): DataTableFilterField[] => [
    {
      id: 'date',
      label: 'Date',
      type: 'date-range',
    },
    {
      id: 'categoryName',
      label: 'Category',
      type: 'select',
      options: categories,
    },
    {
      id: 'typeName',
      label: 'Type',
      type: 'select',
      options: types,
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: statuses || [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
      ],
    },
    {
      id: 'paymentMethod',
      label: 'Payment Method',
      type: 'select',
      options: paymentMethods || [
        { label: 'Cash', value: 'cash' },
        { label: 'Mobile Money', value: 'mobile_money' },
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Cheque', value: 'cheque' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      id: 'amount',
      label: 'Amount',
      type: 'number',
    },
    {
      id: 'branchName',
      label: 'Branch',
      type: 'select',
      options: branches,
    },
    {
      id: 'createdByName',
      label: 'Created By',
      type: 'select',
      options: creators,
    },
  ];

export const expenseExportFields: ExportField[] = [
  { id: 'date', label: 'Date', accessorFn: (row: any) => row.original.date },
  { id: 'description', label: 'Description', accessorFn: (row: any) => row.original.description },
  { id: 'amount', label: 'Amount', accessorFn: (row: any) => row.original.amount },
  { id: 'categoryName', label: 'Category', accessorFn: (row: any) => row.original.categoryName },
  { id: 'typeName', label: 'Type', accessorFn: (row: any) => row.original.typeName },
  { id: 'status', label: 'Status', accessorFn: (row: any) => row.original.status },
  { id: 'paymentMethod', label: 'Payment Method', accessorFn: (row: any) => row.original.paymentMethod },
  { id: 'branchName', label: 'Branch', accessorFn: (row: any) => row.original.branchName },
  { id: 'reference', label: 'Reference', accessorFn: (row: any) => row.original.reference, isSelectedByDefault: false },
  { id: 'createdByName', label: 'Created By', accessorFn: (row: any) => row.original.createdByName, isSelectedByDefault: false },
  { id: 'attachment', label: 'Attachment', accessorFn: (row: any) => row.original.attachment, type: 'image', isSelectedByDefault: false },
];

export const getExpenseStatsGroups = (
  formatCurrency: (amount: number) => string
): StatsGroup<Expense>[] => [
    {
      id: 'expenses_overview',
      title: 'Expenses Overview',
      icon: ClipboardList,
      fields: [
        {
          id: 'total_expenses',
          label: 'Total Records',
          calculate: (data) => ({ value: data.length }),
        },
        {
          id: 'paid',
          label: 'Paid',
          calculate: (data) => {
            const count = data.filter(
              (e) => String(e.status || '').toLowerCase() === 'paid'
            ).length;
            const pct = `${((count / (data.length || 1)) * 100).toFixed(0)}%`;
            return { value: count, subValue: pct };
          },
          className: 'text-green-600',
        },
        {
          id: 'pending',
          label: 'Pending',
          calculate: (data) => ({
            value: data.filter(
              (e) => String(e.status || '').toLowerCase() === 'pending'
            ).length,
          }),
        },
      ],
    },
    {
      id: 'financials',
      title: 'Financials',
      icon: DollarSign,
      fields: [
        {
          id: 'total_amount',
          label: 'Total Amount',
          calculate: (data) => {
            const sum = data
              .filter(
                (e) => String(e.status || '').toLowerCase() === 'paid'
              )
              .reduce((acc, e) => acc + (e.amount || 0), 0);
            return { value: formatCurrency(sum) };
          },
        },
        {
          id: 'avg_amount',
          label: 'Avg Amount',
          calculate: (data) => {
            const sum = data.reduce((acc, e) => acc + (e.amount || 0), 0);
            const avg = data.length ? sum / data.length : 0;
            return { value: formatCurrency(avg) };
          },
        },
      ],
    },
    {
      id: 'recent_activity',
      title: 'Recent Activity',
      icon: Clock,
      fields: [
        {
          id: 'last_expense',
          label: 'Last Expense',
          calculate: (data) => {
            if (data.length === 0) return { value: '-' };
            const timestamps = data
              .map((e) => new Date(e.date).getTime())
              .filter((t) => !Number.isNaN(t));
            if (timestamps.length === 0) return { value: '-' };
            const lastTs = Math.max(...timestamps);
            const lastDate = new Date(lastTs);
            const formatted = format(lastDate, 'MMM dd, yyyy h:mm a');
            let rel = formatDistanceToNow(lastDate, { addSuffix: true });
            if (
              rel === 'in less than a minute' ||
              rel === 'less than a minute ago'
            ) {
              rel = 'now';
            }
            return { value: formatted, subValue: rel };
          },
        },
        {
          id: 'with_attachments',
          label: 'With Attachment',
          calculate: (data) => ({
            value: data.filter((e) => !!e.attachmentUrl).length,
          }),
        },
      ],
    },
    {
      id: 'category_insights',
      title: 'Category Insights',
      icon: Tag,
      fields: [
        {
          id: 'top_category',
          label: 'Top Category',
          calculate: (data) => {
            const counts: Record<string, number> = {};
            for (const e of data) {
              const name = e.categoryName || 'Uncategorized';
              counts[name] = (counts[name] || 0) + 1;
            }
            const entries = Object.entries(counts);
            if (entries.length === 0) return { value: '-' };
            entries.sort((a, b) => b[1] - a[1]);
            const [name, count] = entries[0];
            const pct = `${((count / (data.length || 1)) * 100).toFixed(0)}%`;
            return { value: name, subValue: `${count} items (${pct})` };
          },
        },
      ],
    },
  ];
