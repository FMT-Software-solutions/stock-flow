import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface PersonalizationTag {
  tag: string;
  label: string;
  description?: string;
}

export const DEFAULT_PERSONALIZATION_TAGS: PersonalizationTag[] = [
  { tag: '{first_name}', label: 'First Name', description: "Recipient's first name" },
  { tag: '{last_name}', label: 'Last Name', description: "Recipient's last name" },
  { tag: '{full_name}', label: 'Full Name', description: "Recipient's complete name" },
  { tag: '{email}', label: 'Email', description: "Recipient's email address" },
  { tag: '{phone}', label: 'Phone', description: "Recipient's phone number" },
  { tag: '{organization_name}', label: 'Organization Name', description: "Your church/organization's name" },
  { tag: '{organization_email}', label: 'Organization Email', description: "Your church/organization's email" },
  { tag: '{organization_phone}', label: 'Organization Phone', description: "Your church/organization's phone number" },
  { tag: '{organization_address}', label: 'Organization Address', description: "Your church/organization's address" },
];

interface PersonalizationTagsProps {
  onInsertTag: (tag: string) => void;
  disabled?: boolean;
  tags?: PersonalizationTag[];
}

export function PersonalizationTags({ onInsertTag, disabled, tags }: PersonalizationTagsProps) {
  const displayTags = tags || DEFAULT_PERSONALIZATION_TAGS;

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-xs"
                disabled={disabled}
                type="button"
              >
                {'{ } '}
                Insert Variable
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Insert personalized member details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-semibold text-sm">Personalization Variables</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Click a variable to insert it at your cursor position.
          </p>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 flex flex-col gap-1">
            {displayTags.map((item) => (
              <button
                key={item.tag}
                onClick={() => onInsertTag(item.tag)}
                className="flex flex-col items-start p-2 text-left text-sm rounded-md hover:bg-primary/10 transition-colors w-full"
              >
                <span className="font-medium text-primary">{item.tag}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
