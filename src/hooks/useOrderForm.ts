import { useMemo } from 'react';
import { useOrder } from '@/hooks/useOrders';
import { untrackedLineKey } from '@/lib/saleLines';
import { type OrderFormValues, PERSIST_KEYS } from '@/pages/orders/form-schema/order-form-schema';

export interface UseOrderFormProps {
  id?: string;
}

export const useOrderForm = ({ id }: UseOrderFormProps) => {
  const isEditing = !!id;

  const { data: order, isLoading: isLoadingOrder } = useOrder(id);

  const isLoading = isEditing ? isLoadingOrder : false;

  const defaultValues = useMemo((): OrderFormValues => {
    if (isEditing && order) {
      // Format items for the form
      const formattedItems =
        order.items?.map((item) => ({
          // Lines of products that don't track stock have no inventory row.
          inventoryId:
            item.inventory_id || (item.product_id ? untrackedLineKey(item.product_id, item.variant_id) : ''),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          originalPrice: item.original_price != null ? Number(item.original_price) : Number(item.unit_price),
          productName: item.product_name,
        })) || [];

      return {
        branchId: order.branch_id || '',
        customerId: order.customer_id || '',
        status: (order.status as string)?.toLowerCase() as any,
        paymentStatus: (order.payment_status as string)?.toLowerCase() as any,
        paymentMethod: (order.payment_method as string)?.toLowerCase() as any || 'cash',
        notes: order.notes || '',
        paidAmount: order.paid_amount,
        // The sale keeps its discounts unless the cashier removes them.
        discountCodes: (order.discounts ?? []).filter((d) => d.kind === 'code' && d.code).map((d) => d.code as string),
        skippedDiscountIds: [],
        manualDiscount: (() => {
          const manual = order.discounts?.find((d) => d.kind === 'manual');
          return manual
            ? {
                valueType: manual.value_type === 'percentage' ? ('percentage' as const) : ('fixed_amount' as const),
                value: Number(manual.value),
                reason: manual.reason ?? undefined,
              }
            : null;
        })(),
        items:
          formattedItems.length > 0
            ? formattedItems
            : [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
      };
    }

    // Default values for new order
    const branch = sessionStorage.getItem(PERSIST_KEYS.BRANCH);
    const status = sessionStorage.getItem(PERSIST_KEYS.STATUS);
    const paymentStatus = sessionStorage.getItem(PERSIST_KEYS.PAYMENT_STATUS);
    const paymentMethod = sessionStorage.getItem(PERSIST_KEYS.PAYMENT_METHOD);

    return {
      branchId: branch || '',
      customerId: '',
      status: (status as any) || 'completed',
      paymentStatus: (paymentStatus as any) || 'paid',
      paymentMethod: (paymentMethod as any) || 'cash',
      notes: '',
      items: [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
    };
  }, [order, isEditing]);

  return {
    isLoading,
    order,
    defaultValues,
  };
};
