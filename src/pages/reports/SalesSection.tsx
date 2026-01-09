import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { format } from 'date-fns';

type TrendPoint = { date: string; value: number };

type SalesReport = {
  total_orders: number;
  total_revenue: number;
  breakdown: Record<string, number>;
  trend: TrendPoint[];
};

interface SalesSectionProps {
  data?: SalesReport;
  formatCurrency: (value: number) => string;
}

export function SalesSection({ data, formatCurrency }: SalesSectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_orders ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(data?.total_revenue ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data?.breakdown || {}).map(([k, v]) => (
                <div key={k} className="rounded-md border px-3 py-1 text-sm">
                  {k}: {v}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-100 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(data?.trend || []).map((t) => ({
                  name: format(new Date(t.date), 'MMMM dd, yyyy'),
                  value: t.value,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="value" name="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
