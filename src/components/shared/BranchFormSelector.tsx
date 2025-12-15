import { useEffect } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BranchFormSelectorProps {
  value?: string;
  onChange: (branchId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function BranchFormSelector({
  value,
  onChange,
  disabled,
  placeholder = 'Select branch',
}: BranchFormSelectorProps) {
  const { availableBranches, selectedBranchIds, isLoading } = useBranchContext();

  const hasSingleGlobalSelection = selectedBranchIds.length === 1;
  const userHasSingleBranch = availableBranches.length === 1;

  const options = hasSingleGlobalSelection
    ? availableBranches.filter((b) => selectedBranchIds.includes(b.id))
    : availableBranches;

  const defaultBranchId =
    hasSingleGlobalSelection
      ? selectedBranchIds[0]
      : userHasSingleBranch
      ? availableBranches[0]?.id
      : undefined;

  useEffect(() => {
    if (!value && defaultBranchId) {
      onChange(defaultBranchId);
    }
  }, [value, defaultBranchId, onChange]);

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading branches..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (options.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No branches" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

