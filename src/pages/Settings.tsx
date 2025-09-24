import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button
} from '../components/magic/index';
import { Settings as SettingsIcon, User, Shield, Bell, Database, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
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

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Email Notifications
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Invoice Alerts
              </Button>
              <Button variant="outline" className="w-full justify-start">
                System Updates
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
    </div>
  );
};

export default Settings;