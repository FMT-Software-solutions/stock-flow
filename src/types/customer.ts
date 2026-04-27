export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  images?: string[] | null;
  organizationId: string;
  branchId?: string;
  branchName?: string;
  isDeleted?: boolean;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  createdAt?: string;
  updatedAt?: string;
}
