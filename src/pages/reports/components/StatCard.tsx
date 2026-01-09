import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: ReactNode;
  valueClassName?: string;
}

export function StatCard({ title, value, valueClassName }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="gap-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={`text-xl font-bold ${valueClassName || ''}`}>
        {value}
      </CardContent>
    </Card>
  );
}
