export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ExpenseType {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  categoryId: string;
  typeId: string;
  description: string;
  paymentMethod: 'cash' | 'credit_card' | 'bank_transfer' | 'check' | 'other';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reference?: string;
  attachmentUrl?: string;
}
