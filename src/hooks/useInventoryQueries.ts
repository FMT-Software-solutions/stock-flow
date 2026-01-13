import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Product, Category, Supplier, ProductVariantInput, InventoryEntry, InventoryEntryInput } from '@/types/inventory';
import { deleteImageFromCloudinary } from '@/utils/cloudinary';

// --- Mappers ---

const mapProductFromDB = (data: any): Product => ({
  id: data.id,
  name: data.name,
  sku: data.sku,
  categoryId: data.category_id,
  category: data.category_name ? { id: data.category_id, name: data.category_name } : undefined, // Partial category info from view
  description: data.description,
  costPrice: Number(data.cost_price),
  sellingPrice: Number(data.selling_price),
  quantity: Number(data.quantity),
  minStockLevel: Number(data.min_stock_level),
  unit: data.unit,
  status: data.status,
  imageUrl: data.image_url,
  additionalImages: data.additional_images,
  discount: data.discount,
  supplierId: data.supplier_id,
  supplier: data.supplier_name ? { id: data.supplier_id, name: data.supplier_name } : undefined,
  taxRate: Number(data.tax_rate),
  barcode: data.barcode,
  location: data.location,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  hasVariations: data.has_variations,
  organizationId: data.organization_id,
  createdByName: data.created_by_name,
  isDeleted: data.is_deleted,
});

const mapCategoryFromDB = (data: any): Category => ({
  id: data.id,
  name: data.name,
  description: data.description,
  parentId: data.parent_id,
  image: data.image_url,
  productCount: 0, // Need aggregation or view for this
});

const mapSupplierFromDB = (data: any): Supplier => ({
  id: data.id,
  name: data.name,
  contactPerson: data.contact_person,
  email: data.email,
  phone: data.phone,
  address: data.address,
  website: data.website,
});

const mapInventoryEntryFromDB = (data: any): InventoryEntry => {
  let productName = data.product?.name ?? '';
  let sku = data.product?.sku ?? '';

  if (data.variant) {
    const attributes = data.variant.attributes || {};
    const attributeString = Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (attributeString) {
      productName = `${productName} (${attributeString})`;
    }
    sku = data.variant.sku || sku;
  } else if (data.custom_label) {
    productName = `${productName} (${data.custom_label})`;
  }

  const categoryData = Array.isArray(data.product?.category)
    ? data.product.category[0]
    : data.product?.category;

  return {
    id: data.id,
    inventoryNumber: data.inventory_number,
    productId: data.product_id,
    variantId: data.variant_id || undefined,
    branchId: data.branch_id || undefined,
    productName: productName,
    sku: sku,
    unit: data.product?.unit ?? undefined,
    branchName: data.branch?.name ?? undefined,
    quantity: Number(data.quantity ?? 0),
    minStockLevel: Number(data.min_stock_level ?? 0),
    location: data.location ?? undefined,
    organizationId: data.organization_id,
    lastUpdated: data.last_updated,
    createdByName: data.creator ? `${data.creator.first_name || ''} ${data.creator.last_name || ''}`.trim() : undefined,
    customLabel: data.custom_label,
    priceOverride: data.price_override ? Number(data.price_override) : undefined,
    type: data.type,
    imageUrl: data.image_url || undefined,
    productPrice: data.product?.selling_price ? Number(data.product.selling_price) : undefined,
    variantPrice: data.variant?.price ? Number(data.variant.price) : undefined,
    productImage: data.product?.image_url || undefined,
    categoryName: categoryData?.name,
    isDeleted: data.is_deleted,
    discountId: data.discount_id,
    discount: data.discount ? {
      id: data.discount.id,
      organizationId: data.discount.organization_id,
      name: data.discount.name,
      code: data.discount.code,
      description: data.discount.description,
      type: data.discount.type,
      value: Number(data.discount.value),
      startAt: data.discount.start_at,
      expiresAt: data.discount.expires_at,
      customerIds: data.discount.customer_ids,
      branchIds: data.discount.branch_ids,
      targetMode: data.discount.target_mode as 'all' | 'category' | 'product' | 'inventory' | undefined,
      usageMode: data.discount.usage_mode as 'automatic' | 'manual' | undefined,
      usageLimit: data.discount.usage_limit ?? null,
      timesUsed: typeof data.discount.times_used === 'number' ? data.discount.times_used : 0,
      isActive: data.discount.is_active,
      createdAt: data.discount.created_at,
      updatedAt: data.discount.updated_at,
    } : undefined,
  };
};

// --- Hooks ---

export function useProducts(organizationId?: string) {
  return useQuery({
    queryKey: ['products', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('products_view')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(mapProductFromDB);
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev ?? [],
  });
}

export function useProductInventory(productId?: string) {
  return useQuery({
    queryKey: ['product_inventory', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('is_deleted', false);

      if (error) throw error;
      return data; // Returns raw DB shape, sufficient for checking existence
    },
    enabled: !!productId,
  });
}

export function useInventoryEntry(id?: string) {
  return useQuery({
    queryKey: ['inventory_entry', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          inventory_number,
          product_id,
          variant_id,
          branch_id,
          quantity,
          min_stock_level,
          location,
          organization_id,
          last_updated,
          custom_label,
          price_override,
          type,
          image_url,
          product:products (
            id,
            name,
            sku,
            unit,
            selling_price,
            image_url,
            status,
            category:product_categories (
              name
            )
          ),
          variant:product_variants (
            id,
            sku,
            price,
            attributes
          ),
          branch:branches (
            id,
            name
          ),
          creator:profiles!inventory_created_by_fkey2 (
            first_name,
            last_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return mapInventoryEntryFromDB(data);
    },
    enabled: !!id,
  });
}

export function useCreateInventoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: InventoryEntryInput) => {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          product_id: entry.productId,
          variant_id: entry.variantId || null,
          branch_id: entry.branchId,
          quantity: entry.quantity,
          min_stock_level: entry.minStockLevel || 0,
          location: entry.location,
          organization_id: entry.organizationId,
          custom_label: entry.customLabel,
          price_override: entry.priceOverride,
          type: entry.type || 'variant',
          image_url: entry.imageUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateInventoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<InventoryEntryInput> & { id: string }) => {
      const { id, ...data } = updates;

      const updateData: any = {};
      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.minStockLevel !== undefined) updateData.min_stock_level = data.minStockLevel;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.customLabel !== undefined) updateData.custom_label = data.customLabel;
      if (data.priceOverride !== undefined) updateData.price_override = data.priceOverride;
      if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

      const { data: updated, error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['product_inventory'] });
    },
  });
}

export function useBulkUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<InventoryEntryInput> }) => {
      const updateData: any = {};
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.minStockLevel !== undefined) updateData.min_stock_level = updates.minStockLevel;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.customLabel !== undefined) updateData.custom_label = updates.customLabel;
      if (updates.priceOverride !== undefined) updateData.price_override = updates.priceOverride;
      // Image URL usually unique per item, so maybe skip for bulk, but can allow if needed
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;

      const { data, error } = await supabase
        .from('inventory')
        .update(updateData)
        .in('id', ids)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['product_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Updates price/qty which affects product view
    },
  });
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('products_view')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;

      const product = mapProductFromDB(data);

      if (product.hasVariations) {
        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', id);

        if (variantsError) {
          console.error('Error fetching variants:', variantsError);
          throw variantsError;
        }

        if (variantsData) {
          product.variants = variantsData.map((v: any) => ({
            id: v.id,
            productId: v.product_id,
            sku: v.sku,
            price: Number(v.price),
            attributes: v.attributes,
            organizationId: v.organization_id,
            quantity: Number(v.quantity || 0),
            minStockLevel: Number(v.min_stock_level || 0),
          }));
        }
      }

      return product;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: Omit<Partial<Product>, 'variants'> & { organizationId: string; variants?: ProductVariantInput[] }) => {
      // 1. Insert into products
      const productData = {
        name: newProduct.name,
        sku: newProduct.sku,
        description: newProduct.description,
        category_id: newProduct.categoryId,
        supplier_id: newProduct.supplierId || null,
        brand: 'Generic',
        cost_price: newProduct.costPrice,
        selling_price: newProduct.sellingPrice,
        unit: newProduct.unit,
        status: newProduct.status,
        image_url: newProduct.imageUrl,
        additional_images: newProduct.additionalImages,
        tax_rate: newProduct.taxRate,
        barcode: newProduct.barcode,
        discount: newProduct.discount,
        organization_id: newProduct.organizationId,
        has_variations: newProduct.hasVariations,
      };

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Handle Variants
      if (newProduct.hasVariations && newProduct.variants && newProduct.variants.length > 0) {
        for (const variant of newProduct.variants) {
          const { error: variantError } = await supabase
            .from('product_variants')
            .insert({
              product_id: product.id,
              sku: variant.sku,
              price: variant.price,
              attributes: variant.attributes,
              organization_id: newProduct.organizationId
            });

          if (variantError) throw variantError;
        }
      }
      // Note: Inventory is now managed separately via useCreateInventoryEntry

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, oldImageUrl }: { id: string; updates: Partial<Product>; oldImageUrl?: string }) => {
      // Check if image changed and delete old one
      if (updates.imageUrl && oldImageUrl && updates.imageUrl !== oldImageUrl) {
        await deleteImageFromCloudinary(oldImageUrl);
      }

      const productData: any = {};
      if (updates.name !== undefined) productData.name = updates.name;
      if (updates.sku !== undefined) productData.sku = updates.sku;
      if (updates.description !== undefined) productData.description = updates.description;
      if (updates.categoryId !== undefined) productData.category_id = updates.categoryId || null;
      if (updates.supplierId !== undefined) productData.supplier_id = updates.supplierId || null;
      if (updates.costPrice !== undefined) productData.cost_price = updates.costPrice;
      if (updates.sellingPrice !== undefined) productData.selling_price = updates.sellingPrice;
      if (updates.unit !== undefined) productData.unit = updates.unit;
      if (updates.status !== undefined) productData.status = updates.status;
      if (updates.imageUrl !== undefined) productData.image_url = updates.imageUrl;
      if (updates.additionalImages !== undefined) productData.additional_images = updates.additionalImages;
      if (updates.taxRate !== undefined) productData.tax_rate = updates.taxRate;
      if (updates.barcode !== undefined) productData.barcode = updates.barcode;
      if (updates.discount !== undefined) productData.discount = updates.discount;
      if (updates.hasVariations !== undefined) productData.has_variations = updates.hasVariations;

      const { error: productError } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id);

      if (productError) throw productError;

      // Update inventory logic handling both simple and variant products
      const hasVariations = updates.hasVariations;

      if (hasVariations && updates.variants) {
        // 1. Get existing variants to handle deletions
        const { data: existingVariants } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', id);

        const existingIds = existingVariants?.map(v => v.id) || [];
        const incomingIds = updates.variants.filter(v => v.id).map(v => v.id as string);

        // 2. Delete removed variants
        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
          await supabase.from('product_variants').delete().in('id', idsToDelete);
        }

        // Cleanup any "simple product" inventory row (where variant_id is null) to prevent double counting
        await supabase.from('inventory').delete().eq('product_id', id).is('variant_id', null);

        // 3. Upsert variants
        for (const variant of updates.variants) {
          if (variant.id) {
            // Update existing variant
            await supabase
              .from('product_variants')
              .update({
                sku: variant.sku,
                price: variant.price,
                attributes: variant.attributes,
              })
              .eq('id', variant.id);

            // Update inventory for variant (maintain for backward compatibility/views)
            await supabase
              .from('inventory')
              .update({
                quantity: variant.quantity,
              })
              .eq('variant_id', variant.id);
          } else {
            // Insert new variant
            if (!updates.organizationId) {
              console.warn("Organization ID missing for new variant creation during update");
              continue;
            }

            const { data: newVariant, error: insertError } = await supabase
              .from('product_variants')
              .insert({
                product_id: id,
                sku: variant.sku,
                price: variant.price,
                attributes: variant.attributes,
                organization_id: updates.organizationId,
              })
              .select()
              .single();

            if (insertError) throw insertError;

            // Insert inventory
            await supabase
              .from('inventory')
              .insert({
                product_id: id,
                variant_id: newVariant.id,
                branch_id: updates.branchId,
                quantity: variant.quantity || 0,
                organization_id: updates.organizationId,
                min_stock_level: updates.minStockLevel || 0,
                location: updates.location,
              });
          }
        }
      } else {
        // Simple Product Logic

        // If explicitly switched to no variations, clean up any leftovers
        if (updates.hasVariations === false) {
          await supabase.from('product_variants').delete().eq('product_id', id);
        }

        const inventoryData: any = {};
        if (updates.quantity !== undefined) inventoryData.quantity = updates.quantity;
        if (updates.minStockLevel !== undefined) inventoryData.min_stock_level = updates.minStockLevel;
        if (updates.location !== undefined) inventoryData.location = updates.location;
        if (updates.branchId !== undefined) inventoryData.branch_id = updates.branchId;

        if (Object.keys(inventoryData).length > 0) {
          const { error: inventoryError } = await supabase
            .from('inventory')
            .update(inventoryData)
            .eq('product_id', id)
            .is('variant_id', null);

          if (inventoryError) throw inventoryError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; imageUrl?: string }) => {
      // For soft delete, we don't delete the image yet
      // if (imageUrl) {
      //   await deleteImageFromCloudinary(imageUrl);
      // }

      const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] }); // Invalidate inventory too as it cascades
    },
  });
}

export function useDeleteInventoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Products view aggregates inventory, so update it
    },
  });
}

export function useCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('organization_id', organizationId);

      if (error) throw error;
      return data.map(mapCategoryFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<Category> & { organizationId: string }) => {
      const { data, error } = await supabase
        .from('product_categories')
        .insert({
          name: category.name,
          description: category.description,
          organization_id: category.organizationId,
          slug: category.name?.toLowerCase().replace(/\s+/g, '-'), // Simple slug generation
          image_url: category.image,
        })
        .select()
        .single();

      if (error) throw error;
      return mapCategoryFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, oldImageUrl }: { id: string; updates: Partial<Category>; oldImageUrl?: string }) => {
      // Check if image changed and delete old one
      if (updates.image && oldImageUrl && updates.image !== oldImageUrl) {
        await deleteImageFromCloudinary(oldImageUrl);
      }

      const categoryData: any = {};
      if (updates.name !== undefined) {
        categoryData.name = updates.name;
        categoryData.slug = updates.name.toLowerCase().replace(/\s+/g, '-');
      }
      if (updates.description !== undefined) categoryData.description = updates.description;
      if (updates.image !== undefined) categoryData.image_url = updates.image;

      const { data, error } = await supabase
        .from('product_categories')
        .update(categoryData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapCategoryFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useSuppliers(organizationId?: string) {
  return useQuery({
    queryKey: ['suppliers', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(mapSupplierFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return mapSupplierFromDB(data);
    },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: Partial<Supplier> & { organizationId: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: supplier.name,
          contact_person: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          website: supplier.website,
          organization_id: supplier.organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return mapSupplierFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Supplier> }) => {
      const supplierData: any = {};
      if (updates.name !== undefined) supplierData.name = updates.name;
      if (updates.contactPerson !== undefined) supplierData.contact_person = updates.contactPerson;
      if (updates.email !== undefined) supplierData.email = updates.email;
      if (updates.phone !== undefined) supplierData.phone = updates.phone;
      if (updates.address !== undefined) supplierData.address = updates.address;
      if (updates.website !== undefined) supplierData.website = updates.website;

      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapSupplierFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useInventoryEntries(organizationId?: string, branchIds?: string[], includeAllProductStatuses?: boolean) {
  return useQuery({
    queryKey: ['inventory_entries', organizationId, branchIds, includeAllProductStatuses],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('inventory')
        .select(`
          id,
          inventory_number,
          product_id,
          variant_id,
          branch_id,
          quantity,
          min_stock_level,
          location,
          organization_id,
          last_updated,
          custom_label,
          price_override,
          type,
          image_url,
          product:products!inner (
            id,
            name,
            sku,
            unit,
            selling_price,
            image_url,
            status,
            category:product_categories (
              name
            )
          ),
          variant:product_variants (
            id,
            sku,
            price,
            attributes
          ),
          branch:branches (
            id,
            name
          ),
          creator:profiles!inventory_created_by_fkey2 (
            first_name,
            last_name
          ),
          discount:discounts (
            *
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)

      if (!includeAllProductStatuses) {
        query = query.eq('product.status', 'published');
      }

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query.order('last_updated', { ascending: false });

      if (error) throw error;
      return data.map(mapInventoryEntryFromDB);
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev ?? [],
  });
}

export function useBulkUpdateInventoryEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      branchIds,
      updates,
    }: {
      productId: string;
      branchIds: string[];
      updates: {
        quantity?: number;
        minStockLevel?: number;
        priceOverride?: number;
      };
    }) => {
      const updateData: any = {};
      // Only include fields that are actually defined/passed
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.minStockLevel !== undefined)
        updateData.min_stock_level = updates.minStockLevel;
      if (updates.priceOverride !== undefined)
        updateData.price_override = updates.priceOverride;

      if (Object.keys(updateData).length === 0) return;

      const { error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('product_id', productId)
        .in('branch_id', branchIds)
        .eq('is_deleted', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entries'] });
      queryClient.invalidateQueries({ queryKey: ['product_inventory'] });
    },
  });
}
