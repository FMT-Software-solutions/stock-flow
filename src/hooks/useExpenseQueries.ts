import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/utils/supabase';
import type { Expense, ExpenseCategory, ExpenseType, ExpenseInput } from '@/types/expenses';
import { useAuth } from '@/contexts/AuthContext';

// --- Mappers ---

const mapExpenseCategoryFromDB = (data: any): ExpenseCategory => ({
  id: data.id,
  name: data.name,
  description: data.description,
  organizationId: data.organization_id,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapExpenseTypeFromDB = (data: any): ExpenseType => ({
  id: data.id,
  categoryId: data.category_id,
  name: data.name,
  description: data.description,
  organizationId: data.organization_id,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const mapExpenseFromDB = (data: any): Expense => ({
  id: data.id,
  date: data.date,
  amount: Number(data.amount),
  categoryId: data.category_id,
  categoryName: data.category?.name,
  typeId: data.type_id,
  typeName: data.type?.name,
  description: data.description,
  paymentMethod: data.payment_method,
  status: data.status,
  reference: data.reference,
  attachmentUrl: data.attachment_url,
  branchId: data.branch_id,
  branchName: data.branch?.name,
  organizationId: data.organization_id,
  createdByName: data.creator ? `${data.creator.first_name || ''} ${data.creator.last_name || ''}`.trim() : undefined,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  isDeleted: data.is_deleted,
});

// --- Hooks ---

// Categories
export function useExpenseCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['expense_categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return data.map(mapExpenseCategoryFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<ExpenseCategory> & { organizationId: string }) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          name: category.name,
          description: category.description,
          organization_id: category.organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return mapExpenseCategoryFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ExpenseCategory> }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;

      const { data, error } = await supabase
        .from('expense_categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapExpenseCategoryFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] }); // Update expenses list if category name changed (though it's relational usually)
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // First delete related types
      await supabase
        .from('expense_types')
        .update({ is_deleted: true })
        .eq('category_id', id);

      const { error } = await supabase
        .from('expense_categories')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      queryClient.invalidateQueries({ queryKey: ['expense_types'] });
    },
  });
}

// Types
export function useExpenseTypes(organizationId?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['expense_types', organizationId, categoryId],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('expense_types')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_deleted', false);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      return data.map(mapExpenseTypeFromDB);
    },
    enabled: !!organizationId,
  });
}

export function useCreateExpenseType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: Partial<ExpenseType> & { organizationId: string }) => {
      const { data, error } = await supabase
        .from('expense_types')
        .insert({
          name: type.name,
          category_id: type.categoryId,
          description: type.description,
          organization_id: type.organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return mapExpenseTypeFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_types'] });
    },
  });
}

export function useDeleteExpenseType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_types')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_types'] });
    },
  });
}

// Expenses
export function useExpenses(organizationId?: string, branchIds?: string[]) {
  return useQuery({
    queryKey: ['expenses', organizationId, branchIds],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(name),
          type:expense_types(name),
          branch:branches(name),
          creator:profiles!expenses_created_by_fkey1(first_name, last_name)
        `)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false);

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      return data.map(mapExpenseFromDB);
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev ?? [],
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  if (!user) throw new Error('User not authenticated');

  return useMutation({
    mutationFn: async (expense: ExpenseInput) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          date: expense.date,
          amount: expense.amount,
          category_id: expense.categoryId,
          type_id: expense.typeId || null,
          description: expense.description,
          payment_method: expense.paymentMethod,
          status: expense.status,
          reference: expense.reference,
          attachment_url: expense.attachmentUrl,
          branch_id: expense.branchId,
          organization_id: expense.organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return mapExpenseFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useBulkCreateExpenses() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  if (!user) throw new Error('User not authenticated');

  return useMutation({
    mutationFn: async (expenses: ExpenseInput[]) => {
      const expenseData = expenses.map(expense => ({
        date: expense.date,
        amount: expense.amount,
        category_id: expense.categoryId,
        type_id: expense.typeId || null,
        description: expense.description,
        payment_method: expense.paymentMethod,
        status: expense.status,
        reference: expense.reference,
        attachment_url: expense.attachmentUrl,
        branch_id: expense.branchId,
        organization_id: expense.organizationId,
        created_by: user.id,
      }));

      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select();

      if (error) throw error;
      return data.map(mapExpenseFromDB);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ExpenseInput> }) => {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
      if (updates.typeId !== undefined) updateData.type_id = updates.typeId;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.reference !== undefined) updateData.reference = updates.reference;
      if (updates.attachmentUrl !== undefined) updateData.attachment_url = updates.attachmentUrl;
      if (updates.branchId !== undefined) updateData.branch_id = updates.branchId;

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapExpenseFromDB(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
