import * as React from "react";
import type { PledgeRecord } from "@/types/finance";
import { BaseTemplate } from "./BaseTemplate";
import { pledgesSummary, formatCurrency } from "@/utils/finance/reports/aggregations";
import { EditableLabel } from "./EditableLabel";
import { useReportTemplateLabels } from "@/hooks/reports/useReportTemplateLabels";
import { DEFAULT_PLEDGES_SUMMARY_LABELS } from "@/db/reportTemplatePrefsDb";

interface PledgesSummaryProps {
  pledges: PledgeRecord[];
  periodLabel: string;
  branchLabel?: string;
}

export function PledgesSummary({ pledges, periodLabel, branchLabel }: PledgesSummaryProps) {
  const summary = React.useMemo(() => pledgesSummary(pledges), [pledges]);
  const { labels, setLabel } = useReportTemplateLabels('pledges_summary', DEFAULT_PLEDGES_SUMMARY_LABELS);

  return (
    <BaseTemplate
      title={
        <EditableLabel
          labelKey="title"
          text={labels.title}
          onSave={(key, value) => setLabel(key, value)}
        />
      }
      subtitle={`For the period: ${periodLabel}${branchLabel ? ` • Branch: ${branchLabel}` : ''}`}
    >
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="total_pledged"
            text={labels.total_pledged}
            onSave={(key, value) => setLabel(key, value)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(summary.totalPledged)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="total_paid"
            text={labels.total_paid}
            onSave={(key, value) => setLabel(key, value)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(summary.totalPaid)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="outstanding"
            text={labels.outstanding}
            onSave={(key, value) => setLabel(key, value)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(summary.totalRemaining)}</div>
        </div>
      </section>

      <section>
        <EditableLabel
          labelKey="by_pledge_type"
          text={labels.by_pledge_type}
          onSave={(key, value) => setLabel(key, value)}
          className="text-base font-semibold mb-2"
        />
        {/* Header row for per-type columns */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Type</span>
          <EditableLabel
            labelKey="pledged"
            text={labels.pledged || 'Pledged'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
          <EditableLabel
            labelKey="fulfilled"
            text={labels.fulfilled || 'Fulfilled'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
          <EditableLabel
            labelKey="remaining"
            text={labels.remaining || 'Remaining'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
        </div>
        <div className="space-y-1">
          {summary.typeItems.map((it) => (
            <div key={it.label} className="grid grid-cols-4 gap-2">
              <span className="text-sm">{it.label}</span>
              <span className="text-sm font-medium">{formatCurrency(it.pledged)}</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-500">{formatCurrency(it.fulfilled)}</span>
              <span className="text-sm font-medium text-orange-600 dark:text-orange-500">{formatCurrency(it.remaining)}</span>
            </div>
          ))}
        </div>
      </section>
    </BaseTemplate>
  );
}