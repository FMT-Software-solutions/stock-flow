import { Bell, Building2, Download, Palette, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  uploadLogo,
  deleteLogo,
  extractFilePathFromUrl,
  validateLogoFile,
} from '../utils/logo-upload';

import { LogoCropper } from '../components/shared/LogoCropper';
import { ModernFileUpload } from '../components/shared/ModernFileUpload';
import { OrganizationLogo } from '../components/shared/OrganizationLogo';
import { LayoutSelector } from '../components/shared/LayoutSelector';
import { ThemeSelector } from '../components/shared/ThemeSelector';
import { ThemeSwitcher } from '../components/shared/ThemeSwitcher';
import { RolesSettings } from './settings/RolesSettings';
import { UpdateSettings } from '../modules/auto-update/UpdateSettings';
import type { UpdateOrganizationData } from '../types/organizations';
import { toast } from 'sonner';
import { isElectron } from '../utils/asset-path';
import { useRoleCheck } from '../components/auth/RoleGuard';
import { Shield } from 'lucide-react';

export function Settings() {
  const { currentOrganization, updateOrganization } = useOrganization();
  const { checkPermission, isOwner } = useRoleCheck();

  const canManageOrgDetails = checkPermission('settings', 'manage_org_details');
  const canViewAppearance = checkPermission(
    'settings',
    'view_org_appearance_prefs'
  );
  const canManageNotifications = checkPermission(
    'settings',
    'manage_notifications'
  );

  // Only owners can manage roles and permissions configuration
  const canManageRoles = isOwner();

  const [orgData, setOrgData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'GHS',
  });
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    roleChanges: true,
    securityAlerts: true,
    appUpdates: true,
    newUserAdded: true,
  });
  const [isSavingOrgData, setIsSavingOrgData] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Load organization data on mount
  useEffect(() => {
    if (currentOrganization) {
      setOrgData({
        name: currentOrganization.name || '',
        email: currentOrganization.email || '',
        phone: currentOrganization.phone || '',
        address: currentOrganization.address || '',
        currency: currentOrganization.currency || 'GHS',
      });
      // Logo settings are no longer needed - always square orientation
      setNotificationSettings({
        roleChanges:
          currentOrganization.notification_settings?.roleChanges ?? true,
        securityAlerts:
          currentOrganization.notification_settings?.securityAlerts ?? true,
        appUpdates:
          currentOrganization.notification_settings?.appUpdates ?? true,
        newUserAdded:
          currentOrganization.notification_settings?.newUserAdded ?? true,
      });
    }
  }, [currentOrganization]);

  // Helper function to compare organization data
  const hasOrganizationDataChanged = () => {
    if (!currentOrganization) return false;

    return (
      orgData.name !== (currentOrganization.name || '') ||
      orgData.email !== (currentOrganization.email || '') ||
      orgData.phone !== (currentOrganization.phone || '') ||
      orgData.address !== (currentOrganization.address || '') ||
      orgData.currency !== (currentOrganization.currency || 'GHS')
    );
  };

  // Helper function to compare notification settings
  const hasNotificationSettingsChanged = () => {
    if (!currentOrganization?.notification_settings) return true;

    const current = currentOrganization.notification_settings;
    return (
      notificationSettings.roleChanges !== (current.roleChanges ?? true) ||
      notificationSettings.securityAlerts !==
        (current.securityAlerts ?? true) ||
      notificationSettings.appUpdates !== (current.appUpdates ?? true) ||
      notificationSettings.newUserAdded !== (current.newUserAdded ?? true)
    );
  };

  const handleSaveOrganizationDetails = async () => {
    if (!currentOrganization) return;

    // Check if data has actually changed
    if (!hasOrganizationDataChanged()) {
      toast.info('No new changes detected');
      return;
    }

    setIsSavingOrgData(true);
    try {
      const updateData: UpdateOrganizationData = {
        id: currentOrganization.id,
        ...orgData,
      };

      await updateOrganization(updateData);
      toast.success('Organization details updated successfully');
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization details');
    } finally {
      setIsSavingOrgData(false);
    }
  };

  const handleUpdateNotificationSettings = async () => {
    if (!currentOrganization) return;

    // Check if notification settings have actually changed
    if (!hasNotificationSettingsChanged()) {
      toast.info('No changes made');
      return;
    }

    setIsSavingOrgData(true);
    try {
      const updateData: UpdateOrganizationData = {
        id: currentOrganization.id,
        notification_settings: notificationSettings,
      };

      await updateOrganization(updateData);
      toast.success('Notification settings updated successfully');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error('Failed to update notification settings');
    } finally {
      setIsSavingOrgData(false);
    }
  };

  const handleLogoFileSelect = (file: File) => {
    // Clear previous errors
    setLogoError(null);

    // Validate file
    const validation = validateLogoFile(file);
    if (!validation.isValid) {
      setLogoError(validation.error || 'Invalid file');
      return;
    }

    // Set the selected file and open cropper
    setSelectedImageFile(file);
    setIsCropperOpen(true);
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!currentOrganization || !updateOrganization) {
      setLogoError('No organization selected');
      return;
    }

    setIsUploadingLogo(true);
    setLogoError(null);

    try {
      // Delete existing logo if it exists
      if (currentOrganization.logo) {
        const filePath = extractFilePathFromUrl(currentOrganization.logo);
        if (filePath) {
          try {
            await deleteLogo(filePath);
          } catch (deleteError) {
            console.warn('Failed to delete existing logo:', deleteError);
            // Continue with upload even if deletion fails
          }
        }
      }

      // Upload cropped image to Supabase storage
      const uploadResult = await uploadLogo(
        croppedFile,
        currentOrganization.id
      );

      // Update organization with new logo URL
      await updateOrganization({
        id: currentOrganization.id,
        logo: uploadResult.url,
      });

      toast.success('Logo uploaded successfully');

      // Close cropper
      setIsCropperOpen(false);
      setSelectedImageFile(null);
    } catch (error) {
      console.error('Error uploading logo:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      setLogoError(errorMessage);
      toast.error(`Failed to upload logo: ${errorMessage}`);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCropperClose = () => {
    setIsCropperOpen(false);
    setSelectedImageFile(null);
  };

  const handleRemoveLogo = async () => {
    if (!currentOrganization || !updateOrganization) {
      setLogoError('No organization selected');
      return;
    }

    setLogoError(null);
    setIsUploadingLogo(true);

    try {
      // If there's a logo URL, try to delete it from storage
      if (currentOrganization.logo) {
        const filePath = extractFilePathFromUrl(currentOrganization.logo);
        if (filePath) {
          try {
            await deleteLogo(filePath);
          } catch (deleteError) {
            console.warn(
              'Failed to delete logo file from storage:',
              deleteError
            );
            // Continue with database update even if file deletion fails
          }
        }
      }

      // Update organization to remove logo
      await updateOrganization({
        id: currentOrganization.id,
        logo: null,
      });

      toast.success('Logo removed successfully');
    } catch (error) {
      console.error('Error removing logo:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to remove logo';
      setLogoError(errorMessage);
      toast.error(`Failed to remove logo: ${errorMessage}`);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const visibleTabsCount = [
    canManageOrgDetails,
    canViewAppearance,
    canManageRoles,
    canManageNotifications,
    isElectron(),
  ].filter(Boolean).length;

  const gridColsClass =
    {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
    }[visibleTabsCount] || 'grid-cols-4';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your organization details, branding, and preferences
          </p>
        </div>
      </div>

      <Tabs
        defaultValue={
          canManageOrgDetails
            ? 'organization'
            : canViewAppearance
            ? 'appearance'
            : canManageNotifications
            ? 'notifications'
            : 'organization'
        }
        className="space-y-6"
      >
        <TabsList className={`grid w-full ${gridColsClass}`}>
          {canManageOrgDetails && (
            <TabsTrigger
              value="organization"
              className="flex items-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Organization Details</span>
            </TabsTrigger>
          )}
          {canViewAppearance && (
            <TabsTrigger
              value="appearance"
              className="flex items-center space-x-2"
            >
              <Palette className="h-4 w-4" />
              <span>Appearance</span>
            </TabsTrigger>
          )}

          {canManageRoles && (
            <TabsTrigger value="roles" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Roles & Permissions</span>
            </TabsTrigger>
          )}
          {canManageNotifications && (
            <TabsTrigger
              value="notifications"
              className="flex items-center space-x-2"
            >
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
          )}

          {isElectron() && (
            <TabsTrigger
              value="updates"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Updates</span>
            </TabsTrigger>
          )}
        </TabsList>

        {canManageOrgDetails && (
          <TabsContent value="organization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  Basic information about your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={orgData.name}
                      onChange={(e) =>
                        setOrgData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={orgData.email}
                      onChange={(e) =>
                        setOrgData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Enter organization email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={orgData.phone}
                      onChange={(e) =>
                        setOrgData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={orgData.currency}
                      onValueChange={(value) =>
                        setOrgData((prev) => ({ ...prev, currency: value }))
                      }
                    >
                      <SelectTrigger className="min-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GHS">GHS</SelectItem>
                        {/* <SelectItem value="USD">USD</SelectItem> */}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={orgData.address}
                    onChange={(e) =>
                      setOrgData((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    placeholder="Enter organization address"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveOrganizationDetails}
                    disabled={isSavingOrgData}
                    className="flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>
                      {isSavingOrgData ? 'Saving...' : 'Save Changes'}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Logo Cropper Dialog */}
            <LogoCropper
              isOpen={isCropperOpen}
              onClose={handleCropperClose}
              onCropComplete={handleCropComplete}
              imageFile={selectedImageFile}
              isUploading={isUploadingLogo}
            />

            <Card>
              <CardHeader>
                <CardTitle>Organization Logo</CardTitle>
                <CardDescription>
                  Upload and configure your organization's logo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start space-x-6">
                  <div className="flex flex-col items-center space-y-4">
                    <OrganizationLogo
                      src={currentOrganization?.logo}
                      fallback={<Building2 />}
                      size="xl"
                      orientation="square"
                      backgroundSize="contain"
                      className="border-2 border-dashed border-border"
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <ModernFileUpload
                        onFileSelect={handleLogoFileSelect}
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        disabled={isUploadingLogo}
                        maxSize={2}
                        className="mt-2 max-w-[300px]"
                        variant="compact"
                      >
                        {isUploadingLogo && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                            <div className="text-sm text-primary font-medium">
                              Uploading logo...
                            </div>
                          </div>
                        )}
                      </ModernFileUpload>

                      {logoError && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mt-2">
                          {logoError}
                        </div>
                      )}
                    </div>
                    {currentOrganization?.logo && (
                      <Button
                        variant="outline"
                        onClick={handleRemoveLogo}
                        disabled={isUploadingLogo}
                        className="flex items-center space-x-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Remove Logo</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewAppearance && (
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme Settings</CardTitle>
                <CardDescription>
                  Switch between light and dark modes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeSwitcher />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Layout Selection</CardTitle>
                <CardDescription>
                  Choose how the application navigation and structure appears
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LayoutSelector />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Theme Selection</CardTitle>
                <CardDescription>
                  Choose from predefined themes, custom themes, or create custom
                  colors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ThemeSelector />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageNotifications && (
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure which notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="roleChanges"
                      className="text-base font-medium"
                    >
                      Role Changes
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when user roles are modified
                    </p>
                  </div>
                  <Switch
                    id="roleChanges"
                    checked={notificationSettings.roleChanges}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        roleChanges: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="securityAlerts"
                      className="text-base font-medium"
                    >
                      Security Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Important security notifications and alerts
                    </p>
                  </div>
                  <Switch
                    id="securityAlerts"
                    checked={notificationSettings.securityAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        securityAlerts: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="appUpdates"
                      className="text-base font-medium"
                    >
                      App Updates
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications about new features and updates
                    </p>
                  </div>
                  <Switch
                    id="appUpdates"
                    checked={notificationSettings.appUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        appUpdates: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="newUserAdded"
                      className="text-base font-medium"
                    >
                      New User Added
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a new user joins the organization
                    </p>
                  </div>
                  <Switch
                    id="newUserAdded"
                    checked={notificationSettings.newUserAdded}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        newUserAdded: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleUpdateNotificationSettings}
                    disabled={isSavingOrgData}
                    className="flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>
                      {isSavingOrgData ? 'Saving...' : 'Save Changes'}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageRoles && (
          <TabsContent value="roles" className="space-y-6">
            <RolesSettings />
          </TabsContent>
        )}

        {isElectron() && (
          <TabsContent value="updates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Software Updates</CardTitle>
                <CardDescription>
                  Check for application updates and install new versions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UpdateSettings />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
