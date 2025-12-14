import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Truck,
  FileText,
  Box,
  Users,
  TrendingUp,
  TrendingDown,
  ClipboardList,
} from 'lucide-react';
import { mockProducts } from '@/data/mock-inventory';
import { mockOrders } from '@/data/mock-orders';
import { mockCustomers } from '@/data/mock-customers';
import { Area, AreaChart } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';

// Mock data for charts
const revenueData = [
  { month: 'Jan', value: 1200 },
  { month: 'Feb', value: 2100 },
  { month: 'Mar', value: 1800 },
  { month: 'Apr', value: 2400 },
  { month: 'May', value: 3200 },
  { month: 'Jun', value: 3600 },
];

const expensesData = [
  { month: 'Jan', value: 800 },
  { month: 'Feb', value: 1200 },
  { month: 'Mar', value: 1100 },
  { month: 'Apr', value: 1400 },
  { month: 'May', value: 1800 },
  { month: 'Jun', value: 2100 },
];

const customersData = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 120 },
  { month: 'Mar', value: 150 },
  { month: 'Apr', value: 180 },
  { month: 'May', value: 220 },
  { month: 'Jun', value: 280 },
];

const ordersData = [
  { month: 'Jan', value: 40 },
  { month: 'Feb', value: 65 },
  { month: 'Mar', value: 55 },
  { month: 'Apr', value: 80 },
  { month: 'May', value: 95 },
  { month: 'Jun', value: 120 },
];

// Helper component for Metric Cards
function MetricCard({
  title,
  value,
  trend,
  data,
  colorClass,
  icon: Icon,
}: any) {
  // Map colorClass to actual color values for the chart
  const colorMap: Record<string, string> = {
    orange: 'hsl(var(--chart-1))',
    blue: 'hsl(var(--chart-2))',
    green: 'hsl(var(--chart-3))',
    purple: 'hsl(var(--chart-4))',
  };

  const chartColor = colorMap[colorClass] || 'hsl(var(--primary))';

  const chartConfig = {
    value: {
      label: title,
      color: chartColor,
    },
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div
              className={`p-2 w-fit rounded-md bg-${colorClass}-100 dark:bg-${colorClass}-900/20 text-${colorClass}-600 dark:text-${colorClass}-400`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="flex items-center text-xs font-medium text-green-600 dark:text-green-400">
              <TrendingUp className="mr-1 h-3 w-3" />
              {trend}
            </div>
          </div>
          <div className="h-[60px] w-[100px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id={`fill${title.replace(/\s/g, '')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={chartColor}
                      stopOpacity={0.3}
                    />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="value"
                  type="natural"
                  fill={`url(#fill${title.replace(/\s/g, '')})`}
                  stroke={chartColor}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sales Activity Card Component
function SalesActivityCard({ value, label, icon: Icon, color }: any) {
  return (
    <Card className="relative overflow-hidden shadow-none bg-card text-card-foreground">
      <CardContent className="px-6 flex flex-col items-center justify-center text-center space-y-2">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="flex items-center gap-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className={`h-4 w-4 ${color}`} />
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { formatCurrency } = useCurrency();
  // Calculations
  const totalProducts = mockProducts.reduce((acc, p) => acc + p.quantity, 0);

  const lowStockCount = mockProducts.filter(
    (p) => p.quantity <= p.minStockLevel
  ).length;
  const lowStockItems = mockProducts
    .filter((p) => p.quantity <= p.minStockLevel)
    .slice(0, 3);

  const totalRevenue = mockOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  // Mock counts for Sales Activity
  const toPacked =
    mockOrders.filter((o) => o.status === 'processing').length + 3000; // Mock +3000 for visuals
  const toShipped = 12; // Mock
  const toDelivered = 21; // Mock
  const toInvoiced = 101; // Mock

  return (
    <div className="space-y-8">
      {/* Sales Activity & Inventory Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Activity */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Sales Activity
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SalesActivityCard
              value={toPacked}
              label="TO BE PACKED"
              icon={Box}
              color="text-orange-500"
            />
            <SalesActivityCard
              value={toShipped}
              label="TO BE SHIPPED"
              icon={Truck}
              color="text-orange-400"
            />
            <SalesActivityCard
              value={toDelivered}
              label="TO BE DELIVERED"
              icon={Truck}
              color="text-green-500"
            />
            <SalesActivityCard
              value={toInvoiced}
              label="TO BE INVOICED"
              icon={FileText}
              color="text-yellow-500"
            />
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Inventory Summary
          </h2>
          <Card className="shadow-none">
            <CardContent className="px-6 flex flex-col justify-center space-y-4 py-0">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                In Quantity
              </div>

              <div className="border rounded-lg px-4 py-1 shadow-sm flex justify-between items-center">
                <span className="font-semibold text-muted-foreground">
                  In-stock
                </span>
                <span className="text-lg font-bold text-foreground">
                  {totalProducts}
                </span>
              </div>

              <div className="border rounded-lg px-4 py-1 shadow-sm flex justify-between items-center">
                <span className="font-semibold text-muted-foreground">
                  Re-stock
                </span>
                <span className="text-lg font-bold text-red-500">
                  {lowStockCount}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          trend="25%"
          data={revenueData}
          colorClass="orange"
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(6569)}
          trend="25%"
          data={expensesData}
          colorClass="blue"
          icon={TrendingDown}
        />
        <MetricCard
          title="Total Customer"
          value={mockCustomers.length.toString()}
          trend="25%"
          data={customersData}
          colorClass="orange"
          icon={Users}
        />
        <MetricCard
          title="Total Order"
          value={mockOrders.length.toString()}
          trend="25%"
          data={ordersData}
          colorClass="green"
          icon={ClipboardList}
        />
      </div>

      {/* Bottom Section: Inventory, Top Selling, Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Low Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold">Inventory</CardTitle>
            <Link
              to="/inventory"
              className="text-xs text-muted-foreground hover:underline"
            >
              view all &gt;&gt;
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-muted-foreground italic">
                Low in stock
              </span>
              <span className="font-bold">{lowStockCount} items</span>
            </div>

            {lowStockCount > 0 && (
              <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs px-3 py-2 rounded-md mb-4 text-center italic">
                This item is low of stock, please order it soon!
              </div>
            )}

            <div className="space-y-4">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Available: {item.quantity}
                    </div>
                  </div>
                  <Button
                    variant="link"
                    className="text-blue-500 h-auto p-0 text-xs"
                  >
                    Order now &gt;&gt;
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Selling */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold">Top Selling</CardTitle>
            <span className="text-xs text-muted-foreground italic">
              This month ▼
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground mb-3 border-b pb-2">
              <div className="col-span-3">Name</div>
              <div className="col-span-1">Sold</div>
              <div className="col-span-2">Price</div>
            </div>
            <div className="space-y-3">
              {mockProducts.slice(0, 4).map((product, i) => (
                <div
                  key={product.id}
                  className="grid grid-cols-6 gap-2 text-sm items-center"
                >
                  <div className="col-span-3 truncate font-medium">
                    {product.name}
                  </div>
                  <div className="col-span-1 text-muted-foreground">
                    {100 - i * 15}
                  </div>
                  <div className="col-span-2 font-medium">
                    <CurrencyDisplay amount={product.sellingPrice} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold">Recent orders</CardTitle>
            <Link
              to="/orders"
              className="text-xs text-muted-foreground hover:underline"
            >
              view all &gt;&gt;
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center">
                    <Box className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-sm truncate">
                        {order.items[0]?.productName || 'Product'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-muted-foreground">
                        Order id: {order.orderNumber}
                      </div>
                      <Badge
                        variant={
                          order.status === 'completed' ? 'default' : 'secondary'
                        }
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
