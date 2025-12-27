import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { formatDistanceToNow } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export function RecentOrders() {
    const { currentOrganization } = useOrganization();
    const { selectedBranchIds } = useBranchContext();
    const { formatCurrency } = useCurrency();
    const { data: orders = [], isLoading } = useOrders(currentOrganization?.id, selectedBranchIds);

    // Filter to top 5 recent orders
    const recentOrders = orders.slice(0, 5);

    if (isLoading) {
        return <div className="animate-pulse h-40 bg-muted rounded-md" />;
    }

    if (recentOrders.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No recent orders found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between space-x-4 border-b pb-4 last:border-0 last:pb-0">
                        <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                                <Link to={`/orders/${order.id}`} className="hover:underline">
                                    {order.order_number}
                                </Link>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 'Guest'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(order.date), { addSuffix: true })}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                             <div className="font-bold text-sm">{formatCurrency(order.total_amount)}</div>
                             <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize">
                                {order.status}
                             </Badge>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
