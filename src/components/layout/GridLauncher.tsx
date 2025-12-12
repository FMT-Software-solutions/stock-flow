import { Link } from 'react-router-dom';
import { navItems } from '@/config/navigation';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GridLauncherProps {
  onItemClick: () => void;
}

export function GridLauncher({ onItemClick }: GridLauncherProps) {
  const isDev = import.meta.env.DEV;
  const { checkPermission } = useRoleCheck();

  const filteredNavItems = navItems.filter((item) => {
    if (item.devOnly && !isDev) return false;
    if (item.permission) {
      return checkPermission(item.permission.scope, item.permission.action);
    }
    return true;
  });

  return (
    <div className="container mx-auto p-8 max-w-5xl animate-in fade-in zoom-in duration-300">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome Back</h1>
        <p className="text-muted-foreground text-lg">
          Select an application module to continue
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              className="block group"
            >
              <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-medium">
                    {item.label}
                  </CardTitle>
                  <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mt-4">
                    Access {item.label.toLowerCase()} module
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
