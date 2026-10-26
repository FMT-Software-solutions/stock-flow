import { type ReactNode } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RecipientSelectorProps {
  additionalRecipients: string;
  setAdditionalRecipients: (val: string) => void;
  targetCount: number;
  isLoadingTargets: boolean;
  children?: ReactNode;
}

export function RecipientSelector({
  additionalRecipients,
  setAdditionalRecipients,
  targetCount,
  isLoadingTargets,
  children
}: RecipientSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipients</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="additionalRecipients">Additional Recipients</Label>
          <Textarea
            id="additionalRecipients"
            placeholder="Enter comma-separated phone numbers or emails..."
            value={additionalRecipients}
            onChange={(e: any) => setAdditionalRecipients(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {isLoadingTargets ? 'Calculating targets...' : `Total Target Recipients: ${targetCount}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
