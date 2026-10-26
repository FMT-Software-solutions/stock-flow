import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { VariationType, VariationOption } from '@/types/inventory';

// --- Mappers ---

const mapVariationTypeFromDB = (data: any): VariationType => ({
  id: data.id,
  name: data.name,
  isDefault: data.is_default,
  isArchived: !!data.is_archived,
  organizationId: data.organization_id,
});

const mapVariationOptionFromDB = (data: any): VariationOption => ({
  id: data.id,
  variationTypeId: data.variation_type_id,
  value: data.value,
  isArchived: !!data.is_archived,
  organizationId: data.organization_id,
});

// --- Hooks ---

export function useVariationTypes(organizationId?: string) {
  return useQuery({
    queryKey: ['variationTypes', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('variation_types')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .order('name');

      if (error) throw error;
      return data.map(mapVariationTypeFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useVariationOptions(variationTypeId?: string, organizationId?: string) {
  return useQuery({
    queryKey: ['variationOptions', variationTypeId, organizationId],
    queryFn: async () => {
      if (!variationTypeId) return [];
      let query = supabase
        .from('variation_options')
        .select('*')
        .eq('variation_type_id', variationTypeId);
      
      if (organizationId) {
         query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      }

      const { data, error } = await query.order('value');

      if (error) throw error;
      return data.map(mapVariationOptionFromDB);
    },
    enabled: !!variationTypeId,
  });
}

export function useCreateVariationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newType: { name: string; organizationId: string }) => {
      const { data, error } = await supabase
        .from('variation_types')
        .insert({
          name: newType.name,
          organization_id: newType.organizationId,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return mapVariationTypeFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variationTypes'] });
    },
  });
}

export function useDeleteVariationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('variation_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variationTypes'] });
    },
  });
}

export function useCreateVariationOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newOption: { variationTypeId: string; value: string; organizationId: string }) => {
      const { data, error } = await supabase
        .from('variation_options')
        .insert({
          variation_type_id: newOption.variationTypeId,
          value: newOption.value,
          organization_id: newOption.organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return mapVariationOptionFromDB(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['variationOptions', variables.variationTypeId] });
    },
  });
}

export function useDeleteVariationOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('variation_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variationOptions'] });
    },
  });
}

// Renames update every variant using the old name (rename_variation_* RPCs).
const invalidateVariations = (queryClient: ReturnType<typeof useQueryClient>) =>
  ['variationTypes', 'variationOptions', 'organization_variants', 'product', 'products', 'inventory_entries'].forEach(
    (key) => queryClient.invalidateQueries({ queryKey: [key] })
  );

export function useRenameVariationType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.rpc('rename_variation_type', { p_type_id: id, p_name: name });
      if (error) throw error;
    },
    onSuccess: () => invalidateVariations(queryClient),
  });
}

export function useRenameVariationOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.rpc('rename_variation_option', { p_option_id: id, p_value: value });
      if (error) throw error;
    },
    onSuccess: () => invalidateVariations(queryClient),
  });
}

export function useSetVariationArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id, archived }: { kind: 'type' | 'option'; id: string; archived: boolean }) => {
      const { error } = await supabase.rpc('set_variation_archived', { p_kind: kind, p_id: id, p_archived: archived });
      if (error) throw error;
    },
    onSuccess: () => invalidateVariations(queryClient),
  });
}
