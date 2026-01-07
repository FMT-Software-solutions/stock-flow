import type { LucideIcon } from 'lucide-react';

export interface StatResult {
  value: string | number;
  subValue?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  footer?: string;
}

export interface StatsField<TData> {
  id: string;
  label: string;
  icon?: LucideIcon;
  calculate: (data: TData[]) => StatResult;
  className?: string; // For custom styling of the value/label
}

export interface StatsGroup<TData> {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  fields: StatsField<TData>[];
  action?: {
    label?: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
  isHidden?: boolean;
}
