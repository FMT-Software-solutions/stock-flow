import * as React from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableLabelProps<K extends string = string> {
  labelKey: K;
  text: string;
  onSave: (key: K, value: string) => Promise<void> | void;
  className?: string;
  editButtonClassName?: string;
}

export function EditableLabel<K extends string = string>({
  labelKey,
  text,
  onSave,
  className,
  editButtonClassName,
}: EditableLabelProps<K>) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(text);

  React.useEffect(() => {
    setValue(text);
  }, [text]);

  const handleSave = async () => {
    await onSave(labelKey, value.trim() || text);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-[200px]"
        />
        <Button
          aria-label="Save label"
          className="h-7 w-7 print:hidden"
          size="icon"
          variant="secondary"
          onClick={handleSave}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Cancel edit"
          className="h-7 w-7 print:hidden"
          size="icon"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setValue(text);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <span className="group inline-flex items-center gap-2">
      <span className={className}>{text}</span>
      <Button
        aria-label="Edit label"
        className={`h-7 w-7 print:hidden transition-opacity duration-150 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100 ${editButtonClassName || ''}`}
        size="icon"
        variant="ghost"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </span>
  );
}

export default EditableLabel;