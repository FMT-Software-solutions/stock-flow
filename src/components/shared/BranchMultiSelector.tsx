import { useEffect, useMemo, useRef } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import MultipleSelector, { type Option } from '@/components/ui/multiselect';

interface BranchMultiSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function BranchMultiSelector({
  value,
  onChange,
  disabled,
  placeholder = 'Select branches',
}: BranchMultiSelectorProps) {
  const {
    availableBranches,
    selectedBranchIds: globalSelectedBranchIds,
    isLoading,
  } = useBranchContext();

  const initialized = useRef(false);

  // Filter available branches based on global selection
  // The internal selector should ONLY show branches that are currently selected in the global context.
  const validBranches = useMemo(() => {
    return availableBranches.filter((b) => globalSelectedBranchIds.includes(b.id));
  }, [availableBranches, globalSelectedBranchIds]);

  const options: Option[] = useMemo(() => 
    validBranches.map(b => ({
      value: b.id,
      label: b.name,
    })),
    [validBranches]
  );

  const selectedOptions = useMemo(() => 
    options.filter(o => value.includes(o.value)),
    [options, value]
  );

  // Validate selection and ensure defaults
  useEffect(() => {
    const validIds = validBranches.map(b => b.id);
    
    // 1. Filter out any selected IDs that are no longer valid in the global context
    const filteredSelection = value.filter(id => validIds.includes(id));

    // If we have invalid IDs in our value, we MUST clean them up immediately.
    if (filteredSelection.length !== value.length) {
      onChange(filteredSelection);
      return;
    }
    
    // 2. Initial Default Selection
    // Only select all if we haven't initialized yet and we have valid branches.
    // This prevents the "unselect all -> auto reselect" loop when user manually clears selection.
    if (!initialized.current && validIds.length > 0) {
      if (filteredSelection.length === 0) {
        onChange(validIds);
      }
      initialized.current = true;
    }
  }, [validBranches, value, onChange]);

  const handleChange = (newOptions: Option[]) => {
    onChange(newOptions.map(o => o.value));
  };

  if (isLoading) {
      return (
          <div className="w-full h-10 border rounded-md bg-muted animate-pulse" />
      )
  }

  return (
    <MultipleSelector
      value={selectedOptions}
      onChange={handleChange}
      defaultOptions={options}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      emptyIndicator={
        <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
          no results found.
        </p>
      }
    />
  );
}
