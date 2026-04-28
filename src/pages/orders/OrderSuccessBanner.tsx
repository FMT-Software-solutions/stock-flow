import { ReceiptDialog } from "@/components/orders/ReceiptDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCurrency } from "@/hooks/useCurrency";
import { useOrder } from "@/hooks/useOrders";
import { QuickSmsDialog } from "@/shared-packages/communication";
import { differenceInMinutes, formatDistanceToNow } from "date-fns";
import { CheckCircle2, MessageSquare, Printer } from "lucide-react";
import { useEffect, useState } from "react";

export function OrderSuccessBanner({ orderId, wasSmsSent, onExpire }: { orderId: string, wasSmsSent: boolean, onExpire: () => void }) {
    const { data: order } = useOrder(orderId);
    const [showReceipt, setShowReceipt] = useState(false);
    const [showSms, setShowSms] = useState(false);
    const [, setTick] = useState(0);
    const { formatCurrency } = useCurrency();
    const { currentOrganization } = useOrganization();

    useEffect(() => {
        if (!order) return;

        const orderDate = new Date(order.created_at || order.date);

        const checkExpiration = () => {
            if (differenceInMinutes(new Date(), orderDate) >= 30) {
                onExpire();
            } else {
                setTick(t => t + 1);
            }
        };

        // Check initially
        checkExpiration();

        // Check every minute
        const intervalId = setInterval(checkExpiration, 60000);
        return () => clearInterval(intervalId);
    }, [order, onExpire]);

    if (!order) return null;

    const orderDate = new Date(order.created_at || order.date);
    const timeAgo = formatDistanceToNow(orderDate, { addSuffix: true });

    const defaultMessage = order.customer ? `Dear ${order.customer.first_name || 'Customer'}, your order #${order.order_number} for ${formatCurrency(order.total_amount)} has been confirmed by ${currentOrganization?.name || 'us'}. Thank you for your business!` : '';

    return (
        <>
            <Alert className="mb-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 relative">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-800 dark:text-green-300 font-semibold flex items-center gap-2">
                    Sale Recorded Successfully
                    <span className="text-xs font-normal text-green-700 dark:text-green-400">({timeAgo})</span>
                </AlertTitle>
                <AlertDescription className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
                    <span className="flex-1">Order #{order.order_number} has been created and saved.</span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700 dark:hover:bg-green-800"
                            onClick={() => setShowReceipt(true)}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Print Receipt
                        </Button>
                        {order.customer && !wasSmsSent && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="bg-white hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700 dark:hover:bg-green-800"
                                onClick={() => setShowSms(true)}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Send SMS
                            </Button>
                        )}
                    </div>
                </AlertDescription>
            </Alert>

            <ReceiptDialog
                open={showReceipt}
                onOpenChange={setShowReceipt}
                order={order}
            />

            {order.customer && (
                <QuickSmsDialog
                    isOpen={showSms}
                    onOpenChange={setShowSms}
                    recipientName={`${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()}
                    recipientPhone={order.customer.phone}
                    defaultMessage={defaultMessage}
                    metadata={{ orderId: order.id }}
                />
            )}
        </>
    );
}