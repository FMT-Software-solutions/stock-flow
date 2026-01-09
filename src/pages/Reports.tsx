import { BranchMultiSelector } from '@/components/shared/BranchMultiSelector';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBranchContext } from '@/contexts/BranchContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/utils/supabase';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CustomersSection } from './reports/CustomersSection';
import { ExpensesSection } from './reports/ExpensesSection';
import { InventorySection } from './reports/InventorySection';
import { OrdersSection } from './reports/OrdersSection';
import { ProductsSection } from './reports/ProductsSection';
import { SalesSection } from './reports/SalesSection';
import { SuppliersSection } from './reports/SuppliersSection';

type TrendPoint = { date: string; value: number };

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

type InventoryReport = {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  stock_by_category: { category: string; quantity: number }[];
};

type SalesReport = {
  total_orders: number;
  total_revenue: number;
  breakdown: Record<string, number>;
  trend: TrendPoint[];
};

type OrdersReport = {
  total_orders: number;
  breakdown: Record<string, number>;
};

type ExpensesReport = {
  total_records: number;
  total_expenditure: number;
  grouped: { name: string; amount: number }[];
  trend: TrendPoint[];
};

type CustomersReport = {
  total_customers: number;
  new_this_period: number;
  top_customers: { name: string; total_spent: number; orders_count: number }[];
};

type SuppliersReport = {
  total_suppliers: number;
  top_suppliers: { name: string; product_count: number }[];
};

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function Reports() {
  const { formatCurrency } = useCurrency();
  const { currentOrganization } = useOrganization();
  const { selectedBranchIds: globalBranchIds } = useBranchContext();

  const [activeTab, setActiveTab] = useState<
    | 'products'
    | 'inventory'
    | 'sales'
    | 'orders'
    | 'expenses'
    | 'customers'
    | 'suppliers'
  >('products');
  const [generalDateRange, setGeneralDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [productsDateDraft, setProductsDateDraft] = useState<
    DateRange | undefined
  >(undefined);
  const [productsDateApplied, setProductsDateApplied] = useState<
    DateRange | undefined
  >(undefined);
  const [branchIds, setBranchIds] = useState<string[]>(globalBranchIds);
  const [template, setTemplate] = useState<'compact' | 'detailed' | 'pivot'>(
    'compact'
  );
  const [expensesGroupBy, setExpensesGroupBy] = useState<'category' | 'type'>(
    'category'
  );

  const orgId = currentOrganization?.id;

  const normalizedBranchIds = useMemo(() => {
    return branchIds && branchIds.length > 0 ? branchIds : null;
  }, [branchIds]);

  const startIso = generalDateRange?.from
    ? new Date(generalDateRange.from).toISOString()
    : null;
  const endIso = generalDateRange?.to
    ? new Date(generalDateRange.to).toISOString()
    : null;
  const productsStartIso = productsDateApplied?.from
    ? new Date(productsDateApplied.from).toISOString()
    : null;
  const productsEndIso = productsDateApplied?.to
    ? new Date(productsDateApplied.to).toISOString()
    : null;

  const isBranchScoped = (tab: typeof activeTab) => {
    return (
      tab === 'inventory' ||
      tab === 'sales' ||
      tab === 'orders' ||
      tab === 'expenses'
    );
  };

  const productsReport = useQuery({
    queryKey: ['reports', 'products', orgId, productsStartIso, productsEndIso],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_products_report', {
        p_organization_id: orgId,
        p_start_date: productsStartIso,
        p_end_date: productsEndIso,
      });
      if (error) throw error;
      return data as ProductsReport;
    },
    enabled: !!orgId && activeTab === 'products',
    placeholderData: (prev) =>
      prev ?? {
        total_products: 0,
        active_products: 0,
        inactive_products: 0,
        low_stock_products: 0,
        out_of_stock_products: 0,
        category_distribution: [],
        low_stock_list: [],
        out_of_stock_list: [],
      },
  });

  const inventoryReport = useQuery({
    queryKey: [
      'reports',
      'inventory',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_report', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as InventoryReport;
    },
    enabled: !!orgId && activeTab === 'inventory',
    placeholderData: (prev) =>
      prev ?? {
        total_items: 0,
        low_stock_items: 0,
        out_of_stock_items: 0,
        stock_by_category: [],
      },
  });

  const salesReport = useQuery({
    queryKey: [
      'reports',
      'sales',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sales_report', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as SalesReport;
    },
    enabled: !!orgId && activeTab === 'sales',
    placeholderData: (prev) =>
      prev ?? {
        total_orders: 0,
        total_revenue: 0,
        breakdown: {},
        trend: [],
      },
  });

  const ordersReport = useQuery({
    queryKey: [
      'reports',
      'orders',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_orders_report', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as OrdersReport;
    },
    enabled: !!orgId && activeTab === 'orders',
    placeholderData: (prev) =>
      prev ?? {
        total_orders: 0,
        breakdown: {},
      },
  });

  const expensesReport = useQuery({
    queryKey: [
      'reports',
      'expenses',
      orgId,
      normalizedBranchIds,
      startIso,
      endIso,
      expensesGroupBy,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_expenses_report', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: startIso,
        p_end_date: endIso,
        p_group_by: expensesGroupBy,
      });
      if (error) throw error;
      return data as ExpensesReport;
    },
    enabled: !!orgId && activeTab === 'expenses',
    placeholderData: (prev) =>
      prev ?? {
        total_records: 0,
        total_expenditure: 0,
        grouped: [],
        trend: [],
      },
  });

  const customersReport = useQuery({
    queryKey: ['reports', 'customers', orgId, startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customers_report', {
        p_organization_id: orgId,
        p_start_date: startIso,
        p_end_date: endIso,
      });
      if (error) throw error;
      return data as CustomersReport;
    },
    enabled: !!orgId && activeTab === 'customers',
    placeholderData: (prev) =>
      prev ?? {
        total_customers: 0,
        new_this_period: 0,
        top_customers: [],
      },
  });

  const suppliersReport = useQuery({
    queryKey: ['reports', 'suppliers', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_suppliers_report', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      return data as SuppliersReport;
    },
    enabled: !!orgId && activeTab === 'suppliers',
    placeholderData: (prev) =>
      prev ?? {
        total_suppliers: 0,
        top_suppliers: [],
      },
  });

  const periodLabel = useMemo(() => {
    const range =
      activeTab === 'products' ? productsDateApplied : generalDateRange;
    if (!range?.from && !range?.to) return 'All Time';
    const from = range?.from ? format(range.from, 'MMMM dd, yyyy') : 'Start';
    const to = range?.to ? format(range.to, 'MMMM dd, yyyy') : 'Today';
    return `${from} — ${to}`;
  }, [activeTab, productsDateApplied, generalDateRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and review reports</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Period: {periodLabel}
        </div>
        {isBranchScoped(activeTab) && (
          <div className="text-sm text-muted-foreground">
            Branches: {branchIds.length > 0 ? branchIds.length : 'All'}
          </div>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {activeTab !== 'products' && (
              <DatePickerWithRange
                date={generalDateRange}
                setDate={setGeneralDateRange}
                placeholder="Select date range"
                className="w-full"
              />
            )}
          </div>
          {activeTab !== 'products' && (
            <div className="flex items-center gap-2">
              <Select
                value={template}
                onValueChange={(v) =>
                  setTemplate(v as 'compact' | 'detailed' | 'pivot')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="pivot">Pivot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isBranchScoped(activeTab) && (
            <div className="flex items-center">
              <BranchMultiSelector
                value={branchIds}
                onChange={setBranchIds}
                placeholder="Select branches"
              />
            </div>
          )}
          {activeTab === 'expenses' && (
            <div className="flex items-center">
              <Select
                value={expensesGroupBy}
                onValueChange={(v) =>
                  setExpensesGroupBy(v as 'category' | 'type')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">By Category</SelectItem>
                  <SelectItem value="type">By Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="products" className="space-y-4">
          <ProductsSection
            data={productsReport.data}
            colors={chartColors}
            organizationName={currentOrganization?.name}
            dateRange={productsDateApplied}
            productsDateDraft={productsDateDraft}
            setProductsDateDraft={setProductsDateDraft}
            setProductsDateApplied={setProductsDateApplied}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <InventorySection data={inventoryReport.data} />
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <SalesSection
            data={salesReport.data}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <OrdersSection data={ordersReport.data} />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <ExpensesSection
            data={expensesReport.data}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <CustomersSection
            data={customersReport.data}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <SuppliersSection data={suppliersReport.data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
