import { TrialStatus as SharedTrialStatus } from '@/shared-packages/trial-package';

interface TrialStatusProps {
  trialEndDate: string | null;
  hasPurchased: boolean;
  className?: string;
}

export function TrialStatus({ trialEndDate, hasPurchased, className }: TrialStatusProps) {
  return (
    <SharedTrialStatus 
      trialEndDate={trialEndDate} 
      hasPurchased={hasPurchased} 
      className={className} 
    />
  );
}
