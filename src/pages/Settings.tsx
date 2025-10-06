import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button
} from '../components/magic/index';
import { Settings as SettingsIcon, User, Bell, LogOut, X, Upload, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = '/api/v1';

type NotificationScope = 'none' | 'own' | 'all';

interface NotificationPreferences {
  notifyOnNewInvoice: NotificationScope;
  notifyOnApproval: NotificationScope;
  notifyOnChangeRequest: NotificationScope;
}

interface ProfileData {
  name: string;
  email: string;
  avatarFile?: File | null;
  avatarUrl?: string;
}

const Settings: React.FC = () => {
  const { logout, csrfToken, currentUser, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState<'created' | 'changed' | 'approved' | 'profile' | 'password' | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notifyOnNewInvoice: 'none',
    notifyOnApproval: 'none',
    notifyOnChangeRequest: 'none'
  });
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    avatarFile: null,
    avatarUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchPreferences();
    if (currentUser) {
      setProfileData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        avatarFile: null
      });
    }
  }, [currentUser]);

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/notifications`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: NotificationScope) => {
    if (!csrfToken) {
      alert('Session expired. Please refresh the page and try again.');
      return;
    }

    setLoading(true);
    try {
      const requestBody = {
        notifyOnNewInvoice: key === 'notifyOnNewInvoice' ? value : preferences.notifyOnNewInvoice,
        notifyOnChangeRequest: key === 'notifyOnChangeRequest' ? value : preferences.notifyOnChangeRequest,
        notifyOnApproval: key === 'notifyOnApproval' ? value : preferences.notifyOnApproval
      };

      console.log('Sending notification preference update:', requestBody);

      const response = await fetch(`${API_BASE_URL}/settings/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const updatedPreferences = await response.json();
        setPreferences(updatedPreferences);
        // Small delay to show the selection before closing
        setTimeout(() => setShowModal(null), 300);
      } else {
        console.error('Failed to update notification preference:', await response.text());
        alert('Failed to update notification preference. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      alert('Failed to update notification preference. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getPreferenceLabel = (value: NotificationScope): string => {
    switch (value) {
      case 'all': return 'Everyone\'s invoices';
      case 'own': return 'Only my invoices';
      case 'none': return 'None';
      default: return 'None';
    }
  };

  const getPreferenceKey = (type: 'created' | 'changed' | 'approved'): keyof NotificationPreferences => {
    switch (type) {
      case 'created': return 'notifyOnNewInvoice';
      case 'changed': return 'notifyOnChangeRequest';
      case 'approved': return 'notifyOnApproval';
    }
  };

  const getCurrentValue = (type: 'created' | 'changed' | 'approved'): NotificationScope => {
    return preferences[getPreferenceKey(type)];
  };

  const updatePassword = async () => {
    if (!csrfToken) {
      setNotification({ type: 'error', message: 'Session expired. Please refresh the page and try again.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setNotification({ type: 'error', message: 'All fields are required.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotification({ type: 'error', message: 'New passwords do not match.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setNotification({ type: 'error', message: 'New password must be at least 8 characters long.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/settings/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        setShowModal(null);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setNotification({ type: 'success', message: 'Password updated successfully!' });
        setTimeout(() => setNotification(null), 5000);
      } else {
        const error = await response.json();
        setNotification({ type: 'error', message: error.message || 'Failed to update password. Please try again.' });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      console.error('Failed to update password:', error);
      setNotification({ type: 'error', message: 'Failed to update password. Please try again.' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    if (!csrfToken) {
      setNotification({ type: 'error', message: 'Session expired. Please refresh the page and try again.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', profileData.name);
      formData.append('email', profileData.email);
      if (profileData.avatarFile) {
        formData.append('avatar', profileData.avatarFile);
      }

      const response = await fetch(`${API_BASE_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        await checkAuth(); // Refresh user data
        setShowModal(null);
        setNotification({ type: 'success', message: 'Profile updated successfully!' });
        setTimeout(() => setNotification(null), 5000);
      } else {
        const error = await response.json();
        setNotification({ type: 'error', message: error.message || 'Failed to update profile. Please try again.' });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setNotification({ type: 'error', message: 'Failed to update profile. Please try again.' });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <SettingsIcon className="h-6 w-6 mr-3 text-gray-600" />
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Account
            </CardTitle>
            <CardDescription>
              Manage your profile and account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setProfileData({
                    name: currentUser?.name || '',
                    email: currentUser?.email || '',
                    avatarFile: null,
                    avatarUrl: currentUser?.avatarUrl || ''
                  });
                  setShowModal('profile');
                }}
              >
                Profile Information
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowModal('password')}
              >
                Change Password
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Configure email notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowModal('created')}
              >
                <span>Invoice Created</span>
                <span className="text-xs text-gray-500">{getPreferenceLabel(getCurrentValue('created'))}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowModal('changed')}
              >
                <span>Invoice Changed</span>
                <span className="text-xs text-gray-500">{getPreferenceLabel(getCurrentValue('changed'))}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowModal('approved')}
              >
                <span>Invoice Approved</span>
                <span className="text-xs text-gray-500">{getPreferenceLabel(getCurrentValue('approved'))}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Edit Modal */}
      {showModal === 'profile' && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            margin: 0,
            padding: 0
          }}
          onClick={() => setShowModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Edit Profile</h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-3">
                    {/* Show current avatar if exists */}
                    {(profileData.avatarUrl || profileData.avatarFile) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                        <img
                          src={profileData.avatarFile ? URL.createObjectURL(profileData.avatarFile) : profileData.avatarUrl}
                          alt="Current avatar"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-green-700">
                            {profileData.avatarFile ? 'New image selected' : 'Current avatar'}
                          </span>
                          {profileData.avatarFile && (
                            <span className="text-xs text-gray-600">
                              {profileData.avatarFile.name}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <Upload className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        {profileData.avatarUrl || profileData.avatarFile ? 'Change Image' : 'Choose Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProfileData({ ...profileData, avatarFile: file });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {profileData.avatarUrl || profileData.avatarFile
                      ? 'You can upload a new image to replace your current avatar'
                      : 'Upload an image for your profile picture (optional)'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(null)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={updateProfile}
                  disabled={loading}
                  className="bg-[#1E3A5F] hover:bg-[#152b47] text-white"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Change Password Modal */}
      {showModal === 'password' && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            margin: 0,
            padding: 0
          }}
          onClick={() => setShowModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(null);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={updatePassword}
                  disabled={loading}
                  className="bg-[#1E3A5F] hover:bg-[#152b47] text-white"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Preference Modal */}
      {(showModal === 'created' || showModal === 'changed' || showModal === 'approved') && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            margin: 0,
            padding: 0
          }}
          onClick={() => setShowModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                {showModal === 'created' && 'Invoice Created Notifications'}
                {showModal === 'changed' && 'Invoice Changed Notifications'}
                {showModal === 'approved' && 'Invoice Approved Notifications'}
              </h3>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Choose when you want to receive email notifications for this event:
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => updatePreference(getPreferenceKey(showModal), 'all')}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    getCurrentValue(showModal) === 'all'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium">Everyone's invoices</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Get notified for all invoices in the system
                  </div>
                </button>
                <button
                  onClick={() => updatePreference(getPreferenceKey(showModal), 'own')}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    getCurrentValue(showModal) === 'own'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium">Only my invoices</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Get notified only for invoices you created
                  </div>
                </button>
                <button
                  onClick={() => updatePreference(getPreferenceKey(showModal), 'none')}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    getCurrentValue(showModal) === 'none'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium">None</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Don't send me notifications for this event
                  </div>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button
                variant="outline"
                onClick={() => setShowModal(null)}
                disabled={loading}
              >
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success/Error Notification */}
      {notification && createPortal(
        <div
          className="fixed top-4 right-4 z-[10000] animate-slide-in"
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg min-w-[300px] ${
              notification.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {notification.message}
            </span>
            <button
              onClick={() => setNotification(null)}
              className={`ml-auto flex-shrink-0 ${
                notification.type === 'success'
                  ? 'text-green-600 hover:text-green-800'
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Settings;