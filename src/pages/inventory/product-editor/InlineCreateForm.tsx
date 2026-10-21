import { useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Name field shown inside a picker popover to create an entry in place. */
export function InlineCreateForm({
  title,
  placeholder,
  initialValue = '',
  pending,
  onCreate,
  onCancel,
}: {
  title: string;
  placeholder: string;
  initialValue?: string;
  pending?: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValue);
  const trimmed = name.trim();

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel} aria-label="Back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (trimmed) onCreate(trimmed);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        autoFocus
        aria-label={title}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!trimmed || pending} onClick={() => onCreate(trimmed)}>
          {pending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Create
        </Button>
      </div>
    </div>
  );
}
