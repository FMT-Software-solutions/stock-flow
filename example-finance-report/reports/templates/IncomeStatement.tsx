import * as React from 'react';
import type { IncomeResponseRow, ExpenseRecord, DateFilter } from '@/types/finance';
import { BaseTemplate } from './BaseTemplate';
import {
  incomeSections,
  expenseSections,
  formatCurrency,
} from '@/utils/finance/reports/aggregations';
import EditableLabel from './EditableLabel';
import {
  DEFAULT_INCOME_STATEMENT_LABELS,
} from '@/db/reportTemplatePrefsDb';
import { useReportTemplateLabels } from '@/hooks/reports/useReportTemplateLabels';
import { buildPivotSpec, dateToBucketKey, type GroupUnit } from '@/utils/finance/grouping';
import { useExpensePreferences } from '@/hooks/finance/useExpensePreferences';

interface IncomeStatementProps {
  incomes: IncomeResponseRow[];
  expenses: ExpenseRecord[];
  periodLabel: string;
  groupUnit?: GroupUnit;
  dateFilter?: DateFilter;
  branchLabel?: string;
  expenseGrouping?: 'category' | 'purpose';
}

export function IncomeStatement({
  incomes,
  expenses,
  periodLabel,
  groupUnit,
  dateFilter,
  branchLabel,
  expenseGrouping = 'purpose',
}: IncomeStatementProps) {
  const { prefs: expensePrefs } = useExpensePreferences();
  const categoryLabelMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (expensePrefs?.categories) {
      expensePrefs.categories.forEach((c: any) => {
        map[c.key] = c.label;
      });
    }
    return map;
  }, [expensePrefs]);

  const inc = React.useMemo(() => incomeSections(incomes), [incomes]);
  const exp = React.useMemo(() => expenseSections(expenses, expenseGrouping, categoryLabelMap), [expenses, expenseGrouping, categoryLabelMap]);

  const totalIncome = inc.generalTotal + inc.otherTotal;
  const totalExpense = exp.total;
  const profit = totalIncome - totalExpense;

  const { labels, setLabel } = useReportTemplateLabels(
    'income_statement',
    DEFAULT_INCOME_STATEMENT_LABELS
  );

  // Period grouping (optional): compute per-bucket totals for revenue, other income, expenditure, total income, and profit
  const periodSpec = React.useMemo(() => {
    if (!dateFilter || !groupUnit) return null;
    return buildPivotSpec(dateFilter, groupUnit);
  }, [dateFilter, groupUnit]);

  const periodColumns = React.useMemo(() => {
    if (!periodSpec) return null;
    const columnOrder = periodSpec.buckets.map((b) => b.key);
    const columnLabels = periodSpec.buckets.reduce<Record<string, string>>((acc, b) => { acc[b.key] = b.label; return acc; }, {});

    const sumInto = (target: Record<string, number>, key: string, amount: number) => {
      target[key] = (target[key] || 0) + (amount || 0);
    };

    const revenueCols: Record<string, number> = {};
    const otherIncomeCols: Record<string, number> = {};
    const expenseCols: Record<string, number> = {};

    for (const r of incomes) {
      if (!r.date) continue;
      const bucket = dateToBucketKey(r.date, periodSpec.unit);
      if (!columnOrder.includes(bucket)) continue;
      if (r.income_type === 'general_income') {
        sumInto(revenueCols, bucket, r.amount || 0);
      } else {
        sumInto(otherIncomeCols, bucket, r.amount || 0);
      }
    }

    for (const e of expenses) {
      if (!e.date) continue;
      const bucket = dateToBucketKey(e.date, periodSpec.unit);
      if (!columnOrder.includes(bucket)) continue;
      sumInto(expenseCols, bucket, e.amount || 0);
    }

    const totalIncomeCols: Record<string, number> = {};
    const profitCols: Record<string, number> = {};
    columnOrder.forEach((k) => {
      const rev = revenueCols[k] || 0;
      const oth = otherIncomeCols[k] || 0;
      const expAmt = expenseCols[k] || 0;
      const ti = rev + oth;
      totalIncomeCols[k] = ti;
      profitCols[k] = ti - expAmt;
    });

    return { columnOrder, columnLabels, revenueCols, otherIncomeCols, expenseCols, totalIncomeCols, profitCols };
  }, [periodSpec, incomes, expenses]);

  return (
    <BaseTemplate
      title={
        <EditableLabel
          labelKey="title"
          text={labels.title as string}
          onSave={(key, v) => setLabel(key as any, v)}
        />
      }
      subtitle={`For the period: ${periodLabel}${branchLabel ? ` • Branch: ${branchLabel}` : ''}`}
    >
      {/* Revenue */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            <EditableLabel
              labelKey="revenue"
              text={labels.revenue}
              onSave={(key, v) => setLabel(key, v)}
              className="text-base font-semibold"
            />
          </h3>
          <div className="text-sm text-muted-foreground">GHS</div>
        </div>
        <div className="mt-2 space-y-1">
          {inc.generalItems.map((it) => (
            <div key={it.label} className="flex items-center justify-between">
              <span className="text-sm">{it.label}</span>
              <span className="text-sm font-medium">
                {formatCurrency(it.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-y py-2 flex items-center justify-between">
          <EditableLabel
            labelKey="total_revenue"
            text={labels.total_revenue}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(inc.generalTotal)}
          </span>
        </div>
      </section>

      {/* Other Income */}
      <section className="my-8">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            <EditableLabel
              labelKey="other_income"
              text={labels.other_income}
              onSave={(key, v) => setLabel(key, v)}
              className="text-base font-semibold"
            />
          </h3>
          <div className="text-sm text-muted-foreground">GHS</div>
        </div>
        <div className="mt-2 space-y-1">
          {inc.otherItems.map((it) => (
            <div key={it.label} className="flex items-center justify-between">
              <span className="text-sm">{it.label}</span>
              <span className="text-sm font-medium">
                {formatCurrency(it.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-y py-2 flex items-center justify-between">
          <EditableLabel
            labelKey="total_other_income"
            text={labels.total_other_income}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(inc.otherTotal)}
          </span>
        </div>
      </section>

      {/* Expenditure */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            <EditableLabel
              labelKey="expenditure"
              text={labels.expenditure}
              onSave={(key, v) => setLabel(key, v)}
              className="text-base font-semibold"
            />
          </h3>
          <div className="text-sm text-muted-foreground">GHS</div>
        </div>
        <div className="mt-2 space-y-1">
          {exp.items.map((it) => (
            <div key={it.label} className="flex items-center justify-between">
              <span className="text-sm">{it.label}</span>
              <span className="text-sm font-medium">
                {formatCurrency(it.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-y py-2 flex items-center justify-between">
          <EditableLabel
            labelKey="total_expenditure"
            text={labels.total_expenditure}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(totalExpense)}
          </span>
        </div>
      </section>

      {/* By Period (optional) */}
      {periodColumns && (
        <section className="my-8">
         
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              <EditableLabel
                labelKey="by_period"
                text={(labels as any).by_period || 'By Period'}
                onSave={(key, v) => setLabel(key, v)}
                className="text-base font-semibold"
              />
            </h3>
          </div>
          <div className="mt-3 overflow-x-auto block print:hidden" data-slot="table-container">
            <table className="min-w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left text-xs font-medium px-2 py-2 w-40">Metric</th>
                  {periodColumns.columnOrder.map((k) => (
                    <th key={k} className="text-right text-xs font-medium px-2 py-2 whitespace-nowrap">{periodColumns.columnLabels[k]}</th>
                  ))}
                  <th className="text-right text-xs font-medium px-2 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue */}
                <tr className="border-t">
                  <td className="px-2 py-2 text-sm">{labels.revenue}</td>
                  {periodColumns.columnOrder.map((k) => (
                    <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.revenueCols[k] || 0)}</td>
                  ))}
                  <td className="px-2 py-2 text-sm text-right font-semibold">
                    {formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.revenueCols[k] || 0), 0))}
                  </td>
                </tr>
                {/* Other Income */}
                <tr className="border-t">
                  <td className="px-2 py-2 text-sm">{labels.other_income}</td>
                  {periodColumns.columnOrder.map((k) => (
                    <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.otherIncomeCols[k] || 0)}</td>
                  ))}
                  <td className="px-2 py-2 text-sm text-right font-semibold">
                    {formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.otherIncomeCols[k] || 0), 0))}
                  </td>
                </tr>
                {/* Expenditure */}
                <tr className="border-t">
                  <td className="px-2 py-2 text-sm">{labels.expenditure}</td>
                  {periodColumns.columnOrder.map((k) => (
                    <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.expenseCols[k] || 0)}</td>
                  ))}
                  <td className="px-2 py-2 text-sm text-right font-semibold">
                    {formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.expenseCols[k] || 0), 0))}
                  </td>
                </tr>
                {/* Total Income */}
                <tr className="border-t">
                  <td className="px-2 py-2 text-sm">{labels.total_income}</td>
                  {periodColumns.columnOrder.map((k) => (
                    <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.totalIncomeCols[k] || 0)}</td>
                  ))}
                  <td className="px-2 py-2 text-sm text-right font-semibold">
                    {formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.totalIncomeCols[k] || 0), 0))}
                  </td>
                </tr>
                {/* Profit */}
                <tr className="border-t">
                  <td className="px-2 py-2 text-sm">{labels.profit}</td>
                  {periodColumns.columnOrder.map((k) => (
                    <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.profitCols[k] || 0)}</td>
                  ))}
                  <td className="px-2 py-2 text-sm text-right font-semibold">
                    {formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.profitCols[k] || 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="hidden print:block space-y-2">
            {(() => {
              const LIMIT = 7;
              const chunks: string[][] = [];
              for (let i = 0; i < periodColumns.columnOrder.length; i += LIMIT) {
                chunks.push(periodColumns.columnOrder.slice(i, i + LIMIT));
              }
              const revenueTotal = formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.revenueCols[k] || 0), 0));
              const otherTotal = formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.otherIncomeCols[k] || 0), 0));
              const expenseTotal = formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.expenseCols[k] || 0), 0));
              const totalIncomeTotal = formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.totalIncomeCols[k] || 0), 0));
              const profitTotal = formatCurrency(periodColumns.columnOrder.reduce((s, k) => s + (periodColumns.profitCols[k] || 0), 0));
              return (chunks.length <= 1 ? [periodColumns.columnOrder] : chunks).map((chunk, idx) => (
                <div key={idx} className="rounded-md border">
                  <table className="min-w-full table-fixed border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left text-xs font-medium px-2 py-2 w-40">Metric</th>
                        {chunk.map((k) => (
                          <th key={k} className="text-right text-xs font-medium px-2 py-2 whitespace-nowrap">{periodColumns.columnLabels[k]}</th>
                        ))}
                        <th className="text-right text-xs font-medium px-2 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-2 py-2 text-sm">{labels.revenue}</td>
                        {chunk.map((k) => (
                          <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.revenueCols[k] || 0)}</td>
                        ))}
                        <td className="px-2 py-2 text-sm text-right font-semibold">{revenueTotal}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-2 py-2 text-sm">{labels.other_income}</td>
                        {chunk.map((k) => (
                          <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.otherIncomeCols[k] || 0)}</td>
                        ))}
                        <td className="px-2 py-2 text-sm text-right font-semibold">{otherTotal}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-2 py-2 text-sm">{labels.expenditure}</td>
                        {chunk.map((k) => (
                          <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.expenseCols[k] || 0)}</td>
                        ))}
                        <td className="px-2 py-2 text-sm text-right font-semibold">{expenseTotal}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-2 py-2 text-sm">{labels.total_income}</td>
                        {chunk.map((k) => (
                          <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.totalIncomeCols[k] || 0)}</td>
                        ))}
                        <td className="px-2 py-2 text-sm text-right font-semibold">{totalIncomeTotal}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-2 py-2 text-sm">{labels.profit}</td>
                        {chunk.map((k) => (
                          <td key={k} className="px-2 py-2 text-sm text-right">{formatCurrency(periodColumns.profitCols[k] || 0)}</td>
                        ))}
                        <td className="px-2 py-2 text-sm text-right font-semibold">{profitTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ));
            })()}
          </div>
        </section>
      )}

      {/* Totals */}
      <p className="mt-8 ">
        <EditableLabel
          labelKey="summary"
          text={labels.summary}
          onSave={(key, v) => setLabel(key, v)}
          className=""
        />
      </p>
      <section className="border p-2 border-border rounded-lg space-y-4">
        <div className="mt-2 flex items-center justify-between">
          <EditableLabel
            labelKey="total_income"
            text={labels.total_income}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(totalIncome)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <EditableLabel
            labelKey="total_expenditure"
            text={labels.total_expenditure}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(totalExpense)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <EditableLabel
            labelKey="profit"
            text={labels.profit}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm font-medium"
          />
          <span className="text-sm font-semibold">
            {formatCurrency(profit)}
          </span>
        </div>
      </section>
    </BaseTemplate>
  );
}
