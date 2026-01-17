import { useState, useMemo, useEffect, useCallback } from 'react';
import { useValidInventoryDiscounts, useDiscounts } from './useDiscountQueries';
import type { Discount } from '@/types/discounts';
import { type DiscountOrderItem, validateAndApplyDiscounts, computeDiscountAmount, type AppliedDiscount, getDiscountValidationError } from '@/lib/discount-utils';

export function useOrderDiscounts(
  organizationId: string | undefined,
  branchId: string | undefined,
  orderItems: DiscountOrderItem[],
  customerId: string | undefined
) {
  const [discountCode, setDiscountCode] = useState('');
  const [selectedAutoId, setSelectedAutoId] = useState<string | undefined>(undefined);
  const [manuallyCleared, setManuallyCleared] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | undefined>(undefined);
  const [autoOptions, setAutoOptions] = useState<Discount[]>([]);

  // Queries
  const {
    data: validDiscountRows = [],
    refetch: refetchInventoryDiscounts
  } = useValidInventoryDiscounts(organizationId, branchId ? [branchId] : undefined);

  const {
    data: orgDiscounts = [],
    refetch: refetchOrgDiscounts
  } = useDiscounts(organizationId);

  // Refresh both queries
  const refreshDiscounts = () => {
    refetchInventoryDiscounts();
    refetchOrgDiscounts();
  };

  // Build map of eligible inventory IDs per discount
  const discountEligibleMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const row of validDiscountRows) {
      if (row.discounts) {
        for (const d of row.discounts) {
          if (!map[d.id]) map[d.id] = new Set();
          map[d.id].add(row.inventoryId);
        }
      }
    }
    return map;
  }, [validDiscountRows]);

  // Combine inventory-specific and storewide discounts
  const candidateDiscounts = useMemo(() => {
    const ids = new Set<string>();
    const out: Discount[] = [];
    const selectedIds = new Set(orderItems.map((it) => it.inventoryId));

    // Inventory-specific
    for (const row of validDiscountRows) {
      if (!selectedIds.has(row.inventoryId)) continue;
      for (const d of row.discounts || []) {
        if (!ids.has(d.id)) {
          ids.add(d.id);
          out.push(d);
        }
      }
    }

    // Storewide (targetMode === 'all' or undefined)
    for (const d of orgDiscounts) {
      const isStorewide = !d.targetMode || d.targetMode === 'all';
      if (isStorewide && !ids.has(d.id)) {
        ids.add(d.id);
        out.push(d);
      }
    }
    return out;
  }, [orderItems, validDiscountRows, orgDiscounts]);

  // Validate and Apply Logic
  useEffect(() => {
    if (!organizationId) return;
    if (orderItems.length === 0) {
      setAppliedDiscount(undefined);
      return;
    }

    const result = validateAndApplyDiscounts({
      discounts: candidateDiscounts,
      items: orderItems,
      branchId: branchId,
      customerId: customerId || undefined,
      code: discountCode || undefined,
      selectedAutoId,
      eligibleInventoryByDiscount: discountEligibleMap,
    });

    // Logic to prevent auto-reapplication if manually cleared
    let finalApplied = result.applied;
    if (manuallyCleared && !discountCode && !selectedAutoId) {
      if (finalApplied && (finalApplied.discount.usageMode ?? 'manual') === 'automatic' && finalApplied.discount.id !== selectedAutoId) {
        finalApplied = undefined;
      }
    }
    setAppliedDiscount(finalApplied);

    const autos = result.applicable
      .filter((d) => (d.usageMode ?? 'manual') === 'automatic')
      .filter((d) => computeDiscountAmount(d, orderItems, discountEligibleMap) > 0)
      .filter((d) => (finalApplied ? d.id !== finalApplied.discount.id : true));

    const uniqueIds = new Set<string>();
    const uniq = autos.filter((d) => {
      if (uniqueIds.has(d.id)) return false;
      uniqueIds.add(d.id);
      return true;
    });
    setAutoOptions(uniq);

    if (!discountCode && finalApplied && (finalApplied.discount.usageMode ?? 'manual') === 'automatic') {
      if (finalApplied.discount.code) setDiscountCode(finalApplied.discount.code);
      if (!selectedAutoId || selectedAutoId !== finalApplied.discount.id) {
        setSelectedAutoId(finalApplied.discount.id);
      }
    }
  }, [organizationId, orderItems, branchId, customerId, discountCode, candidateDiscounts, discountEligibleMap, selectedAutoId, manuallyCleared]);

  const clearDiscount = useCallback(() => {
    setDiscountCode('');
    setSelectedAutoId(undefined);
    setManuallyCleared(true);
    setAppliedDiscount(undefined);
  }, []);

  const resetState = useCallback(() => {
    setDiscountCode('');
    setSelectedAutoId(undefined);
    setManuallyCleared(false);
    setAppliedDiscount(undefined);
    setAutoOptions([]);
  }, []);

  const validateCode = (code: string) => {
    return getDiscountValidationError(
      code,
      orgDiscounts,
      orderItems,
      branchId,
      customerId,
      discountEligibleMap
    );
  };

  return {
    discountCode,
    setDiscountCode,
    selectedAutoId,
    setSelectedAutoId,
    manuallyCleared,
    setManuallyCleared,
    appliedDiscount,
    autoOptions,
    candidateDiscounts,
    refreshDiscounts,
    clearDiscount,
    resetState,
    discountEligibleMap,
    validateCode
  };
}
