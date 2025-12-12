import { Outlet } from 'react-router-dom';
import { TopNavHeader } from './TopNavHeader';

export function TopNavLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNavHeader />
      <main className="pt-16 min-h-screen">
        <div className="container mx-auto p-6">
           <Outlet />
        </div>
      </main>
    </div>
  );
}
