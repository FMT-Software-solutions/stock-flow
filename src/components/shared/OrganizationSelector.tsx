import { useOrganization } from '../../contexts/OrganizationContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ChevronDown, Plus, Building2, Check } from 'lucide-react';
import { OrganizationCreateForm } from './OrganizationCreateForm';

export function OrganizationSelector() {
  const {
    currentOrganization,
    userOrganizations,
    isLoading,
    selectOrganization,
  } = useOrganization();

  const handleSelectOrganization = async (organizationId: string) => {
    await selectOrganization(organizationId);
  };

  const handleCreateSuccess = () => {
    // Organization is automatically selected after creation
    // No additional action needed
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <OrganizationCreateForm
        trigger={
          <Button variant="outline" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </Button>
        }
        onSuccess={handleCreateSuccess}
        dialogDescription="Create your first organization to get started."
      />
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center space-x-2 text-left hover:bg-muted/50"
          >
            <div className="flex items-center space-x-2">
              {currentOrganization.logo ? (
                <img
                  src={currentOrganization.logo}
                  alt={currentOrganization.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground truncate max-w-[250px">
                  {currentOrganization.name}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {userOrganizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelectOrganization(org.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                {org.logo ? (
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{org.name}</span>
                </div>
              </div>
              {currentOrganization.id === org.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <OrganizationCreateForm
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Organization
              </DropdownMenuItem>
            }
            onSuccess={handleCreateSuccess}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
