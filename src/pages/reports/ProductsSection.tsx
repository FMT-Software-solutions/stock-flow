import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Switch } from '@/components/ui/switch';
import { LowStockTable } from './LowStockTable';
import { OutOfStockTable } from './OutOfStockTable';
import { useState } from 'react';

type ProductsReport = {
  total_products: number;
  active_products: number;
  inactive_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  category_distribution: { category: string; count: number }[];
  low_stock_list: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
  out_of_stock_list: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
};

interface ProductsSectionProps {
  data?: ProductsReport;
  colors: string[];
}

export function ProductsSection({ data, colors }: ProductsSectionProps) {
  const chartConfig: ChartConfig = {
    value: { label: 'Products' },
  };
  const [groupByCategory, setGroupByCategory] = useState(false);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="gap-0">
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {data?.total_products ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-0">
            <CardTitle>Active</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {data?.active_products ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-0">
            <CardTitle>Low Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-orange-500">
            {data?.low_stock_products ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-0">
            <CardTitle>Out of Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-red-500">
            {data?.out_of_stock_products ?? 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="max-h-62.5 overflow-auto pr-2">
              <div className="space-y-3">
                {(data?.category_distribution || []).map((c, index) => (
                  <div
                    key={`${c.category}-${index}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: colors[index % colors.length],
                        }}
                      />
                      <span className="font-medium">
                        {c.category || 'Uncategorized'}
                      </span>
                    </div>
                    <span className="text-sm">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full">
              <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-62.5 max-w-62.5">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                  <Pie
                    data={(data?.category_distribution || []).map((d) => ({
                      name: d.category,
                      value: d.count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {(data?.category_distribution || []).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end mb-3 gap-2">
        <span className="text-sm">Group by category</span>
        <Switch checked={groupByCategory} onCheckedChange={setGroupByCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low Stock Products ({data?.low_stock_products ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <LowStockTable products={data?.low_stock_list || []} groupByCategory={groupByCategory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Out of Stock Products ({data?.out_of_stock_products ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <OutOfStockTable products={data?.out_of_stock_list || []} groupByCategory={groupByCategory} />
        </CardContent>
      </Card>
    </>
  );
}
