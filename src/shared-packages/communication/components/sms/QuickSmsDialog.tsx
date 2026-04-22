import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSmsBalance } from '../sms-credits/hooks/useSmsBalance';
import { sendSmsMessage } from '../../services/sms.service';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateCommunicationHistory } from '../../hooks/useCommunicationHistory';
import { Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Utility to check if a phone number is a valid Ghana number
const isGhanaPhoneNumber = (phone: string | undefined): boolean => {
    if (!phone) return false;
    // Remove all non-numeric characters (except leading +)
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Check for +233 followed by 9 digits
    if (/^\+233\d{9}$/.test(cleaned)) return true;

    // Check for 233 followed by 9 digits (no plus)
    if (/^233\d{9}$/.test(cleaned)) return true;

    // Check for local format starting with 0 followed by 9 digits (e.g. 024, 054, 055, etc.)
    if (/^0\d{9}$/.test(cleaned)) return true;

    return false;
};

interface QuickSmsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    recipientName?: string;
    recipientPhone?: string;
    memberId?: string;
    recipients?: { phone: string, name?: string, id?: string }[];
    defaultMessage: string;
    metadata?: Record<string, any>;
}

export function QuickSmsDialog({
    isOpen,
    onOpenChange,
    recipientName,
    recipientPhone,
    memberId,
    recipients = [],
    defaultMessage,
    metadata,
}: QuickSmsDialogProps) {
    const [message, setMessage] = useState(defaultMessage);
    const [isSending, setIsSending] = useState(false);
    const { currentOrganization } = useOrganization();
    const { data: balanceData, isLoading: isLoadingBalance } = useSmsBalance(currentOrganization?.id);
    const queryClient = useQueryClient();
    const createHistoryMutation = useCreateCommunicationHistory();

    const rawRecipients = recipients.length > 0 ? recipients : (recipientPhone ? [{ phone: recipientPhone, name: recipientName, id: memberId }] : []);

    // Filter out non-Ghana numbers immediately
    const actualRecipients = rawRecipients.filter(r => isGhanaPhoneNumber(r.phone));
    const originalCount = rawRecipients.length;
    const recipientCount = actualRecipients.length;
    const skippedCount = originalCount - recipientCount;

    // Basic calculation: 1 credit per 160 characters (GSM-7 assumed) multiplied by number of recipients
    const creditsPerMessage = Math.ceil((message.length || 1) / 160);
    const requiredCredits = creditsPerMessage * recipientCount;
    const hasEnoughCredits = (balanceData?.credit_balance || 0) >= requiredCredits;

    const handleSend = async () => {
        if (!message.trim()) {
            toast.error('Message cannot be empty');
            return;
        }

        if (actualRecipients.length === 0) {
            toast.error('Recipient phone number is missing');
            return;
        }

        if (!hasEnoughCredits) {
            toast.error('Insufficient SMS credits');
            return;
        }

        setIsSending(true);
        try {
            // @ts-ignore
            const senderId = currentOrganization?.sms_sender_id || (import.meta as any).env?.VITE_DEFAULT_SMS_SENDER_ID || 'FMTSoftware';
            const isSandbox = false; // Set to false in production

            const validRecipients = actualRecipients
                .filter(r => r.phone && r.phone.trim() !== '')
                .map(r => ({ phone: r.phone.trim() }));

            if (validRecipients.length === 0) {
                toast.error('No valid phone numbers to send to');
                return;
            }

            await sendSmsMessage({
                sender: senderId,
                message,
                recipients: validRecipients,
                sandbox: isSandbox,
                organizationId: currentOrganization?.id
            });

            // Log to history
            if (createHistoryMutation) {
                const memberIds = actualRecipients.map(r => r.id).filter(Boolean) as string[];
                await createHistoryMutation.mutateAsync({
                    type: 'sms',
                    content: message,
                    recipient_type: 'custom',
                    recipient_ids: memberIds,
                    recipient_count: validRecipients.length,
                    status: 'sent',
                    metadata: {
                        ...metadata,
                        actualRecipients: validRecipients,
                        delivered_count: validRecipients.length,
                    }
                });
            }

            // Immediately invalidate balance and session history if applicable
            queryClient.invalidateQueries({ queryKey: ['sms_balance', currentOrganization?.id] });
            if (metadata?.session_id) {
                queryClient.invalidateQueries({ queryKey: ['session-sms-history', metadata.session_id] });
            }

            toast.success('SMS sent successfully');
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to send SMS:', error);
            toast.error(error.message || 'Failed to send SMS');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Send SMS {recipientCount === 1 ? `to ${actualRecipients[0]?.name || actualRecipients[0]?.phone}` : `to ${recipientCount} members`}
                    </DialogTitle>
                    <DialogDescription className='text-xs'>
                        You can customize your message before sending.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {skippedCount > 0 && (
                        <Alert variant="destructive" className="py-2 bg-destructive/10 border-destructive/20 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                {skippedCount} {skippedCount === 1 ? 'recipient was' : 'recipients were'} removed because they do not have a valid Ghana phone number.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-muted-foreground">
                            {recipientCount === 1 ? `To: ${actualRecipients[0]?.phone}` : `Recipients: ${recipientCount}`}
                        </span>
                        <span className="text-muted-foreground">
                            {message.length} chars ({creditsPerMessage} cr/msg) • Total: {requiredCredits} cr
                        </span>
                    </div>

                    <Textarea
                        value={message}
                        onChange={(e: any) => setMessage(e.target.value)}
                        rows={5}
                        className="resize-none"
                        placeholder="Type your message here..."
                    />

                    {!isLoadingBalance && !hasEnoughCredits && (
                        <Alert variant="destructive" className="py-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                You need {requiredCredits} sms credits but only have {balanceData?.credit_balance || 0}. Please top up your balance.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!isLoadingBalance && hasEnoughCredits && (
                        <p className="text-xs text-muted-foreground text-right">
                            Balance: <strong className="text-foreground">{balanceData?.credit_balance} credits</strong>
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={isSending || !hasEnoughCredits || !message.trim()}>
                        {isSending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            'Send SMS'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
