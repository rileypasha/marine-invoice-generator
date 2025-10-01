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
import { Settings as SettingsIcon, User, Shield, Bell, Database, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = '/api/v1';

type NotificationScope = 'none' | 'own' | 'all';

interface NotificationPreferences {
  notifyOnNewInvoice: NotificationScope;
  notifyOnApproval: NotificationScope;
  notifyOnChangeRequest: NotificationScope;
}

const Settings: React.FC = () => {
  const { logout, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState<'created' | 'changed' | 'approved' | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notifyOnNewInvoice: 'none',
    notifyOnApproval: 'none',
    notifyOnChangeRequest: 'none'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

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
              <Button variant="outline" className="w-full justify-start">
                Profile Information
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Email Preferences
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

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Security
            </CardTitle>
            <CardDescription>
              Configure security and access settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Two-Factor Authentication
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Session Management
              </Button>
              <Button variant="outline" className="w-full justify-start">
                API Keys
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

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              System
            </CardTitle>
            <CardDescription>
              Configure system-wide settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Data Export
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Backup Settings
              </Button>
              <Button variant="outline" className="w-full justify-start">
                System Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Notice */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <SettingsIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Configuration</h3>
            <p className="text-gray-500 mb-4">
              Detailed settings configuration is coming soon. This page will allow you to customize
              your Marine Group experience and manage system preferences.
            </p>
            <Button variant="outline">
              Request Feature
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preference Modal */}
      {showModal && createPortal(
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
    </div>
  );
};

export default Settings;