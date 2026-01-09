import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OrdersReport = {
  total_orders: number;
  breakdown: Record<string, number>;
};

interface OrdersSectionProps {
  data?: OrdersReport;
}

export function OrdersSection({ data }: OrdersSectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_orders ?? 0}</CardContent>
        </Card>
        <Card className="col-span-2">
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
    </>
  );
}
