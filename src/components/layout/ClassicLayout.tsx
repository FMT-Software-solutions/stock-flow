import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../contexts/SidebarContext';

export function ClassicLayout() {
  const { isCollapsed, isMobile } = useSidebar();

  const getContentMargin = () => {
    if (isMobile) return 'ml-0';
    return isCollapsed ? 'ml-16' : 'ml-64';
  };

  const getHeaderPadding = () => {
    if (isMobile) return 'pl-0';
    return isCollapsed ? 'pl-16' : 'pl-64';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar is full height */}
      <Sidebar fullHeight />

      {/* Header offset */}
      <Header
        className={`${getHeaderPadding()} transition-all duration-300 ease-in-out`}
      />

      {/* Main content area */}
      <main
        className={`${getContentMargin()} pt-16 min-h-screen transition-all duration-300 ease-in-out`}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
