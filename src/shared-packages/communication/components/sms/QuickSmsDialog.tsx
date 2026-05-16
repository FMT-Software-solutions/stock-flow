import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSmsBalance } from '../sms-credits/hooks/useSmsBalance';
import { sendSmsMessage } from '../../services/sms.service';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateCommunicationHistory } from '../../hooks/useCommunicationHistory';
import { useCommunicationTemplates, useCreateTemplate } from '../../hooks/useCommunicationTemplates';
import { Loader2, MessageSquare, AlertCircle, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    context?: string;
    placeholders?: Record<string, string | number>;
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
    context,
    placeholders,
}: QuickSmsDialogProps) {
    const [message, setMessage] = useState(defaultMessage);
    const [isSending, setIsSending] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const { currentOrganization } = useOrganization();
    const { data: balanceData, isLoading: isLoadingBalance } = useSmsBalance(currentOrganization?.id);
    const { data: templates } = useCommunicationTemplates();
    const createTemplateMutation = useCreateTemplate();
    const queryClient = useQueryClient();
    const createHistoryMutation = useCreateCommunicationHistory();

    const smsTemplates = templates?.filter(t => t.type === 'sms') || [];

    const applyPlaceholders = (text: string) => {
        if (!placeholders) return text;
        let result = text;
        Object.entries(placeholders).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, String(value));
        });
        return result;
    };

    useEffect(() => {
        if (isOpen) {
            let initialMsg = defaultMessage;
            let appliedId = 'default';
            if (context) {
                const savedId = localStorage.getItem(`sms_pref_${context}`);
                if (savedId) {
                    const tpl = smsTemplates.find(t => t.id === savedId);
                    if (tpl) {
                        initialMsg = applyPlaceholders(tpl.content);
                        appliedId = tpl.id;
                    }
                }
            }
            setMessage(initialMsg);
            setSelectedTemplateId(appliedId);
        }
    }, [isOpen, context, smsTemplates.length]);

    const handleTemplateChange = (val: string) => {
        setSelectedTemplateId(val);
        if (val === 'default') {
            setMessage(defaultMessage);
            if (context) localStorage.removeItem(`sms_pref_${context}`);
        } else {
            const tpl = smsTemplates.find(t => t.id === val);
            if (tpl) {
                setMessage(applyPlaceholders(tpl.content));
                if (context) localStorage.setItem(`sms_pref_${context}`, val);
            }
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || !message.trim()) return;
        try {
            await createTemplateMutation.mutateAsync({
                name: newTemplateName,
                type: 'sms',
                content: message,
            });
            setIsPopoverOpen(false);
            setNewTemplateName('');
        } catch (e) {
            // Error is handled by mutation hook
        }
    };

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

            let finalMessage = message;

            // Optional fallback: If the user directly typed variables but didn't select a template, 
            // ensure they still get replaced at send time.
            if (placeholders) {
                Object.entries(placeholders).forEach(([key, value]) => {
                    const regex = new RegExp(`\\{${key}\\}`, 'gi');
                    finalMessage = finalMessage.replace(regex, String(value));
                });
            }

            await sendSmsMessage({
                sender: senderId,
                message: finalMessage,
                recipients: validRecipients,
                sandbox: isSandbox,
                organizationId: currentOrganization?.id
            });

            // Log to history
            if (createHistoryMutation) {
                const memberIds = actualRecipients.map(r => r.id).filter(Boolean) as string[];
                await createHistoryMutation.mutateAsync({
                    type: 'sms',
                    content: finalMessage,
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

                    <div className="flex justify-between items-center gap-2">
                        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Use a template" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default Message</SelectItem>
                                {smsTemplates.map(template => (
                                    <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs whitespace-nowrap" disabled={!message.trim()}>
                                    <Save className="h-3 w-3 mr-1" />
                                    Save as Template
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="end">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="template-name" className="text-xs font-medium">Template Name</Label>
                                        <Input
                                            id="template-name"
                                            placeholder="e.g. Payment Reminder"
                                            className="h-8 text-xs"
                                            value={newTemplateName}
                                            onChange={e => setNewTemplateName(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        className="w-full h-8 text-xs"
                                        onClick={handleSaveTemplate}
                                        disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                                    >
                                        {createTemplateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Template'}
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex justify-between items-center text-xs">
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

                    {placeholders && Object.keys(placeholders).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            Available variables: {Object.keys(placeholders).map(k => <code key={k} className="bg-muted px-1 py-0.5 rounded text-[10px] mr-1">{`{${k}}`}</code>)}
                        </p>
                    )}

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
