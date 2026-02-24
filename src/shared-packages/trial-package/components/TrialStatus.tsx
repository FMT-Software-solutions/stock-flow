import { differenceInDays, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TrialStatusProps {
  trialEndDate: string | null;
  hasPurchased: boolean;
  className?: string;
}

export function TrialStatus({ trialEndDate, hasPurchased, className }: TrialStatusProps) {
  // If user has purchased, don't show trial status
  if (hasPurchased) return null;

  // If no trial date is set, don't show anything (or handle as needed)
  if (!trialEndDate) return null;

  const today = new Date();
  const end = parseISO(trialEndDate);
  const daysLeft = differenceInDays(end, today);

  let colorClass = 'text-zinc-500 dark:text-zinc-400'; // Default (> 7 days)

  if (daysLeft <= 3) {
    colorClass = 'text-red-600 font-bold dark:text-red-400';
  } else if (daysLeft <= 7) {
    colorClass = 'text-orange-600 font-medium dark:text-orange-400';
  }

  return (
    <div className={cn("text-xs transition-colors", colorClass, className)}>
      Trial ({Math.max(0, daysLeft)} Days)
    </div>
  );
}
