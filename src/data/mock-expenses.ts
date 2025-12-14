import type { Expense, ExpenseCategory, ExpenseType } from '../types';

export const mockExpenseCategories: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Utilities', description: 'Monthly utility bills' },
  { id: 'cat-2', name: 'Rent', description: 'Office and warehouse rent' },
  { id: 'cat-3', name: 'Salaries', description: 'Employee salaries and wages' },
  { id: 'cat-4', name: 'Office Supplies', description: 'Consumable office items' },
  { id: 'cat-5', name: 'Maintenance', description: 'Repairs and maintenance' },
];

export const mockExpenseTypes: ExpenseType[] = [
  // Utilities
  { id: 'type-1', categoryId: 'cat-1', name: 'Electricity' },
  { id: 'type-2', categoryId: 'cat-1', name: 'Water' },
  { id: 'type-3', categoryId: 'cat-1', name: 'Internet' },
  { id: 'type-4', categoryId: 'cat-1', name: 'Phone' },
  
  // Rent
  { id: 'type-5', categoryId: 'cat-2', name: 'Office Rent' },
  { id: 'type-6', categoryId: 'cat-2', name: 'Warehouse Rent' },
  
  // Salaries
  { id: 'type-7', categoryId: 'cat-3', name: 'Full-time Staff' },
  { id: 'type-8', categoryId: 'cat-3', name: 'Contractors' },
  { id: 'type-9', categoryId: 'cat-3', name: 'Bonuses' },
  
  // Office Supplies
  { id: 'type-10', categoryId: 'cat-4', name: 'Stationery' },
  { id: 'type-11', categoryId: 'cat-4', name: 'Kitchen Supplies' },
  { id: 'type-12', categoryId: 'cat-4', name: 'Cleaning Supplies' },

  // Maintenance
  { id: 'type-13', categoryId: 'cat-5', name: 'Equipment Repair' },
  { id: 'type-14', categoryId: 'cat-5', name: 'Vehicle Maintenance' },
];

export const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    date: '2024-03-01',
    amount: 1200.00,
    categoryId: 'cat-2',
    typeId: 'type-5',
    description: 'March Office Rent',
    paymentMethod: 'bank_transfer',
    status: 'paid',
  },
  {
    id: 'exp-2',
    date: '2024-03-05',
    amount: 150.50,
    categoryId: 'cat-1',
    typeId: 'type-1',
    description: 'February Electricity Bill',
    paymentMethod: 'credit_card',
    status: 'paid',
  },
  {
    id: 'exp-3',
    date: '2024-03-10',
    amount: 45.00,
    categoryId: 'cat-4',
    typeId: 'type-10',
    description: 'Printer Paper and Pens',
    paymentMethod: 'cash',
    status: 'approved',
  },
  {
    id: 'exp-4',
    date: '2024-03-15',
    amount: 5000.00,
    categoryId: 'cat-3',
    typeId: 'type-7',
    description: 'March Staff Salaries',
    paymentMethod: 'bank_transfer',
    status: 'pending',
  },
];
