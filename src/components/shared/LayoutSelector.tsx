import React from 'react';
import { useLayoutStore, type LayoutMode } from '../../stores/layoutStore';
import { Label } from '../ui/label';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LayoutSelector() {
  const { layoutMode, setLayoutMode } = useLayoutStore();

  const layouts: { mode: LayoutMode; name: string; description: string; preview: React.ReactNode }[] = [
    {
      mode: 'sidebar',
      name: 'Modern Sidebar',
      description: 'Header on top, Sidebar below. Standard dashboard layout.',
      preview: (
        <div className="w-full h-24 bg-muted rounded-md relative overflow-hidden border shadow-sm">
           {/* Header */}
           <div className="absolute top-0 left-0 right-0 h-6 bg-primary/20 border-b border-primary/10"></div>
           {/* Sidebar */}
           <div className="absolute top-6 left-0 bottom-0 w-8 bg-primary/10 border-r border-primary/10"></div>
           {/* Content */}
           <div className="absolute top-6 left-8 right-0 bottom-0 bg-background p-2">
             <div className="w-full h-2 bg-muted-foreground/10 rounded mb-1"></div>
             <div className="w-2/3 h-2 bg-muted-foreground/10 rounded"></div>
           </div>
        </div>
      )
    },
    {
      mode: 'stacked',
      name: 'Classic Layout',
      description: 'Full height sidebar, Header offset to the right.',
      preview: (
         <div className="w-full h-24 bg-muted rounded-md relative overflow-hidden border shadow-sm">
           {/* Sidebar */}
           <div className="absolute top-0 left-0 bottom-0 w-8 bg-primary/10 border-r border-primary/10 z-10"></div>
           {/* Header */}
           <div className="absolute top-0 left-8 right-0 h-6 bg-primary/20 border-b border-primary/10"></div>
           {/* Content */}
           <div className="absolute top-6 left-8 right-0 bottom-0 bg-background p-2">
             <div className="w-full h-2 bg-muted-foreground/10 rounded mb-1"></div>
             <div className="w-2/3 h-2 bg-muted-foreground/10 rounded"></div>
           </div>
        </div>
      )
    },
    {
      mode: 'topnav',
      name: 'Top Navigation',
      description: 'Navigation in header. No sidebar. Best for simple apps.',
      preview: (
        <div className="w-full h-24 bg-muted rounded-md relative overflow-hidden border shadow-sm">
           {/* Header */}
           <div className="absolute top-0 left-0 right-0 h-6 bg-primary/20 border-b border-primary/10 flex items-center px-2 space-x-1">
             <div className="w-2 h-2 rounded-full bg-primary/40"></div>
             <div className="w-4 h-1.5 bg-primary/30 rounded"></div>
             <div className="w-4 h-1.5 bg-primary/30 rounded"></div>
           </div>
           {/* Content */}
           <div className="absolute top-6 left-0 right-0 bottom-0 bg-background p-2">
             <div className="w-full h-2 bg-muted-foreground/10 rounded mb-1"></div>
             <div className="w-2/3 h-2 bg-muted-foreground/10 rounded"></div>
           </div>
        </div>
      )
    },
    {
      mode: 'grid',
      name: 'Grid Menu (Kiosk)',
      description: 'Card-based navigation menu. Best for touch screens or kiosks.',
      preview: (
        <div className="w-full h-24 bg-muted rounded-md relative overflow-hidden border shadow-sm">
           {/* Header */}
           <div className="absolute top-0 left-0 right-0 h-6 bg-primary/20 border-b border-primary/10 flex items-center px-2">
             <div className="w-3 h-1.5 bg-primary/30 rounded"></div>
           </div>
           {/* Content */}
           <div className="absolute top-6 left-0 right-0 bottom-0 bg-background p-2 flex flex-wrap gap-1 justify-center items-center">
             <div className="w-6 h-6 bg-primary/10 rounded border border-primary/10"></div>
             <div className="w-6 h-6 bg-primary/10 rounded border border-primary/10"></div>
             <div className="w-6 h-6 bg-primary/10 rounded border border-primary/10"></div>
             <div className="w-6 h-6 bg-primary/10 rounded border border-primary/10"></div>
           </div>
        </div>
      )
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {layouts.map((layout) => (
        <div
          key={layout.mode}
          className={cn(
            "cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50 relative",
            layoutMode === layout.mode ? "border-primary bg-primary/5" : "border-muted bg-card hover:bg-accent/5"
          )}
          onClick={() => setLayoutMode(layout.mode)}
        >
          <div className="mb-4">
             {layout.preview}
          </div>
          <div className="flex items-center justify-between mb-1">
            <Label className="font-semibold cursor-pointer text-foreground">{layout.name}</Label>
            {layoutMode === layout.mode && <Check className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">{layout.description}</p>
        </div>
      ))}
    </div>
  );
}
