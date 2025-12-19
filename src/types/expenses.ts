export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseType {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  categoryId: string;
  categoryName?: string;
  typeId?: string;
  typeName?: string;
  description: string;
  paymentMethod: 'cash' | 'credit_card' | 'bank_transfer' | 'check' | 'other';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reference?: string;
  attachmentUrl?: string;
  branchId?: string;
  branchName?: string;
  organizationId: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface ExpenseInput {
  date: string;
  amount: number;
  categoryId: string;
  typeId?: string;
  description: string;
  paymentMethod: 'cash' | 'credit_card' | 'bank_transfer' | 'check' | 'other';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reference?: string;
  attachmentUrl?: string;
  branchId?: string;
  organizationId: string;
}
