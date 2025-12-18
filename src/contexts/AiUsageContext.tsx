import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/utils/supabase';
import { useOrganization } from './OrganizationContext';

interface AiUsageContextType {
  usage: number;
  limit: number;
  loading: boolean;
  refreshUsage: () => Promise<void>;
  incrementUsage: () => void;
}

const AiUsageContext = createContext<AiUsageContextType | undefined>(undefined);

interface AiUsageProviderProps {
  children: ReactNode;
}

export function AiUsageProvider({ children }: AiUsageProviderProps) {
  const { currentOrganization } = useOrganization();
  const [usage, setUsage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Get limit from organization context, default to 20 if not available yet
  const limit = currentOrganization?.ai_daily_limit ?? 20;

  const fetchUsage = useCallback(async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('organization_ai_usage')
        .select('request_count')
        .eq('organization_id', currentOrganization.id)
        .eq('usage_date', today)
        .limit(1);

      if (error) {
        console.error('Error fetching AI usage:', error);
      }

      setUsage(data?.[0]?.request_count || 0);
    } catch (error) {
      console.error('Error in AiUsageProvider:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const incrementUsage = useCallback(() => {
    setUsage(prev => prev + 1);
  }, []);

  const value = {
    usage,
    limit,
    loading,
    refreshUsage: fetchUsage,
    incrementUsage
  };

  return (
    <AiUsageContext.Provider value={value}>
      {children}
    </AiUsageContext.Provider>
  );
}

export function useAiUsage() {
  const context = useContext(AiUsageContext);
  if (context === undefined) {
    throw new Error('useAiUsage must be used within an AiUsageProvider');
  }
  return context;
}
