import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BranchMultiSelector } from '@/components/shared/BranchMultiSelector';
import { Switch } from '@/components/ui/switch';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import { useState } from 'react';
import { LowStockTable } from './LowStockTable';
import type { StockListItem } from './stockItems';
import { OutOfStockTable } from './OutOfStockTable';
import { InventoryExportDialog } from './export/InventoryExportDialog';
import { StatCard } from './components/StatCard';
import { useBranchContext } from '@/contexts/BranchContext';

export type InventoryReport = {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  stock_by_category: { category: string; quantity: number }[];
  /** stock value at selling price */
  total_revenue?: number;
  /** stock value at cost price */
  total_cost?: number;
  inventory_value_by_category?: { category: string; value: number }[];
  low_stock_list?: StockListItem[];
  out_of_stock_list?: StockListItem[];
};

interface InventorySectionProps {
  data?: InventoryReport;
  branchIds: string[];
  setBranchIds: (ids: string[]) => void;
  organizationName?: string;
  exportOpen: boolean;
  onExportClose: () => void;
}

export function InventorySection({
  data,
  branchIds,
  setBranchIds,
  organizationName,
  exportOpen,
  onExportClose,
}: InventorySectionProps) {
  const [groupByCategory, setGroupByCategory] = useState(false);
  const chartConfig: ChartConfig = {
    value: { label: 'Inventory' },
  };
  const colors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ];
  const defaultSections: Array<'stats' | 'category' | 'value' | 'low' | 'out'> = [
    'stats',
    'category',
    'value',
    'low',
    'out',
  ];
  const { availableBranches } = useBranchContext();
  const exportBranchNames =
    branchIds && branchIds.length
      ? branchIds
          .map((id) => availableBranches.find((b) => b.id === id)?.name)
          .filter((n): n is string => !!n)
      : [];

  return (
    <>
      {/* Stock is a current figure, so this report has no date range; stock
          over time is in Stock Activity. */}
      <div className="flex-1 min-w-0">
        <BranchMultiSelector
          value={branchIds}
          onChange={setBranchIds}
          placeholder="Select branches"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Stock Items" value={data?.total_items ?? 0} />
        <StatCard title="Low Stock" value={data?.low_stock_items ?? 0} valueClassName="text-orange-500" />
        <StatCard title="Out of Stock" value={data?.out_of_stock_items ?? 0} valueClassName="text-red-500" />
        <StatCard title="Value at Price" value={<CurrencyDisplay amount={Number(data?.total_revenue ?? 0)} />} />
        <StatCard title="Value at Cost" value={<CurrencyDisplay amount={Number(data?.total_cost ?? 0)} />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="max-h-62.5 overflow-auto pr-2">
              <div className="space-y-3">
                {(data?.stock_by_category || []).map((c, index) => (
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
                    <span className="text-sm">{c.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full">
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square max-h-62.5 max-w-62.5"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel nameKey="name" />}
                  />
                  <Pie
                    data={(data?.stock_by_category || []).map((d) => ({
                      name: d.category,
                      value: d.quantity,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {(data?.stock_by_category || []).map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Value by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.inventory_value_by_category || []).map((c, index) => (
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
                <span className="text-sm">
                  <CurrencyDisplay amount={Number(c.value || 0)} />
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end mb-3 gap-2">
        <span className="text-sm">Group by category</span>
        <Switch checked={groupByCategory} onCheckedChange={setGroupByCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Low Stock Items ({data?.low_stock_items ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LowStockTable
            products={data?.low_stock_list || []}
            groupByCategory={groupByCategory}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Out of Stock Items ({data?.out_of_stock_items ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OutOfStockTable
            products={data?.out_of_stock_list || []}
            groupByCategory={groupByCategory}
          />
        </CardContent>
      </Card>

      {data && (
        <InventoryExportDialog
          data={data}
          open={exportOpen}
          onClose={onExportClose}
          organizationName={organizationName}
          defaultSections={defaultSections}
          branchNames={exportBranchNames}
        />
      )}
    </>
  );
}
