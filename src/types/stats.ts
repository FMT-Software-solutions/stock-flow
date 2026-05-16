import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface StatResult {
  value: ReactNode;
  subValue?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: ReactNode;
  footer?: ReactNode;
}

export interface StatsField<TData> {
  id: string;
  label: string;
  icon?: LucideIcon;
  calculate: (data: TData[]) => StatResult;
  className?: string; // For custom styling of the value/label
  fullWidth?: boolean;
}

export interface StatsGroup<TData> {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  fields: StatsField<TData>[];
  cardVariant?: 'default' | 'glass';
  action?: {
    label?: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
  isHidden?: boolean;
}
