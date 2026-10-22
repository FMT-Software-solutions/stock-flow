import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/utils/supabase';
import { cn } from '@/lib/utils';
import { StockListTable } from './StockListTable';
import type { StockListItem } from './stockItems';
import { InventoryExportDialog } from './export/InventoryExportDialog';
import { StatCard } from './components/StatCard';

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
  /** per product, across the selected branches */
  low_stock_products?: number;
  out_of_stock_products?: number;
  product_low_stock_list?: StockListItem[];
  product_out_of_stock_list?: StockListItem[];
};

type ProductCounts = {
  total_products: number;
  active_products: number;
  draft_products?: number;
  archived_products?: number;
  untracked_products?: number;
};

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

/**
 * Current stock: counts, value, stock by category, and what is low or out —
 * listed per stock item (variant × branch) or rolled up per product.
 */
export function StockOnHandSection({
  orgId,
  branchIds,
  organizationName,
  exportOpen,
  onExportClose,
}: {
  orgId?: string;
  branchIds: string[];
  organizationName?: string;
  exportOpen: boolean;
  onExportClose: () => void;
}) {
  const [listBy, setListBy] = useState<'items' | 'products'>('items');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const { availableBranches } = useBranchContext();
  const branches = branchIds.length > 0 ? branchIds : null;

  const { data } = useQuery({
    queryKey: ['reports', 'inventory', orgId, branches],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_report', {
        p_organization_id: orgId,
        p_branch_ids: branches,
      });
      if (error) throw error;
      return data as InventoryReport;
    },
    enabled: !!orgId,
  });

  const { data: counts } = useQuery({
    queryKey: ['reports', 'products', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_products_report', { p_organization_id: orgId });
      if (error) throw error;
      return data as ProductCounts;
    },
    enabled: !!orgId,
  });

  const byProduct = listBy === 'products';
  const lowList = (byProduct ? data?.product_low_stock_list : data?.low_stock_list) ?? [];
  const outList = (byProduct ? data?.product_out_of_stock_list : data?.out_of_stock_list) ?? [];
  const lowCount = (byProduct ? data?.low_stock_products : data?.low_stock_items) ?? 0;
  const outCount = (byProduct ? data?.out_of_stock_products : data?.out_of_stock_items) ?? 0;

  const chartConfig: ChartConfig = { value: { label: 'Stock' } };
  const exportBranchNames = branchIds
    .map((id) => availableBranches.find((b) => b.id === id)?.name)
    .filter((n): n is string => !!n);

  const productBreakdown = counts
    ? [
        `${counts.active_products} active`,
        `${counts.draft_products ?? 0} draft`,
        `${counts.archived_products ?? 0} archived`,
        `${counts.untracked_products ?? 0} without stock tracking`,
      ].join(' · ')
    : undefined;

  return (
    <>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <div title={productBreakdown}>
          <StatCard title="Products" value={counts?.total_products ?? 0} />
        </div>
        <StatCard title="Stock Items" value={data?.total_items ?? 0} />
        <StatCard title="Low Stock" value={lowCount} valueClassName="text-orange-500" />
        <StatCard title="Out of Stock" value={outCount} valueClassName="text-red-500" />
        <StatCard title="Value at Price" value={<CurrencyDisplay amount={Number(data?.total_revenue ?? 0)} />} />
        <StatCard title="Value at Cost" value={<CurrencyDisplay amount={Number(data?.total_cost ?? 0)} />} />
      </div>

      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock by Category</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 [&>*]:min-w-0 gap-6 sm:grid-cols-2">
            <div className="max-h-62.5 space-y-3 overflow-auto pr-2">
              {(data?.stock_by_category ?? []).map((c, index) => (
                <div key={`${c.category}-${index}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{c.category || 'Uncategorized'}</span>
                  </div>
                  <span className="text-sm tabular-nums">{c.quantity}</span>
                </div>
              ))}
            </div>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-50 max-w-50">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                <Pie
                  data={(data?.stock_by_category ?? []).map((d) => ({ name: d.category, value: d.quantity }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                >
                  {(data?.stock_by_category ?? []).map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Value at Cost by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.inventory_value_by_category ?? []).map((c, index) => (
              <div key={`${c.category}-${index}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{c.category || 'Uncategorized'}</span>
                </div>
                <span className="text-sm tabular-nums">
                  <CurrencyDisplay amount={Number(c.value || 0)} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md bg-muted p-1" role="group" aria-label="List by">
          {(['items', 'products'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setListBy(mode)}
              aria-pressed={listBy === mode}
              title={
                mode === 'items'
                  ? 'Each variant in each branch'
                  : 'Each product, totalled across the selected branches'
              }
              className={cn(
                'rounded px-3 py-1 text-sm font-medium capitalize',
                listBy === mode ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Group by category
          <Switch checked={groupByCategory} onCheckedChange={setGroupByCategory} />
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low Stock ({lowCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <StockListTable products={lowList} groupByCategory={groupByCategory} emptyText="Nothing is low." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Out of Stock ({outCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <StockListTable products={outList} groupByCategory={groupByCategory} emptyText="Nothing is out of stock." />
        </CardContent>
      </Card>

      {data && (
        <InventoryExportDialog
          data={data}
          open={exportOpen}
          onClose={onExportClose}
          organizationName={organizationName}
          branchNames={exportBranchNames}
        />
      )}
    </>
  );
}
