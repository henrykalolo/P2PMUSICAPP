'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Music, ArrowLeft, User, Upload, Save, X, Bell, Shield, Key, LogOut, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isArtist: boolean;
  artistBio?: string;
  artistGenres?: string[];
}

type SettingsTab = 'profile' | 'account' | 'privacy' | 'notifications';

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [formData, setFormData] = useState({
    username: '',
    avatarUrl: '',
    artistBio: '',
    artistGenres: [] as string[]
  });
  const [accountData, setAccountData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [privacyData, setPrivacyData] = useState({
    profileVisibility: 'public',
    showActivity: true,
    allowMessages: true
  });
  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newFollowers: true,
    newComments: true,
    newLikes: true
  });
  const [genreInput, setGenreInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user, setUser, setAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        localStorage.removeItem('token');
        return;
      }

      const data = await response.json();
      setProfile(data.user);
      setFormData({
        username: data.user.username,
        avatarUrl: data.user.avatarUrl || '',
        artistBio: data.user.artistBio || '',
        artistGenres: data.user.artistGenres || []
      });
      setAvatarPreview(data.user.avatarUrl || null);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ message: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP', type: 'error' });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setToast({ message: 'File too large. Maximum size is 5MB', type: 'error' });
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setToast({ message: 'Please log in again', type: 'error' });
        return;
      }

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', 'avatar');

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Update profile with new avatar URL
      const updateResponse = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          avatarUrl: `/api/storage/download?id=${data.id}&fileType=avatar`,
        }),
      });

      if (updateResponse.ok) {
        const updateData = await updateResponse.json();
        setProfile(updateData.user);
        setUser(updateData.user);
        setFormData(prev => ({ ...prev, avatarUrl: updateData.user.avatarUrl }));
        setToast({ message: 'Avatar uploaded successfully!', type: 'success' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setToast({ message: error instanceof Error ? error.message : 'Failed to upload avatar', type: 'error' });
      // Revert preview on error
      setAvatarPreview(profile?.avatarUrl || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatarUrl) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Update profile to remove avatar
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          avatarUrl: '',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setUser(data.user);
        setFormData(prev => ({ ...prev, avatarUrl: '' }));
        setAvatarPreview(null);
        setToast({ message: 'Avatar removed', type: 'success' });
      }
    } catch (error) {
      console.error('Remove avatar error:', error);
      setToast({ message: 'Failed to remove avatar', type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUpdating(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setUser(data.user);
        setToast({ message: 'Profile updated successfully!', type: 'success' });
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || 'Failed to update profile', type: 'error' });
      }
    } catch (error) {
      console.error('Update profile error:', error);
      setToast({ message: 'Failed to update profile', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (accountData.newPassword !== accountData.confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }

    if (accountData.newPassword.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' });
      return;
    }
    
    try {
      setIsChangingPassword(true);
      setToast(null);
      
      // Simulate password change - in real app, call API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setToast({ message: 'Password changed successfully!', type: 'success' });
      setAccountData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setToast({ message: 'Failed to change password', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      setToast(null);
      // Simulate privacy settings save - in real app, call API
      await new Promise(resolve => setTimeout(resolve, 500));
      setToast({ message: 'Privacy settings updated!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to update privacy settings', type: 'error' });
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setToast(null);
      // Simulate notification settings save - in real app, call API
      await new Promise(resolve => setTimeout(resolve, 500));
      setToast({ message: 'Notification preferences saved!', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to update notification preferences', type: 'error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    router.push('/');
  };

  const handleGenreAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && genreInput.trim()) {
      e.preventDefault();
      if (!formData.artistGenres.includes(genreInput.trim())) {
        setFormData(prev => ({
          ...prev,
          artistGenres: [...prev.artistGenres, genreInput.trim()]
        }));
      }
      setGenreInput('');
    }
  };

  const handleGenreRemove = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      artistGenres: prev.artistGenres.filter(g => g !== genre)
    }));
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">You need to be logged in to view profile settings</p>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Music className="h-5 w-5" />
            P2P Music
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-lg">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <User className="h-6 w-6" />
              Settings
            </h1>

            {/* Toast Notification */}
            {toast && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className="h-4 w-4">{toast.type === 'success' ? '✅' : '❌'}</div>
                <span>{toast.message}</span>
                <button 
                  onClick={() => setToast(null)}
                  className="ml-auto hover:opacity-70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b pb-4 overflow-x-auto">
              <Button
                variant={activeTab === 'profile' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('profile')}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
              <Button
                variant={activeTab === 'account' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('account')}
              >
                <Key className="h-4 w-4 mr-2" />
                Account
              </Button>
              <Button
                variant={activeTab === 'privacy' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('privacy')}
              >
                <Shield className="h-4 w-4 mr-2" />
                Privacy
              </Button>
              <Button
                variant={activeTab === 'notifications' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('notifications')}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    className="w-full"
                    minLength={3}
                    maxLength={30}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Username must be between 3 and 30 characters
                  </p>
                </div>

                {/* Avatar Upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Profile Picture
                  </label>
                  <div className="flex items-start gap-4">
                    {/* Avatar Preview */}
                    <div className="relative flex-shrink-0">
                      {avatarPreview ? (
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border">
                          <img 
                            src={avatarPreview} 
                            alt="Avatar preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                          <User className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    {/* Upload Controls */}
                    <div className="flex-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                      />
                      <div className="flex gap-2 mb-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                        >
                          {isUploadingAvatar ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload New
                            </>
                          )}
                        </Button>
                        
                        {avatarPreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={handleRemoveAvatar}
                            disabled={isUploadingAvatar}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a profile picture (JPG, PNG, GIF, WebP). Max 5MB.
                      </p>
                      
                      {/* Manual URL Input */}
                      <div className="mt-4">
                        <label className="block text-xs text-muted-foreground mb-1">
                          Or enter image URL
                        </label>
                        <Input
                          type="url"
                          value={formData.avatarUrl}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, avatarUrl: e.target.value }));
                            setAvatarPreview(e.target.value || null);
                          }}
                          placeholder="https://example.com/avatar.jpg"
                          className="w-full text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Artist Bio */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Artist Bio
                  </label>
                  <Textarea
                    value={formData.artistBio}
                    onChange={(e) => setFormData(prev => ({ ...prev, artistBio: e.target.value }))}
                    placeholder="Tell us about yourself as an artist..."
                    className="w-full min-h-[120px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.artistBio.length}/500 characters
                  </p>
                </div>

                {/* Artist Genres */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Genres
                  </label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      type="text"
                      value={genreInput}
                      onChange={(e) => setGenreInput(e.target.value)}
                      onKeyDown={handleGenreAdd}
                      placeholder="Add a genre"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (genreInput.trim() && !formData.artistGenres.includes(genreInput.trim())) {
                          setFormData(prev => ({
                            ...prev,
                            artistGenres: [...prev.artistGenres, genreInput.trim()]
                          }));
                          setGenreInput('');
                        }
                      }}
                      disabled={!genreInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {formData.artistGenres.map((genre, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
                      >
                        {genre}
                        <button
                          type="button"
                          onClick={() => handleGenreRemove(genre)}
                          className="hover:text-primary/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full"
                  >
                    {isUpdating ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Current Password
                      </label>
                      <Input
                        type="password"
                        value={accountData.currentPassword}
                        onChange={(e) => setAccountData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        New Password
                      </label>
                      <Input
                        type="password"
                        value={accountData.newPassword}
                        onChange={(e) => setAccountData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        className="w-full"
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Confirm New Password
                      </label>
                      <Input
                        type="password"
                        value={accountData.confirmPassword}
                        onChange={(e) => setAccountData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className="w-full"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isChangingPassword || !accountData.currentPassword || !accountData.newPassword}
                    >
                      {isChangingPassword ? 'Changing...' : 'Change Password'}
                    </Button>
                  </form>
                </div>

                <div className="pt-8 border-t">
                  <h3 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h3>
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                    <div>
                      <p className="font-medium">Logout of your account</p>
                      <p className="text-sm text-muted-foreground">You'll need to sign in again to access your account</p>
                    </div>
                    <Button variant="destructive" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Profile Visibility
                      </label>
                      <select
                        value={privacyData.profileVisibility}
                        onChange={(e) => setPrivacyData(prev => ({ ...prev, profileVisibility: e.target.value }))}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="public">Public - Anyone can view your profile</option>
                        <option value="followers">Followers Only - Only followers can view</option>
                        <option value="private">Private - Only you can view</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Show Activity Status</p>
                        <p className="text-sm text-muted-foreground">Let others see when you're online</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyData.showActivity}
                          onChange={(e) => setPrivacyData(prev => ({ ...prev, showActivity: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Allow Direct Messages</p>
                        <p className="text-sm text-muted-foreground">Let others send you private messages</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyData.allowMessages}
                          onChange={(e) => setPrivacyData(prev => ({ ...prev, allowMessages: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSavePrivacy}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Privacy Settings
                </Button>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.emailNotifications}
                          onChange={(e) => setNotificationData(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.pushNotifications}
                          onChange={(e) => setNotificationData(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">New Followers</p>
                        <p className="text-sm text-muted-foreground">Notify when someone follows you</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.newFollowers}
                          onChange={(e) => setNotificationData(prev => ({ ...prev, newFollowers: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">New Comments</p>
                        <p className="text-sm text-muted-foreground">Notify when someone comments on your tracks</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.newComments}
                          onChange={(e) => setNotificationData(prev => ({ ...prev, newComments: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">New Likes</p>
                        <p className="text-sm text-muted-foreground">Notify when someone likes your tracks</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.newLikes}
                          onChange={(e) => setNotificationData(prev => ({ ...prev, newLikes: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveNotifications}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Preferences
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
