import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

type InventoryReport = {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  stock_by_category: { category: string; quantity: number }[];
};

interface InventorySectionProps {
  data?: InventoryReport;
}

export function InventorySection({ data }: InventorySectionProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.total_items ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.low_stock_items ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Out of Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.out_of_stock_items ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-100 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.stock_by_category || []).map((d) => ({ name: d.category || 'Uncategorized', quantity: d.quantity }))}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="quantity" name="Quantity" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
