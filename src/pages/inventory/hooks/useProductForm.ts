import { useMemo } from 'react';
import { useProduct, useCategories, useSuppliers } from '@/hooks/useInventoryQueries';
import type { ProductVariant } from '@/types/inventory';
import type { GeneratedVariant } from '../components/ProductVariations';

export interface UseProductFormProps {
  id?: string;
  organizationId?: string;
  isOrgLoading?: boolean;
}

export const useProductForm = ({ id, organizationId, isOrgLoading = false }: UseProductFormProps) => {
  const isEditing = !!id;

  const { data: product, isLoading: isLoadingProduct } = useProduct(id);
  
  // Use organizationId from props or fallback to product's organizationId
  const effectiveOrgId = organizationId || product?.organizationId;
  
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories(effectiveOrgId);
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers(effectiveOrgId);

  // We are loading if:
  // 1. Product is fetching
  // 2. OR Organization is loading (can't fetch cats/suppliers yet) AND we don't have effectiveOrgId from product yet
  // 3. OR We have an effectiveOrgId AND (Categories OR Suppliers are fetching)
  const isLoading = isEditing 
    ? (isLoadingProduct || (isOrgLoading && !effectiveOrgId) || (effectiveOrgId ? (isLoadingCategories || isLoadingSuppliers) : false))
    : false;

  const defaultValues = useMemo(() => {
    if (!isEditing || !product) {
      return {
        name: '',
        sku: '',
        branchId: '',
        categoryId: '',
        supplierId: '',
        description: '',
        sellingPrice: 0,
        costPrice: 0,
        quantity: 0,
        minStockLevel: 5,
        unit: 'pcs',
        status: 'published' as const,
        imageUrl: '',
        additionalImages: [] as string[],
        discount: {
          enabled: false,
          type: 'percentage' as const,
          value: 0,
        },
        hasVariations: false,
      };
    }

    return {
      name: product.name,
      sku: product.sku,
      branchId: '',
      categoryId: product.categoryId || '',
      supplierId: product.supplierId || '',
      description: product.description || '',
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice,
      quantity: product.quantity,
      minStockLevel: product.minStockLevel,
      unit: product.unit,
      // Ensure status is lowercase to match select options
      status: (product.status?.toLowerCase() || 'published') as 'published' | 'draft' | 'inactive',
      imageUrl: product.imageUrl || '',
      additionalImages: (product.additionalImages || []) as string[],
      discount: product.discount || {
        enabled: false,
        type: 'percentage' as const,
        value: 0,
      },
      hasVariations: product.hasVariations || false,
    };
  }, [product, isEditing]);

  const initialVariants: GeneratedVariant[] = useMemo(() => {
    if (product?.variants && product.variants.length > 0) {
      return product.variants.map((v: ProductVariant) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        quantity: v.quantity || 0,
        attributes: v.attributes,
        // Ensure other properties are mapped if needed
      }));
    }
    return [];
  }, [product]);

  return {
    isLoading,
    product,
    categories,
    suppliers,
    defaultValues,
    initialVariants,
  };
};
