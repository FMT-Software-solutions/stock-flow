import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone } from 'lucide-react';

interface MessageTypeSelectorProps {
  messageType: 'email' | 'sms';
  onChange: (type: 'email' | 'sms') => void;
}

export function MessageTypeSelector({ messageType, onChange }: MessageTypeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant={messageType === 'sms' ? 'default' : 'outline'}
            className="flex-1 flex items-center gap-2 relative"
            onClick={() => onChange('sms')}
          >
            <Phone className="h-6 w-6" />
            <span className="font-medium">SMS Message</span>
            {messageType === 'sms' && (
              <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white" />
            )}
          </Button>
          <Button
            variant="outline"
            className="flex-1 flex items-center gap-2 relative opacity-50 cursor-not-allowed"
            onClick={() => { }}
            disabled
          >
            <Mail className="h-6 w-6" />
            <span className="font-medium">Email</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md">Coming Soon</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
