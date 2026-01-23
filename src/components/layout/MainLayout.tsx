import { SidebarProvider } from '../../contexts/SidebarContext';
import { useLayoutStore } from '../../stores/layoutStore';
import { ModernLayout } from './ModernLayout';
import { ClassicLayout } from './ClassicLayout';
import { TopNavLayout } from './TopNavLayout';
import { GridLayout } from './GridLayout';
import { useMediaQuery } from '../../hooks/use-media-query';

function MainLayoutContent() {
  const { layoutMode } = useLayoutStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <TopNavLayout />;
  }

  switch (layoutMode) {
    case 'grid':
      return <GridLayout />;
    case 'topnav':
      return <TopNavLayout />;
    case 'stacked':
      return <ClassicLayout />;
    case 'sidebar':
    default:
      return <ModernLayout />;
  }
}

export function MainLayout() {
  return (
    <SidebarProvider>
      <MainLayoutContent />
    </SidebarProvider>
  );
}
