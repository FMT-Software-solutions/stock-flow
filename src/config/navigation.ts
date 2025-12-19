import {
  Home,
  Settings,
  Users,
  MapPin,
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Receipt,
} from 'lucide-react';




import type { PermissionScope, PermissionAction } from '@/modules/permissions/types';

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  devOnly?: boolean;
  permission?: {
    scope: PermissionScope;
    action?: PermissionAction;
  };
  iconClassName?: string;
}

export const navItems: NavItem[] = [
  {
    to: '/dashboard',
    icon: Home,
    label: 'Dashboard',
    permission: { scope: 'dashboard' },
    iconClassName: 'text-blue-500',
  },
  {
    to: '/inventory',
    icon: Package,
    label: 'Inventory',
    permission: { scope: 'inventory' },
    iconClassName: 'text-indigo-500',
  },
  {
    to: '/orders',
    icon: ShoppingCart,
    label: 'Sales & Orders',
    permission: { scope: 'orders' },
    iconClassName: 'text-pink-500',
  },
  {
    to: '/customers',
    icon: Users,
    label: 'Customers',
    permission: { scope: 'customers' },
    iconClassName: 'text-cyan-500',
  },
  {
    to: '/suppliers',
    icon: Truck,
    label: 'Suppliers',
    permission: { scope: 'suppliers' },
    iconClassName: 'text-amber-500',
  },
  
  {
    to: '/expenses',
    icon: Receipt,
    label: 'Expenses',
    permission: { scope: 'expenses' },
    iconClassName: 'text-emerald-500',
  },
  {
    to: '/reports',
    icon: BarChart3,
    label: 'Reports',
    permission: { scope: 'reports' },
    iconClassName: 'text-rose-500',
  },
  {
    to: '/branches',
    icon: MapPin,
    label: 'Branches',
    permission: { scope: 'branch_management' },
    iconClassName: 'text-green-500',
  },
  {
    to: '/user-management',
    icon: Users,
    label: 'Users',
    permission: { scope: 'user_management' },
    iconClassName: 'text-orange-500',
  },
  {
    to: '/settings',
    icon: Settings,
    label: 'Settings',
    permission: { scope: 'settings' },
    iconClassName: 'text-purple-500',
  },
];
