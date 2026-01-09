import * as React from "react";
import type { IncomeResponseRow } from "@/types/finance";
import { BaseTemplate } from "./BaseTemplate";
import { sumByCategory, totalAmount, formatCurrency } from "@/utils/finance/reports/aggregations";
import EditableLabel from "./EditableLabel";
import { DEFAULT_DONATIONS_BREAKDOWN_LABELS } from "@/db/reportTemplatePrefsDb";
import { useReportTemplateLabels } from "@/hooks/reports/useReportTemplateLabels";

interface DonationsBreakdownProps {
  contributionsAndDonations: IncomeResponseRow[];
  periodLabel: string;
  branchLabel?: string;
}

export function DonationsBreakdown({ contributionsAndDonations, periodLabel, branchLabel }: DonationsBreakdownProps) {
  const { labels, setLabel } = useReportTemplateLabels('donations_breakdown', DEFAULT_DONATIONS_BREAKDOWN_LABELS);

  // Split into contributions and donations for stats and per-category columns
  const contributions = React.useMemo(
    () => contributionsAndDonations.filter((r) => r.income_type === 'contribution'),
    [contributionsAndDonations]
  );
  const donations = React.useMemo(
    () => contributionsAndDonations.filter((r) => r.income_type === 'donation'),
    [contributionsAndDonations]
  );

  const totals = React.useMemo(() => {
    const totalContributions = totalAmount(contributions as any);
    const totalDonations = totalAmount(donations as any);
    return {
      totalContributions,
      totalDonations,
      totalCombined: totalContributions + totalDonations,
    };
  }, [contributions, donations]);

  // Build per-category items with contributions, donations, and total columns
  const typeItems = React.useMemo(() => {
    const contribMap = sumByCategory(contributions as any, (r: any) => r.category || 'Unknown');
    const donationMap = sumByCategory(donations as any, (r: any) => r.category || 'Unknown');
    const allLabels = new Set<string>([...contribMap.keys(), ...donationMap.keys()]);
    return Array.from(allLabels.values()).map((label) => ({
      label,
      contributions: contribMap.get(label) || 0,
      donations: donationMap.get(label) || 0,
      total: (contribMap.get(label) || 0) + (donationMap.get(label) || 0),
    }));
  }, [contributions, donations]);

  return (
    <BaseTemplate
      title={
        <EditableLabel
          labelKey="title"
          text={labels.title}
          onSave={(key, v) => setLabel(key, v)}
        />
      }
      subtitle={`For the period: ${periodLabel}${branchLabel ? ` • Branch: ${branchLabel}` : ''}`}
    >
      {/* Summary stats cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="total_received"
            text={labels.total_received}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(totals.totalCombined)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="total_contributions"
            text={labels.total_contributions}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(totals.totalContributions)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <EditableLabel
            labelKey="total_donations"
            text={labels.total_donations}
            onSave={(key, v) => setLabel(key, v)}
            className="text-sm text-muted-foreground"
          />
          <div className="text-lg font-semibold">{formatCurrency(totals.totalDonations)}</div>
        </div>
      </section>

      {/* Structured per-category breakdown */}
      <section className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            <EditableLabel
              labelKey="categories"
              text={labels.categories}
              onSave={(key, v) => setLabel(key, v)}
              className="text-base font-semibold"
            />
          </h3>
          <div className="text-sm text-muted-foreground">GHS</div>
        </div>

        {/* Header row for per-category columns */}
        <div className="grid grid-cols-4 gap-2 mb-2 mt-2">
          <span className="text-xs text-muted-foreground">Type</span>
          <EditableLabel
            labelKey="contributions"
            text={labels.contributions || 'Contributions'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
          <EditableLabel
            labelKey="donations"
            text={labels.donations || 'Donations'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
          <EditableLabel
            labelKey="total"
            text={labels.total || 'Total'}
            onSave={(key, value) => setLabel(key, value)}
            className="text-xs text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          {typeItems.map((it) => (
            <div key={it.label} className="grid grid-cols-4 gap-2">
              <span className="text-sm">{it.label}</span>
              <span className="text-sm font-medium">{formatCurrency(it.contributions)}</span>
              <span className="text-sm font-medium">{formatCurrency(it.donations)}</span>
              <span className="text-sm font-semibold">{formatCurrency(it.total)}</span>
            </div>
          ))}
        </div>
      </section>
    </BaseTemplate>
  );
}