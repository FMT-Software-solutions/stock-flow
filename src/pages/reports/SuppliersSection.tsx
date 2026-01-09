import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SuppliersReport = {
  total_suppliers: number;
  top_suppliers: { name: string; product_count: number }[];
};

interface SuppliersSectionProps {
  data?: SuppliersReport;
}

export function SuppliersSection({ data }: SuppliersSectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_suppliers ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Suppliers by Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.top_suppliers || []).slice(0, 10).map((s, i) => (
              <div key={`${s.name}-${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground font-bold">#{i + 1}</div>
                  <div className="font-medium">{s.name}</div>
                </div>
                <div className="font-bold">{s.product_count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
