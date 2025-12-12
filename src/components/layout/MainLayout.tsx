import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext';

function MainLayoutContent() {
  const { isCollapsed, isMobile } = useSidebar();

  // Calculate margin based on sidebar state
  const getMainMargin = () => {
    if (isMobile) return 'ml-0'; // No margin on mobile
    return isCollapsed ? 'ml-16' : 'ml-64'; // 16 for collapsed, 64 for expanded
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      {/* Main content area */}
      <main
        className={`${getMainMargin()} pt-16 min-h-screen transition-all duration-300 ease-in-out`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function MainLayout() {
  return (
    <SidebarProvider>
      <MainLayoutContent />
    </SidebarProvider>
  );
}
