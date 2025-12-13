import {
  Home,
  Settings,
  Users,
  MapPin,
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
