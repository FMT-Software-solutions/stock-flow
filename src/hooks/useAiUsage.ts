import { useAiUsage as useAiUsageContext } from '@/contexts/AiUsageContext';

// Re-export the hook from context for backward compatibility and cleaner imports
export function useAiUsage() {
  return useAiUsageContext();
}
