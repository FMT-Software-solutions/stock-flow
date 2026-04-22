import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTemplate, useUpdateTemplate, type CommunicationTemplate } from '../../hooks/useCommunicationTemplates';
import { PersonalizationTags, type PersonalizationTag } from './PersonalizationTags';
import { toast } from 'sonner';

interface TemplateFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageType: 'email' | 'sms';
  templateToEdit?: CommunicationTemplate;
  tags?: PersonalizationTag[];
}

export function TemplateFormDrawer({ open, onOpenChange, messageType, templateToEdit, tags }: TemplateFormDrawerProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = content;

    const newText = currentText.substring(0, start) + tag + currentText.substring(end);

    if (messageType === 'sms' && newText.length > 150) {
      toast.error('Inserting this variable would exceed the 150 character limit for SMS.');
      return;
    }

    setContent(newText);

    // Focus and move cursor after tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  useEffect(() => {
    if (open) {
      if (templateToEdit) {
        setName(templateToEdit.name);
        setSubject(templateToEdit.subject || '');
        setContent(templateToEdit.content);
      } else {
        setName('');
        setSubject('');
        setContent('');
      }
    }
  }, [open, templateToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (!content.trim()) {
      toast.error('Template content is required');
      return;
    }

    try {
      if (templateToEdit) {
        await updateMutation.mutateAsync({
          id: templateToEdit.id,
          updates: {
            name,
            subject: messageType === 'email' ? subject : undefined,
            content
          }
        });
        toast.success('Template updated successfully');
      } else {
        await createMutation.mutateAsync({
          name,
          type: messageType,
          subject: messageType === 'email' ? subject : undefined,
          content
        });
        toast.success('Template created successfully');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px] flex flex-col h-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{templateToEdit ? 'Edit Template' : 'Create New Template'}</SheetTitle>
          <SheetDescription>
            {templateToEdit
              ? `Update your ${messageType.toUpperCase()} template below.`
              : `Create a reusable ${messageType.toUpperCase()} template.`}
          </SheetDescription>
        </SheetHeader>

        <form id="template-form" onSubmit={handleSubmit} className="space-y-6 p-6 flex-1">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Welcome Message, Event Reminder"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
            />
          </div>

          {messageType === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="template-subject">Email Subject</Label>
              <Input
                id="template-subject"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e: any) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="template-content">Message Content</Label>
              <div className="flex items-center gap-4">
                <PersonalizationTags onInsertTag={handleInsertTag} tags={tags} />
                {messageType === 'sms' && (
                  <span className={`text-xs ${content.length > 150 ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                    {content.length} / 150 characters
                  </span>
                )}
              </div>
            </div>
            <Textarea
              id="template-content"
              ref={textareaRef}
              placeholder="Type your template message here..."
              className="min-h-[200px]"
              value={content}
              onChange={(e: any) => {
                if (messageType === 'sms' && e.target.value.length > 150) return;
                setContent(e.target.value);
              }}
            />
          </div>
        </form>

        <SheetFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button type="submit" form="template-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Template'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}