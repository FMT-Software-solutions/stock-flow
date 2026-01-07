import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Box,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/hooks/useCurrency';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useDashboardStats,
  type InventoryStats,
  type ProductStats,
  type SalesStats,
  type ExpenseStats,
  type CustomerStats,
  type SupplierStats,
  type UserStats,
  type BranchStats,
  type TrendData,
} from '@/hooks/useDashboardStats';
import type { StatsGroup } from '@/types/stats';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useProducts, useInventoryEntries } from '@/hooks/useInventoryQueries';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

// --- Types ---
type SectionId = 
  | 'inventory'
  | 'products'
  | 'sales'
  | 'expenses'
  | 'customers'
  | 'suppliers'
  | 'users'
  | 'branches'
  | 'low_stock';

interface DashboardSection {
  id: SectionId;
  label: string;
}

const ALL_SECTIONS: DashboardSection[] = [
  { id: 'inventory', label: 'Inventory Stats' },
  { id: 'products', label: 'Product Stats' },
  { id: 'sales', label: 'Sales & Orders' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'customers', label: 'Customers' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'users', label: 'Users' },
  { id: 'branches', label: 'Branches' },
  { id: 'low_stock', label: 'Low Stock Items' },
];

function ChartSection({
  data,
  dataKey,
  color,
  type = 'area',
  currency = false,
  formatCurrency,
}: {
  data: TrendData[];
  dataKey: string;
  color: string;
  type?: 'area' | 'bar';
  currency?: boolean;
  formatCurrency?: (val: number) => string;
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-50 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fontSize: 12 }} 
              minTickGap={30}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => currency && formatCurrency ? formatCurrency(val) : val}
            />
            <Tooltip 
              formatter={(val: number) => currency && formatCurrency ? formatCurrency(val) : val}
              labelStyle={{ color: 'black' }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fillOpacity={1}
              fill={`url(#color-${dataKey})`}
            />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fontSize: 12 }} 
              minTickGap={30}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => currency && formatCurrency ? formatCurrency(val) : val}
            />
            <Tooltip 
               formatter={(val: number) => currency && formatCurrency ? formatCurrency(val) : val}
               cursor={{ fill: 'transparent' }}
               labelStyle={{ color: 'black' }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Wrapper for a Dashboard Card Section
function DashboardMetricCard<TData>({
  title,
  groups,
  data,
  dateRange,
  setDateRange,
  chart,
  className,
  loading,
}: {
  title: string;
  groups: StatsGroup<TData>[];
  data: TData[];
  dateRange?: DateRange;
  setDateRange?: (range: DateRange | undefined) => void;
  chart?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <Card className={cn('flex flex-col', loading && 'opacity-60', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {setDateRange && (
          <DatePickerWithRange 
            date={dateRange} 
            setDate={setDateRange} 
            disabled={!!loading}
            className="w-auto [&>button]:w-60 [&>button]:h-8 [&>button]:text-xs" 
          />
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <div className={cn('grid gap-4', loading && 'pointer-events-none')}>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-4">
             {groups.map((group) => (
                <div key={group.id} className="grid grid-cols-2 gap-4">
                   {group.fields.map(field => {
                      const result = field.calculate(data);
                      const Icon = field.icon;
                      return (
                        <div key={field.id} className="flex flex-col space-y-1">
                           <span className="text-xs text-muted-foreground flex items-center gap-1">
                             {Icon && <Icon className="h-3 w-3" />}
                             {field.label}
                           </span>
                           <div className="flex items-baseline gap-2">
                             <span className={cn("text-xl font-bold", field.className)}>
                               {result.value}
                             </span>
                             {result.subValue && (
                               <span className="text-xs text-muted-foreground">
                                 {result.subValue}
                               </span>
                             )}
                           </div>
                           {result.trendValue && (
                             <span className={cn(
                               "text-xs font-medium",
                               result.trend === 'up' ? "text-green-600" : 
                               result.trend === 'down' ? "text-red-600" : "text-muted-foreground"
                             )}>
                               {result.trendValue}
                             </span>
                           )}
                        </div>
                      )
                   })}
                </div>
             ))}
          </div>
          {/* Chart Section */}
          {chart}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { currentOrganization } = useOrganization();
  const { formatCurrency } = useCurrency();
  const { selectedBranchIds } = useBranchContext();
  
  // --- State ---
  const [salesDateRange, setSalesDateRange] = useState<DateRange | undefined>(undefined);
  const [expensesDateRange, setExpensesDateRange] = useState<DateRange | undefined>(undefined);
  const [customersDateRange, setCustomersDateRange] = useState<DateRange | undefined>(undefined);
  
  // Visibility State
  const [visibleSections, setVisibleSections] = useLocalStorage<SectionId[]>(
    'dashboard-visible-sections',
    ALL_SECTIONS.map(s => s.id)
  );

  // --- Queries ---
  const stats = useDashboardStats({
    organizationId: currentOrganization?.id,
    branchIds: selectedBranchIds,
    salesDateRange,
    expensesDateRange,
    customersDateRange,
  });

  // Low stock query
  const { data: allProducts = [] } = useProducts(currentOrganization?.id);
  const { data: inventoryEntries = [] } = useInventoryEntries(currentOrganization?.id, selectedBranchIds, true);
  
  const lowStockProducts = useMemo(() => {
    return allProducts
      .filter(p => {
        const threshold = Number(p.minStockLevel ?? 0);
        return p.quantity <= 0 || p.quantity <= threshold;
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [allProducts]);
  
  const lowStockInventories = useMemo(() => {
    return inventoryEntries
      .filter(i => {
        const threshold = Number(i.minStockLevel ?? 0);
        return i.quantity <= 0 || i.quantity <= threshold;
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventoryEntries]);

  // --- Stats Groups Definitions ---

  const inventoryGroups: StatsGroup<InventoryStats>[] = [
    {
      id: 'inventory-main',
      title: 'Inventory Overview',
      fields: [
        {
          id: 'total_items',
          label: 'Total Items',
          calculate: (data) => ({ value: data[0]?.total_items ?? 0 }),
        },
        {
          id: 'low_stock',
          label: 'Low Stock',
          calculate: (data) => ({ 
            value: data[0]?.low_stock_items ?? 0,
            trend: (data[0]?.low_stock_items ?? 0) > 0 ? 'down' : 'neutral',
            trendValue: (data[0]?.low_stock_items ?? 0) > 0 ? 'Action needed' : undefined
          }),
          className: 'text-orange-500',
        },
        {
          id: 'out_of_stock',
          label: 'Out of Stock',
          calculate: (data) => ({ 
            value: data[0]?.out_of_stock_items ?? 0,
            trend: (data[0]?.out_of_stock_items ?? 0) > 0 ? 'down' : 'neutral',
            trendValue: (data[0]?.out_of_stock_items ?? 0) > 0 ? 'Critical' : undefined
          }),
          className: 'text-red-500',
        },
      ],
    },
  ];

  const productGroups: StatsGroup<ProductStats>[] = [
    {
      id: 'products-main',
      title: 'Product Catalog',
      fields: [
        {
          id: 'total',
          label: 'Total Products',
          calculate: (data) => ({ value: data[0]?.total_products ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_products ?? 0 }),
        },
        {
          id: 'top_cat',
          label: 'Top Category',
          calculate: (data) => ({ 
            value: data[0]?.top_categories?.[0]?.category ?? '-',
            subValue: data[0]?.top_categories?.[0] ? `${data[0].top_categories[0].count} items` : undefined
          }),
        },
      ],
    },
  ];

  const salesGroups: StatsGroup<SalesStats>[] = [
    {
      id: 'sales-main',
      title: 'Sales & Revenue',
      fields: [
        {
          id: 'revenue',
          label: 'Total Revenue',
          calculate: (data) => ({ value: formatCurrency(data[0]?.total_revenue ?? 0) }),
          className: 'text-green-600',
        },
        {
          id: 'owings',
          label: 'Owings',
          calculate: (data) => ({ value: formatCurrency(data[0]?.owings ?? 0) }),
          className: 'text-amber-600',
        },
        {
          id: 'refunds',
          label: 'Refunds',
          calculate: (data) => ({ value: formatCurrency(data[0]?.refunds ?? 0) }),
          className: 'text-red-600',
        },
        {
          id: 'orders',
          label: 'Total Orders',
          calculate: (data) => ({ value: data[0]?.total_orders ?? 0 }),
        },
        {
          id: 'completed',
          label: 'Completed',
          calculate: (data) => ({ value: data[0]?.breakdown?.completed ?? 0 }),
        },
        {
          id: 'pending',
          label: 'Pending',
          calculate: (data) => ({ value: data[0]?.breakdown?.pending ?? 0 }),
        },
      ],
    },
  ];

  const expenseGroups: StatsGroup<ExpenseStats>[] = [
    {
      id: 'expenses-main',
      title: 'Expenditure',
      fields: [
        {
          id: 'total_exp',
          label: 'Total Expenses',
          calculate: (data) => ({ value: formatCurrency(data[0]?.total_expenditure ?? 0) }),
          className: 'text-red-600',
        },
        {
          id: 'records',
          label: 'Records',
          calculate: (data) => ({ value: data[0]?.total_records ?? 0 }),
        },
        {
          id: 'top_cat',
          label: 'Top Category',
          calculate: (data) => ({ 
            value: data[0]?.top_category?.category ?? '-',
            subValue: data[0]?.top_category ? formatCurrency(data[0].top_category.amount) : undefined
          }),
        },
      ],
    },
  ];

  const customerGroups: StatsGroup<CustomerStats>[] = [
    {
      id: 'customers-main',
      title: 'Customers',
      fields: [
        {
          id: 'total',
          label: 'Total Customers',
          calculate: (data) => ({ value: data[0]?.total_customers ?? 0 }),
        },
        {
          id: 'new',
          label: 'New (Period)',
          calculate: (data) => ({ value: data[0]?.new_this_period ?? 0 }),
          className: 'text-blue-500',
        },
      ],
    },
  ];

  const supplierGroups: StatsGroup<SupplierStats>[] = [
    {
      id: 'suppliers-main',
      title: 'Suppliers',
      fields: [
        {
          id: 'total',
          label: 'Total Suppliers',
          calculate: (data) => ({ value: data[0]?.total_suppliers ?? 0 }),
        },
      ],
    },
  ];

  const userGroups: StatsGroup<UserStats>[] = [
    {
      id: 'users-main',
      title: 'Users',
      fields: [
        {
          id: 'total',
          label: 'Total Users',
          calculate: (data) => ({ value: data[0]?.total_users ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_users ?? 0 }),
          className: 'text-green-600',
        },
        {
          id: 'inactive',
          label: 'Inactive',
          calculate: (data) => ({ value: data[0]?.inactive_users ?? 0 }),
          className: 'text-gray-500',
        },
      ],
    },
  ];

  const branchGroups: StatsGroup<BranchStats>[] = [
    {
      id: 'branches-main',
      title: 'Branches',
      fields: [
        {
          id: 'total',
          label: 'Total Branches',
          calculate: (data) => ({ value: data[0]?.total_branches ?? 0 }),
        },
        {
          id: 'active',
          label: 'Active',
          calculate: (data) => ({ value: data[0]?.active_branches ?? 0 }),
          className: 'text-green-600',
        },
      ],
    },
  ];

  const toggleSection = (id: SectionId) => {
    setVisibleSections(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your organization's performance.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Customize Dashboard">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible Sections</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_SECTIONS.map((section) => (
                <DropdownMenuCheckboxItem
                  key={section.id}
                  checked={visibleSections.includes(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                >
                  {section.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Row 1: Sales & Expenses */}
        {visibleSections.includes('sales') && (
           <DashboardMetricCard 
             title="Sales"
             className="lg:col-span-2"
             groups={salesGroups}
             data={stats.sales.data ? [stats.sales.data] : ([] as SalesStats[])}
             dateRange={salesDateRange}
             setDateRange={setSalesDateRange}
             loading={stats.sales.isFetching}
             chart={
               <ChartSection
                  data={(stats.sales.data?.trend ?? []) as TrendData[]}
                  dataKey="value"
                  color="#16a34a"
                  currency
                  formatCurrency={formatCurrency}
               />
             }
           />
        )}

        {visibleSections.includes('expenses') && (
           <DashboardMetricCard 
             title="Expenses"
             className="lg:col-span-2"
             groups={expenseGroups}
             data={stats.expenses.data ? [stats.expenses.data] : ([] as ExpenseStats[])}
             dateRange={expensesDateRange}
             setDateRange={setExpensesDateRange}
             loading={stats.expenses.isFetching}
             chart={
               <ChartSection
                  data={(stats.expenses.data?.trend ?? []) as TrendData[]}
                  dataKey="value"
                  color="#dc2626"
                  currency
                  formatCurrency={formatCurrency}
               />
             }
           />
        )}

        {/* Row 2: Customers & Low Stock */}
        {visibleSections.includes('customers') && (
           <DashboardMetricCard 
             title="Customers"
             className="lg:col-span-2"
             groups={customerGroups}
             data={stats.customers.data ? [stats.customers.data] : ([] as CustomerStats[])}
             dateRange={customersDateRange}
             setDateRange={setCustomersDateRange}
             loading={stats.customers.isFetching}
             chart={
               <ChartSection
                  data={(stats.customers.data?.trend ?? []) as TrendData[]}
                  dataKey="value"
                  color="#3b82f6"
                  type="bar"
               />
             }
           />
        )}

        {visibleSections.includes('low_stock') && (
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base font-medium">Low Stock</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                <Link to="/inventory">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-75">
              <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="inventory">Inventory ({lowStockInventories.length})</TabsTrigger>
                  <TabsTrigger value="products">Products ({lowStockProducts.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="products">
                  {lowStockProducts.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      No low stock products. Great job!
                    </div>
                  ) : (
                    <ScrollArea className="h-75 pr-4">
                      <div className="space-y-4">
                        {lowStockProducts.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex items-start gap-3">
                              {item.imageUrl ? (
                                 <img 
                                   src={item.imageUrl} 
                                   alt={item.name} 
                                   className="h-10 w-10 rounded-md object-cover"
                                 />
                              ) : (
                                 <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                   <Box className="h-5 w-5 text-muted-foreground" />
                                 </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  SKU: {item.sku || '-'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">Available</div>
                                <div className={`text-sm font-bold ${item.quantity <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                  {item.quantity} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                 <Link to={`/inventory/${item.id}`}>Restock</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
                
                <TabsContent value="inventory">
                  {lowStockInventories.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      No low stock inventory entries. Great job!
                    </div>
                  ) : (
                    <ScrollArea className="h-75 pr-4">
                      <div className="space-y-4">
                        {lowStockInventories.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                          >
                            <div className="flex items-start gap-3">
                              {inv.imageUrl || inv.productImage ? (
                                 <img 
                                   src={inv.imageUrl || inv.productImage!} 
                                   alt={inv.productName} 
                                   className="h-10 w-10 rounded-md object-cover"
                                 />
                              ) : (
                                 <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                                   <Box className="h-5 w-5 text-muted-foreground" />
                                 </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">{inv.productName}</div>
                                <div className="text-xs text-muted-foreground">
                                  SKU: {inv.sku || '-'} • {inv.branchName || 'Org-wide'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">Available</div>
                                <div className={`text-sm font-bold ${inv.quantity <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                  {inv.quantity} <span className="text-[10px] font-normal text-muted-foreground">{inv.unit || ''}</span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                 <Link to={`/inventory/entry/${inv.id}`}>Restock</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Row 3: Small Stats */}
        {visibleSections.includes('inventory') && (
           <DashboardMetricCard 
             title="Inventory"
             groups={inventoryGroups}
             data={stats.inventory.data ? [stats.inventory.data] : ([] as InventoryStats[])}
             loading={stats.inventory.isFetching}
           />
        )}

        {visibleSections.includes('products') && (
           <DashboardMetricCard 
             title="Products"
             groups={productGroups}
             data={stats.products.data ? [stats.products.data] : ([] as ProductStats[])}
             loading={stats.products.isFetching}
           />
        )}

        {visibleSections.includes('users') && (
           <DashboardMetricCard 
             title="Users"
             groups={userGroups}
             data={stats.users.data ? [stats.users.data] : ([] as UserStats[])}
             loading={stats.users.isFetching}
           />
        )}

        {/* Stacked Small Cards */}
        <div className="flex flex-col gap-6">
           {visibleSections.includes('branches') && (
              <DashboardMetricCard 
                title="Branches"
                groups={branchGroups}
                data={stats.branches.data ? [stats.branches.data] : ([] as BranchStats[])}
                loading={stats.branches.isFetching}
              />
           )}
           {visibleSections.includes('suppliers') && (
              <DashboardMetricCard 
                title="Suppliers"
                groups={supplierGroups}
                data={stats.suppliers.data ? [stats.suppliers.data] : ([] as SupplierStats[])}
                loading={stats.suppliers.isFetching}
              />
           )}
        </div>

      </div>
    </div>
  );
}
