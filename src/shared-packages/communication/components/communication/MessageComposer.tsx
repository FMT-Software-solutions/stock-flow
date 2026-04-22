import { Send, Plus, Edit, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TemplateFormDrawer } from './TemplateFormDrawer';
import { PersonalizationTags, type PersonalizationTag } from './PersonalizationTags';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSmsBalance } from '../sms-credits';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms';
  subject?: string;
  content: string;
}

interface MessageComposerProps {
  messageType: 'email' | 'sms';
  templates: Template[];
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
  subject: string;
  setSubject: (subject: string) => void;
  message: string;
  handleMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  handleSend: () => Promise<void> | void;
  targetMembers: Record<string, any>[];
  additionalRecipients?: string;
  tags?: PersonalizationTag[];
}

export function MessageComposer({
  messageType,
  templates,
  selectedTemplate,
  onTemplateSelect,
  subject,
  setSubject,
  message,
  handleMessageChange,
  previewOpen,
  setPreviewOpen,
  handleSend,
  targetMembers,
  additionalRecipients = '',
  tags
}: MessageComposerProps) {
  const { currentOrganization } = useOrganization();
  const { data: smsBalanceData } = useSmsBalance(currentOrganization?.id);
  const smsBalance = smsBalanceData?.credit_balance || 0;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendClick = async () => {
    setIsSending(true);
    try {
      await handleSend();
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = message;

    const newText = currentText.substring(0, start) + tag + currentText.substring(end);

    // Simulate an event to update the state in the parent
    const event = {
      target: { value: newText }
    } as React.ChangeEvent<HTMLTextAreaElement>;

    handleMessageChange(event);

    // Focus and move cursor after tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  useEffect(() => {
    if (selectedTemplate === 'new') {
      setEditingTemplateId(null);
      setDrawerOpen(true);
      onTemplateSelect(''); // Reset so it doesn't stay 'new'
    }
  }, [selectedTemplate, onTemplateSelect]);

  const handleCreateNew = () => {
    setEditingTemplateId(null);
    setDrawerOpen(true);
  };

  const handleEdit = () => {
    if (selectedTemplate && selectedTemplate !== 'new') {
      setEditingTemplateId(selectedTemplate);
      setDrawerOpen(true);
    }
  };

  const activeTemplateObj = useMemo(() => {
    if (!editingTemplateId) return undefined;
    return templates.find(t => t.id === editingTemplateId) as any;
  }, [editingTemplateId, templates]);

  const totalRecipients = targetMembers.length + additionalRecipients.split(',').filter(p => p.trim().length > 0).length;
  const hasRecipients = totalRecipients > 0;
  const isInsufficientSmsCredits = messageType === 'sms' && totalRecipients > smsBalance;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Message Content</CardTitle>
        </div>
        <div className="flex items-center gap-2 ">
          <div className="flex-1">
            <Select value={selectedTemplate} onValueChange={onTemplateSelect}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder="Use a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTemplate && selectedTemplate !== 'new' && (
            <Button variant="outline" size="icon" onClick={handleEdit} title="Edit selected template">
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleCreateNew} title="Create new template">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {messageType === 'email' && (
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter message subject"
              value={subject}
              onChange={(e: any) => setSubject(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="message">Message Body</Label>
            <div className="flex items-center gap-4">
              <PersonalizationTags onInsertTag={handleInsertTag} tags={tags} />
              {messageType === 'sms' && (
                <span className={`text-xs ${message.length > 150 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                  {message.length} / 150 characters
                </span>
              )}
            </div>
          </div>
          <Textarea
            id="message"
            ref={textareaRef}
            placeholder={messageType === 'sms' ? "Type your SMS message here..." : "Type your email message here..."}
            className="min-h-[200px]"
            value={message}
            onChange={handleMessageChange}
          />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Message Preview</DialogTitle>
                <DialogDescription>
                  This is how your message will appear to recipients.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 my-4">
                {isInsufficientSmsCredits && (
                  <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3 mb-4 text-destructive">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <div>
                      <p className="font-semibold">Insufficient SMS Credits</p>
                      <p className="text-sm">You are trying to send to {totalRecipients} recipients but only have {smsBalance} credits. Please purchase more credits to send this message.</p>
                    </div>
                  </div>
                )}
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
                    <span><strong>To:</strong> {totalRecipients} recipient(s)</span>
                    <span><strong>Type:</strong> {messageType.toUpperCase()}</span>
                  </div>
                  {messageType === 'email' && (
                    <div className="text-sm border-b pb-2">
                      <strong>Subject:</strong> {subject || '(No subject)'}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm pt-2">
                    {message.replace(/{name}/g, targetMembers[0]?.name?.split(' ')[0] || 'John')}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={isSending}>
                  Edit Message
                </Button>
                <Button onClick={handleSendClick} disabled={isSending || isInsufficientSmsCredits}>
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isSending ? 'Sending...' : 'Confirm & Send'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex flex-col items-end gap-2">
            {isInsufficientSmsCredits && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Insufficient SMS credits ({smsBalance} available)
              </span>
            )}
            <Button
              onClick={() => setPreviewOpen(true)}
              disabled={!message || !hasRecipients || isInsufficientSmsCredits}
            >
              <Send className="mr-2 h-4 w-4" />
              Review & Send
            </Button>
          </div>
        </div>
      </CardContent>

      <TemplateFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        messageType={messageType}
        templateToEdit={activeTemplateObj}
        tags={tags}
      />
    </Card>
  );
}
