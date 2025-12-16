import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAiUsage } from '@/hooks/useAiUsage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AiGeneratorButtonProps {
  onGenerate: (text: string) => void;
  context: {
    productName: string;
    categoryName?: string;
    additionalContext?: string;
  };
  children?: React.ReactNode; // Custom trigger button
  className?: string;
}

export function AiGeneratorButton({
  onGenerate,
  context,
  children,
  className,
}: AiGeneratorButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { currentOrganization } = useOrganization();
  const { usage, limit, incrementUsage, loading: usageLoading } = useAiUsage();

  const isLimitReached = !usageLoading && usage >= limit;

  const simulateTypewriter = (text: string) => {
    let index = 0;
    const speed = 10; // ms per char

    // Clear current text if needed, but usually we overwrite.
    // However, onGenerate sets the value in the form immediately.
    // If we want to animate it "typing" into the textarea, we need to call onGenerate repeatedly.

    // We can't guarantee the parent input is empty.
    // But usually for generation we replace content.

    const interval = setInterval(() => {
      if (index <= text.length) {
        onGenerate(text.substring(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission if inside a form

    if (!currentOrganization) {
      toast.error('Organization context missing');
      return;
    }

    if (isLimitReached) {
      toast.error('Daily AI generation limit reached for this organization.');
      return;
    }

    if (!context.productName) {
      toast.error('Product name is required for generation');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-description',
        {
          body: {
            organizationId: currentOrganization.id,
            productName: context.productName,
            categoryName: context.categoryName,
            additionalContext: context.additionalContext,
          },
        }
      );

      if (error) {
        // Handle specific error cases if possible
        // If the edge function returns a 429, invoke throws an error
        // We try to use the message from the error object
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.description) {
        simulateTypewriter(data.description);
        incrementUsage();
        const remaining = limit - (usage + 1);
        toast.success(
          `Description generated! ${
            remaining >= 0 ? `(${remaining} left today)` : ''
          }`
        );
      }
    } catch (error) {
      console.error('AI Generation Error:', error);
      let errorMessage = 'Failed to generate description';

      if (error instanceof Error) {
        errorMessage = error.message;
        // Try to parse JSON error message if it's in the message string
        try {
          const parsed = JSON.parse(error.message);
          if (parsed && parsed.error) errorMessage = parsed.error;
        } catch (e) {
          // Not a JSON string, keep original message
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  if (children) {
    return (
      <div
        onClick={!isGenerating && !isLimitReached ? handleGenerate : undefined}
        className={className}
      >
        {isGenerating ? (
          <Button disabled variant="ghost" size="icon" className="h-8 w-8">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </Button>
        ) : (
          children
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block">
            <Button
              variant="ghost"
              size="icon"
              className={className}
              onClick={handleGenerate}
              disabled={isGenerating || isLimitReached}
              type="button"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles
                  className={`h-4 w-4 ${
                    isLimitReached ? 'text-muted-foreground' : 'text-purple-500'
                  }`}
                />
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isLimitReached ? (
            <p>
              Daily limit reached ({limit}/{limit})
            </p>
          ) : (
            <p>
              Generate description with AI ({usage}/{limit} used)
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
