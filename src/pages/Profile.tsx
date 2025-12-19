import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { AvatarPicker } from '../components/shared/AvatarPicker';
import { DateOfBirthPicker } from '../components/shared/DateOfBirthPicker';
import { toast } from 'sonner';
import { Loader2, Save, User } from 'lucide-react';
import type { Profile } from '../types/user-management';

export function Profile() {
  const { user, initializeUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    avatar: '',
    gender: '',
    date_of_birth: '',
  });

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        first_name: user.profile.first_name || '',
        last_name: user.profile.last_name || '',
        email: user.profile.email || '',
        phone: user.profile.phone || '',
        avatar: user.profile.avatar || '',
        gender: user.profile.gender || '',
        date_of_birth: user.profile.date_of_birth || '',
      });
    }
  }, [user]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAvatarChange = (avatarUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      avatar: avatarUrl,
    }));
  };

  const handleSaveProfile = async () => {
    if (!user?.profile?.id) {
      toast.error('User profile not found');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name.trim() || null,
          last_name: formData.last_name.trim() || null,
          phone: formData.phone.trim() || null,
          avatar: formData.avatar || null,
          gender: formData.gender || null,
          date_of_birth: formData.date_of_birth || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.profile.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile');
        return;
      }

      // Refresh user data to reflect changes
      await initializeUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSave = async (avatarUrl: string) => {
    if (!user?.profile?.id) {
      throw new Error('User profile not found');
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        avatar: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.profile.id);

    if (error) {
      console.error('Error updating avatar:', error);
      throw new Error('Failed to update avatar');
    }

    // Refresh user data to reflect changes
    await initializeUser();
    toast.success('Avatar updated successfully');
  };

  if (!user?.profile) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-2">
          <User className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Profile Settings</h1>
        </div>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>
              Choose an avatar to represent your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <AvatarPicker
                value={formData.avatar}
                onChange={handleAvatarChange}
                onSave={handleAvatarSave}
                firstName={formData.first_name}
                lastName={formData.last_name}
                size="xl"
              />
              <div className="text-sm text-muted-foreground">
                Click the edit icon to change your avatar
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    handleInputChange('first_name', e.target.value)
                  }
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    handleInputChange('last_name', e.target.value)
                  }
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <DateOfBirthPicker
                  value={formData.date_of_birth}
                  onChange={(date) => handleInputChange('date_of_birth', date)}
                  label="Date of Birth"
                  placeholder="Select date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="min-w-30"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
