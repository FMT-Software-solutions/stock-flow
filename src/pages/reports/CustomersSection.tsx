import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CustomersReport = {
  total_customers: number;
  new_this_period: number;
  top_customers: { name: string; total_spent: number; orders_count: number }[];
};

interface CustomersSectionProps {
  data?: CustomersReport;
  formatCurrency: (value: number) => string;
}

export function CustomersSection({ data, formatCurrency }: CustomersSectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_customers ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New This Period</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.new_this_period ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.top_customers || []).slice(0, 10).map((c, i) => (
              <div key={`${c.name}-${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground font-bold">#{i + 1}</div>
                  <div className="font-medium">{c.name}</div>
                </div>
                <div className="font-bold">{formatCurrency(c.total_spent)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
