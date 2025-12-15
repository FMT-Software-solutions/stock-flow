import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { VariationType, VariationOption } from '@/types/inventory';

// --- Mappers ---

const mapVariationTypeFromDB = (data: any): VariationType => ({
  id: data.id,
  name: data.name,
  isDefault: data.is_default,
  organizationId: data.organization_id,
});

const mapVariationOptionFromDB = (data: any): VariationOption => ({
  id: data.id,
  variationTypeId: data.variation_type_id,
  value: data.value,
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
