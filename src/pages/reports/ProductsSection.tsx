import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ProductsExportDialog } from './export/ProductsExportDialog';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import { LowStockTable } from './LowStockTable';
import { OutOfStockTable } from './OutOfStockTable';
import { useState } from 'react';
import { StatCard } from './components/StatCard';

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
  organizationName?: string;
  dateRange?: DateRange;
  productsDateDraft?: DateRange;
  setProductsDateDraft?: (d: DateRange | undefined) => void;
  setProductsDateApplied?: (d: DateRange | undefined) => void;
}

export function ProductsSection({
  data,
  colors,
  organizationName,
  dateRange,
  productsDateDraft,
  setProductsDateDraft,
  setProductsDateApplied,
}: ProductsSectionProps) {
  const chartConfig: ChartConfig = {
    value: { label: 'Products' },
  };
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const defaultSections: Array<'stats' | 'category' | 'low' | 'out'> = [
    'stats',
    'category',
    'low',
    'out',
  ];
  return (
    <>
      <div className="flex items-end justify-between mb-4">
        <div className='flex flex-col gap-1'>
          <span className="text-sm font-medium">
            Filter products by when they were added
          </span>
          <div className="flex items-center gap-2">
            <DatePickerWithRange
              date={productsDateDraft}
              setDate={setProductsDateDraft}
              placeholder="Select product added date range"
              className="w-full"
            />
            <Button
              onClick={() => setProductsDateApplied?.(productsDateDraft)}
              disabled={!productsDateDraft?.from && !productsDateDraft?.to}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setProductsDateDraft?.(undefined);
                setProductsDateApplied?.(undefined);
              }}
            >
              Clear
            </Button>
          </div>
          </div>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setExportOpen(true);
            }}
          >
            Export
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Products" value={data?.total_products ?? 0} />
        <StatCard title="Active" value={data?.active_products ?? 0} />
        <StatCard title="Low Stock" value={data?.low_stock_products ?? 0} valueClassName="text-orange-500" />
        <StatCard title="Out of Stock" value={data?.out_of_stock_products ?? 0} valueClassName="text-red-500" />
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
      
      {data && (
        <ProductsExportDialog
          data={data}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          defaultSections={defaultSections}
          organizationName={organizationName}
          dateRange={dateRange}
        />
      )}
    </>
  );
}
