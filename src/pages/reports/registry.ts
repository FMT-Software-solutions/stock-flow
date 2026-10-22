// Every report the Reports page offers, in menu order. The page builds its
// grouped menu and its filter bar (period / branches / export) from this.

export type ReportId =
  | 'sales_overview'
  | 'product_sales'
  | 'sales_list'
  | 'payments'
  | 'sales_breakdown'
  | 'discounts'
  | 'stock_on_hand'
  | 'stock_activity'
  | 'expenses'
  | 'expenses_breakdown'
  | 'customers'
  | 'suppliers';

export type ReportGroup = 'Sales' | 'Stock' | 'Expenses' | 'People';

export interface ReportDef {
  id: ReportId;
  group: ReportGroup;
  label: string;
  /** shown in the menu tooltip and as the page subtitle's tooltip */
  hint: string;
  /** covers a date range (stock on hand and suppliers are "right now") */
  period: boolean;
  /** can be narrowed to branches */
  branches: boolean;
}

export const REPORTS: ReportDef[] = [
  { id: 'sales_overview', group: 'Sales', label: 'Overview', hint: 'Sales, money collected and debts over the period', period: true, branches: true },
  { id: 'product_sales', group: 'Sales', label: 'By product', hint: 'What sold: quantity and net sales per product and variant', period: true, branches: true },
  { id: 'sales_list', group: 'Sales', label: 'By sale', hint: 'Every sale with its total, payments and balance', period: true, branches: true },
  { id: 'payments', group: 'Sales', label: 'Payments', hint: 'Money received in the period, sale by sale', period: true, branches: true },
  { id: 'sales_breakdown', group: 'Sales', label: 'Breakdown', hint: 'Sales grouped by period, customer, branch or payment', period: true, branches: true },
  { id: 'discounts', group: 'Sales', label: 'Discounts', hint: 'What each discount gave away', period: true, branches: true },
  { id: 'stock_on_hand', group: 'Stock', label: 'Stock on hand', hint: 'Current stock, its value, and what is low or out', period: false, branches: true },
  { id: 'stock_activity', group: 'Stock', label: 'Stock activity', hint: 'Stock received, sold, written off and adjusted', period: true, branches: true },
  { id: 'expenses', group: 'Expenses', label: 'Overview', hint: 'Spending over the period', period: true, branches: true },
  { id: 'expenses_breakdown', group: 'Expenses', label: 'Breakdown', hint: 'Spending grouped by category or type over time', period: true, branches: true },
  { id: 'customers', group: 'People', label: 'Customers', hint: 'Top customers and who owes you', period: true, branches: false },
  { id: 'suppliers', group: 'People', label: 'Suppliers', hint: 'Suppliers and the products they supply', period: false, branches: false },
];

export const REPORT_GROUPS: ReportGroup[] = ['Sales', 'Stock', 'Expenses', 'People'];

export const reportById = (id: string | null | undefined) => REPORTS.find((r) => r.id === id);

/** Old ?tab= links (global search, bookmarks) → the report that replaced them. */
export const LEGACY_TABS: Record<string, ReportId> = {
  products: 'stock_on_hand',
  inventory: 'stock_on_hand',
  sales_orders: 'sales_overview',
  expenses: 'expenses',
  customers: 'customers',
  suppliers: 'suppliers',
  product_sales: 'product_sales',
  stock_activity: 'stock_activity',
  discounts: 'discounts',
};
