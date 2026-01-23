import { Building2, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { OrganizationCreateForm } from '../components/shared/OrganizationCreateForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useOrganization } from '../contexts/OrganizationContext';
import { oklchToHex } from '../lib/utils';

export function OrganizationSelection() {
  const navigate = useNavigate();
  const {
    userOrganizations,
    isLoading,
    selectOrganization,
  } = useOrganization();
  const { resolvedTheme } = useTheme();

  const handleSelectOrganization = async (organizationId: string) => {
    await selectOrganization(organizationId);
    navigate('/dashboard');
  };

  const handleCreateSuccess = () => {
    // Organization is automatically selected after creation
    // Navigate to dashboard immediately
    navigate('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">
            Loading your organizations...
          </p>
        </div>
      </div>
    );
  }

  const renderEmptyState = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="p-6 border-2 border-dashed border-muted hover:border-muted-foreground transition-colors">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Organizations
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            You don't have any organizations yet. Create one to get started.
          </p>
          <OrganizationCreateForm
            trigger={
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Organization
              </Button>
            }
            onSuccess={handleCreateSuccess}
            dialogTitle="Create Your First Organization"
            dialogDescription="Create your organization to get started with the platform."
          />
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              Select Organization
            </h1>
          </div>
          <div className="flex items-center space-x-3 hidden">
            <OrganizationCreateForm
              trigger={
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden md:inline">
                    Create New Organization
                  </span>
                  <span className="md:hidden">Create New</span>
                </Button>
              }
              onSuccess={handleCreateSuccess}
            />
          </div>
        </div>

        {/* Horizontal line */}
        <hr className="border-border mb-8" />

        {/* Organization cards or empty state */}
        {userOrganizations.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {userOrganizations.map((org) => {
              // Apply organization's brand colors as CSS variables with fallbacks
              const primaryColor =
                resolvedTheme === 'dark'
                  ? org.brand_colors?.dark?.primary
                  : org.brand_colors?.light?.primary;
              const secondaryColor =
                resolvedTheme === 'dark'
                  ? org.brand_colors?.dark?.secondary
                  : org.brand_colors?.light?.secondary;
              const accentColor =
                resolvedTheme === 'dark'
                  ? org.brand_colors?.dark?.accent
                  : org.brand_colors?.light?.accent;

              const primaryHex = oklchToHex(primaryColor);

              const orgStyle: React.CSSProperties = {
                '--org-primary': primaryColor,
                '--org-secondary': secondaryColor,
                '--org-accent': accentColor,
              } as React.CSSProperties;

              return (
                <Card
                  key={org.id}
                  className="px-6 py-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:scale-105"
                  style={
                    {
                      ...orgStyle,
                      '--hover-border-color': `oklch(${primaryColor} / 0.4)`,
                    } as React.CSSProperties
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryHex + '66'; // Add alpha for 40% opacity
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '';
                  }}
                  onClick={() => handleSelectOrganization(org.id)}
                >
                  <div className="text-center">
                    {org.logo ? (
                      <img
                        src={org.logo}
                        alt={org.name}
                        className="h-16 w-16 rounded-lg object-cover mx-auto mb-4"
                      />
                    ) : (
                      <div
                        className="h-14 w-14 rounded-lg flex items-center justify-center mx-auto mb-4"
                        style={{
                          backgroundColor: primaryHex + '1A', // Add alpha for 10% opacity
                        }}
                      >
                        <Building2
                          className="h-8 w-8"
                          style={{
                            color: primaryHex,
                          }}
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-foreground text-lg mb-2">
                      {org.name}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize mb-4">
                      {org.user_role}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
