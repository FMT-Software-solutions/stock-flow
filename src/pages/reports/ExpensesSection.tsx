import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { format } from 'date-fns';

type TrendPoint = { date: string; value: number };

type ExpensesReport = {
  total_records: number;
  total_expenditure: number;
  grouped: { name: string; amount: number }[];
  trend: TrendPoint[];
};

interface ExpensesSectionProps {
  data?: ExpensesReport;
  formatCurrency: (value: number) => string;
}

export function ExpensesSection({ data, formatCurrency }: ExpensesSectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_records ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Expenditure</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(data?.total_expenditure ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Grouped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(data?.grouped || []).map((g) => (
                <div key={g.name} className="rounded-md border px-3 py-1 text-sm">
                  {g.name}: {formatCurrency(g.amount)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Trend</CardTitle>
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
                <Line type="monotone" dataKey="value" name="Expenditure" stroke="hsl(var(--chart-3))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
