import { useMemo } from 'react';
import { useOrder } from '@/hooks/useOrders';
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
          inventoryId: item.inventory_id || '',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          productName: item.product_name,
        })) || [];

      return {
        branchId: order.branch_id || '',
        customerId: order.customer_id || '',
        status: (order.status as string)?.toLowerCase() as any,
        paymentStatus: (order.payment_status as string)?.toLowerCase() as any,
        paymentMethod: (order.payment_method as string)?.toLowerCase() as any || 'cash',
        notes: order.notes || '',
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
      status: (status as any) || 'pending',
      paymentStatus: (paymentStatus as any) || 'unpaid',
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
