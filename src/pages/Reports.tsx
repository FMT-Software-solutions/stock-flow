import { BranchMultiSelector } from '@/components/shared/BranchMultiSelector';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
import { ProductsSection } from './reports/ProductsSection';
import { SalesSection } from './reports/SalesSection';
import { SuppliersSection } from './reports/SuppliersSection';

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
  total_revenue?: number;
  inventory_value_by_category?: { category: string; value: number }[];
  low_stock_list?: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
  out_of_stock_list?: {
    id: string;
    name: string;
    sku: string | null;
    category_name: string | null;
    quantity: number;
    min_stock_level: number;
  }[];
};

type CustomersReport = {
  total_customers: number;
  new_this_month: number;
  top_customers: {
    customer_id: string;
    name: string;
    total_spent: number;
    orders_count: number;
  }[];
  customers_owing: {
    customer_id: string;
    name: string;
    total_owing: number;
    open_orders: number;
    last_owing_date: string | null;
  }[];
};

type SuppliersReport = {
  total_suppliers: number;
  new_this_month: number;
  new_suppliers: { id: string; name: string; created_at: string }[];
  top_suppliers: { supplier_id: string; name: string; product_count: number }[];
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
    | 'sales_orders'
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
  const [inventoryDateDraft, setInventoryDateDraft] = useState<
    DateRange | undefined
  >(undefined);
  const [inventoryDateApplied, setInventoryDateApplied] = useState<
    DateRange | undefined
  >(undefined);
  const [customersDateDraft, setCustomersDateDraft] = useState<
    DateRange | undefined
  >(undefined);
  const [customersDateApplied, setCustomersDateApplied] = useState<
    DateRange | undefined
  >(undefined);
  const [branchIds, setBranchIds] = useState<string[]>(globalBranchIds);
  const [template, setTemplate] = useState<'detailed' | 'pivot' | 'summary'>(
    'detailed'
  );
  const [expensesGroupBy, setExpensesGroupBy] = useState<'category' | 'type'>(
    'category'
  );
  const [exportOpen, setExportOpen] = useState(false);

  const orgId = currentOrganization?.id;

  const normalizedBranchIds = useMemo(() => {
    return branchIds && branchIds.length > 0 ? branchIds : null;
  }, [branchIds]);

  const productsStartIso = productsDateApplied?.from
    ? new Date(productsDateApplied.from).toISOString()
    : null;
  const productsEndIso = productsDateApplied?.to
    ? new Date(productsDateApplied.to).toISOString()
    : null;
  const inventoryStartIso = inventoryDateApplied?.from
    ? new Date(inventoryDateApplied.from).toISOString()
    : null;
  const inventoryEndIso = inventoryDateApplied?.to
    ? new Date(inventoryDateApplied.to).toISOString()
    : null;
  const customersStartIso = customersDateApplied?.from
    ? new Date(customersDateApplied.from).toISOString()
    : null;
  const customersEndIso = customersDateApplied?.to
    ? new Date(customersDateApplied.to).toISOString()
    : null;

  const isBranchScoped = (tab: typeof activeTab) => {
    return tab === 'inventory' || tab === 'sales_orders' || tab === 'expenses';
  };

  const hasGeneralFilters = (tab: typeof activeTab) => {
    return tab === 'sales_orders' || tab === 'expenses';
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
      inventoryStartIso,
      inventoryEndIso,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_report', {
        p_organization_id: orgId,
        p_branch_ids: normalizedBranchIds,
        p_start_date: inventoryStartIso,
        p_end_date: inventoryEndIso,
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
        total_revenue: 0,
        inventory_value_by_category: [],
        low_stock_list: [],
        out_of_stock_list: [],
      },
  });

  const customersReport = useQuery({
    queryKey: [
      'reports',
      'customers',
      orgId,
      customersStartIso,
      customersEndIso,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customers_report', {
        p_organization_id: orgId,
        p_start_date: customersStartIso,
        p_end_date: customersEndIso,
      });
      if (error) throw error;
      return data as CustomersReport;
    },
    enabled: !!orgId && activeTab === 'customers',
    placeholderData: (prev) =>
      prev ?? {
        total_customers: 0,
        new_this_month: 0,
        top_customers: [],
        customers_owing: [],
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
        new_this_month: 0,
        new_suppliers: [],
        top_suppliers: [],
      },
  });

  const periodLabel = useMemo(() => {
    const range =
      activeTab === 'products'
        ? productsDateApplied
        : activeTab === 'inventory'
        ? inventoryDateApplied
        : activeTab === 'customers'
        ? customersDateApplied
        : generalDateRange;
    if (!range?.from && !range?.to) return 'All Time';
    const from = range?.from ? format(range.from, 'MMMM dd, yyyy') : 'Start';
    const to = range?.to ? format(range.to, 'MMMM dd, yyyy') : 'Today';
    return `${from} — ${to}`;
  }, [
    activeTab,
    productsDateApplied,
    inventoryDateApplied,
    customersDateApplied,
    generalDateRange,
  ]);

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
        onValueChange={(v) => {
          setActiveTab(v as typeof activeTab);
          setExportOpen(false);
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="sales_orders">Sales & Orders</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            Export
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {hasGeneralFilters(activeTab) && (
              <DatePickerWithRange
                date={generalDateRange}
                setDate={setGeneralDateRange}
                placeholder="Select date range"
                className="w-full"
              />
            )}
          </div>
          {hasGeneralFilters(activeTab) && (
            <div className="flex items-center gap-2">
              <Select
                value={template}
                onValueChange={(v) =>
                  setTemplate(v as 'detailed' | 'pivot' | 'summary')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="pivot">Pivot</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isBranchScoped(activeTab) && activeTab !== 'inventory' && (
            <div className="flex items-center">
              <BranchMultiSelector
                value={branchIds}
                onChange={setBranchIds}
                placeholder="Select branches"
              />
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
            exportOpen={exportOpen && activeTab === 'products'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <InventorySection
            data={inventoryReport.data}
            branchIds={branchIds}
            setBranchIds={setBranchIds}
            inventoryDateDraft={inventoryDateDraft}
            setInventoryDateDraft={setInventoryDateDraft}
            inventoryDateApplied={inventoryDateApplied}
            setInventoryDateApplied={setInventoryDateApplied}
            organizationName={currentOrganization?.name}
            exportOpen={exportOpen && activeTab === 'inventory'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>

        <TabsContent value="sales_orders" className="space-y-4">
          <SalesSection
            orgId={orgId}
            branchIds={branchIds}
            dateRange={generalDateRange}
            template={template}
            exportOpen={exportOpen && activeTab === 'sales_orders'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <ExpensesSection
            orgId={orgId}
            branchIds={branchIds}
            dateRange={generalDateRange}
            template={template}
            groupBy={expensesGroupBy}
            setGroupBy={setExpensesGroupBy}
            exportOpen={exportOpen && activeTab === 'expenses'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <CustomersSection
            data={customersReport.data}
            formatCurrency={formatCurrency}
            organizationName={currentOrganization?.name}
            dateRange={customersDateApplied}
            customersDateDraft={customersDateDraft}
            setCustomersDateDraft={setCustomersDateDraft}
            setCustomersDateApplied={setCustomersDateApplied}
            exportOpen={exportOpen && activeTab === 'customers'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <SuppliersSection
            data={suppliersReport.data}
            organizationName={currentOrganization?.name}
            exportOpen={exportOpen && activeTab === 'suppliers'}
            onExportClose={() => setExportOpen(false)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
