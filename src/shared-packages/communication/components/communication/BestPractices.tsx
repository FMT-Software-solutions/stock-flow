import { Clock, MessageSquare, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BestPractices() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Best Practices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timing
          </h4>
          <p>Send messages during normal waking hours. Avoid sending late at night or early morning.</p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Limits
          </h4>
          <p>Keep SMS messages brief and to the point. The maximum length is 150 characters to ensure reliable delivery.</p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            Personalization
          </h4>
          <p>Use the {'{first_name}'} tag to automatically insert the recipient's first name in your message.</p>
        </div>
      </CardContent>
    </Card>
  );
}
