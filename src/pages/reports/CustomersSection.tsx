import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
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
import { CustomersExportDialog } from './export/CustomersExportDialog';

type CustomersReport = {
  total_customers: number;
  new_this_month: number;
  top_customers: {
    customer_id: string;
    name: string;
    total_spent: number;
    orders_count: number;
  }[];
  customers_owing: {
    customer_id: string;
    name: string;
    total_owing: number;
    open_orders: number;
    last_owing_date: string | null;
  }[];
};

interface CustomersSectionProps {
  data?: CustomersReport;
  formatCurrency: (value: number) => string;
  organizationName?: string;
  dateRange?: DateRange;
  customersDateDraft?: DateRange;
  setCustomersDateDraft?: (d: DateRange | undefined) => void;
  setCustomersDateApplied?: (d: DateRange | undefined) => void;
  exportOpen: boolean;
  onExportClose: () => void;
}

export function CustomersSection({
  data,
  formatCurrency,
  organizationName,
  dateRange,
  customersDateDraft,
  setCustomersDateDraft,
  setCustomersDateApplied,
  exportOpen,
  onExportClose,
}: CustomersSectionProps) {
  const chartConfig: ChartConfig = {
    value: { label: 'Amount' },
  };

  const topCustomers = useMemo(() => {
    return (data?.top_customers || [])
      .filter((c) => Number(c.orders_count ?? 0) > 0 && Number(c.total_spent ?? 0) > 0)
      .slice(0, 10);
  }, [data?.top_customers]);

  const topSpendChartData = useMemo(() => {
    return topCustomers.map((c) => ({
      name: c.name || 'Unknown',
      value: Number(c.total_spent ?? 0),
    }));
  }, [topCustomers]);

  const owingChartData = useMemo(() => {
    return (data?.customers_owing || []).slice(0, 10).map((c) => ({
      name: c.name || 'Unknown',
      value: Number(c.total_owing ?? 0),
    }));
  }, [data?.customers_owing]);

  const defaultSections: Array<'stats' | 'top' | 'owing'> = [
    'stats',
    'top',
    'owing',
  ];

  return (
    <>
      <div className="flex items-end justify-between mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Filter customer leaderboard by order date
          </span>
          <div className="flex items-center gap-2">
            <DatePickerWithRange
              date={customersDateDraft}
              setDate={(d) => {
                setCustomersDateDraft?.(d);
                setCustomersDateApplied?.(d);
              }}
              placeholder="Select order date range"
              className="w-full"
            />
            <Button
              variant="outline"
              onClick={() => {
                setCustomersDateDraft?.(undefined);
                setCustomersDateApplied?.(undefined);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Customers" value={data?.total_customers ?? 0} />
        <StatCard title="New This Month" value={data?.new_this_month ?? 0} />
        <StatCard
          title="Top 10 by Spend"
          value={topCustomers.length}
        />
        <StatCard
          title="Customers Owing Us"
          value={(data?.customers_owing || []).length}
          valueClassName={(data?.customers_owing || []).length ? 'text-orange-500' : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Customers by Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 max-h-75 overflow-auto px-4">
              {topCustomers.map((c, i) => (
                <div
                  key={c.customer_id || `${c.name}-${i}`}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground font-bold">#{i + 1}</div>
                    <div className="font-medium">{c.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(c.total_spent)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.orders_count} orders
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="w-full">
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart
                  data={topSpendChartData}
                  layout="vertical"
                  margin={{ left: 20, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.length > 10 ? `${v.substring(0, 10)}...` : v}
                  />
                  <XAxis
                    dataKey="value"
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        nameKey="name"
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers Owing Us</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              {(data?.customers_owing || []).map((c, i) => {
                const lastOwingDate = c.last_owing_date
                  ? new Date(c.last_owing_date)
                  : null;
                return (
                  <div
                    key={c.customer_id || `${c.name}-${i}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground font-bold">#{i + 1}</div>
                      <div className="font-medium">{c.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">
                        {formatCurrency(c.total_owing)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.open_orders} open orders
                        {lastOwingDate
                          ? ` • ${format(lastOwingDate, 'MMMM dd, yyyy')} (${formatDistanceToNow(
                              lastOwingDate
                            )} ago)`
                          : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="w-full">
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart
                  data={owingChartData}
                  layout="vertical"
                  margin={{ left: 20, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.length > 10 ? `${v.substring(0, 10)}...` : v}
                  />
                  <XAxis
                    dataKey="value"
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        nameKey="name"
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <CustomersExportDialog
          data={data}
          open={exportOpen}
          onClose={onExportClose}
          defaultSections={defaultSections}
          organizationName={organizationName}
          dateRange={dateRange}
        />
      )}
    </>
  );
}
