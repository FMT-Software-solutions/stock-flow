import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { format, formatDistanceToNow } from 'date-fns';
import { StatCard } from './components/StatCard';
import { SuppliersExportDialog } from './export/SuppliersExportDialog';

type SuppliersReport = {
  total_suppliers: number;
  new_this_month: number;
  new_suppliers: { id: string; name: string; created_at: string }[];
  top_suppliers: { supplier_id: string; name: string; product_count: number }[];
};

interface SuppliersSectionProps {
  data?: SuppliersReport;
  organizationName?: string;
  exportOpen: boolean;
  onExportClose: () => void;
}

export function SuppliersSection({
  data,
  organizationName,
  exportOpen,
  onExportClose,
}: SuppliersSectionProps) {
  const chartConfig: ChartConfig = {
    value: { label: 'Products' },
  };

  const topSuppliersChartData = useMemo(() => {
    return (data?.top_suppliers || []).slice(0, 10).map((s) => ({
      name: s.name || 'Unknown',
      value: Number(s.product_count ?? 0),
    }));
  }, [data?.top_suppliers]);

  const defaultSections: Array<'stats' | 'new' | 'top'> = ['stats', 'new', 'top'];

  return (
    <>
      <div className="flex items-end justify-between mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            Suppliers summary and insights
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Suppliers" value={data?.total_suppliers ?? 0} />
        <StatCard title="New This Month" value={data?.new_this_month ?? 0} />
        <StatCard
          title="New Suppliers Listed"
          value={(data?.new_suppliers || []).length}
        />
        <StatCard
          title="Top 10 by Products"
          value={(data?.top_suppliers || []).slice(0, 10).length}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Suppliers This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.new_suppliers || []).map((s) => {
              const createdAt = new Date(s.created_at);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(createdAt, 'MMMM dd, yyyy')} ({formatDistanceToNow(createdAt)} ago)
                  </div>
                </div>
              );
            })}
            {!(data?.new_suppliers || []).length && (
              <div className="text-sm text-muted-foreground">
                No new suppliers added this month.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Suppliers by Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              {(data?.top_suppliers || []).slice(0, 10).map((s, i) => (
                <div
                  key={s.supplier_id || `${s.name}-${i}`}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground font-bold">#{i + 1}</div>
                    <div className="font-medium">{s.name}</div>
                  </div>
                  <div className="font-bold">{s.product_count}</div>
                </div>
              ))}
            </div>
            <div className="w-full">
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart
                  data={topSuppliersChartData}
                  layout="vertical"
                  margin={{ left: 20, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    tickLine={false}
                    axisLine={false}
                  />
                  <XAxis
                    dataKey="value"
                    type="number"
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        nameKey="name"
                        formatter={(value) => Number(value ?? 0).toLocaleString()}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <SuppliersExportDialog
          data={data}
          open={exportOpen}
          onClose={onExportClose}
          defaultSections={defaultSections}
          organizationName={organizationName}
        />
      )}
    </>
  );
}
