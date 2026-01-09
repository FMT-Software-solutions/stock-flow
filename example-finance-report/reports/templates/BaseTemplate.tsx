import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BaseTemplateProps {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}

export function BaseTemplate({ title, subtitle, children }: BaseTemplateProps) {
  return (
    <Card className="w-full print:shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-lg font-semibold">
          {title}
          {subtitle && (
            <span className="block text-sm font-normal text-muted-foreground mt-1">
              {subtitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 print:space-y-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}