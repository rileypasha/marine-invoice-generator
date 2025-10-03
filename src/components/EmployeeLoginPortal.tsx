import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SimpleButton as Button } from './ui/simple-button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { useAuth } from '../context/AuthContext';

interface LoginFormData {
  email: string;
  password: string;
}

interface EmployeeLoginPortalProps {
  onLogin?: (credentials: LoginFormData) => void;
  companyName?: string;
  isLoading?: boolean;
}

const EmployeeLoginPortal: React.FC<EmployeeLoginPortalProps> = ({
  onLogin = () => {},
  companyName = "Global Invoicing",
  isLoading = false
}) => {
  const navigate = useNavigate();
  const { login, checkAuth } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const success = await login(formData.email, formData.password);

      if (success) {
        console.log('Login successful');
        onLogin(formData);

        // Wait briefly to ensure session cookie is fully established
        await new Promise(resolve => setTimeout(resolve, 100));

        navigate('/requests/new');
      } else {
        setError('Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed: Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetEmailSent(true);
      } else {
        setResetError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setResetError('Network error. Please try again.');
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetEmailSent(false);
    setResetError('');
  };

  const isFormValid = formData.email.trim() && formData.password.trim();

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 pb-20 md:pb-4">
      <Card className="w-full max-w-sm md:max-w-md p-8 md:p-12 rounded-2xl shadow-xl border bg-white">
        <CardHeader className="text-center p-0 mb-10 md:mb-12">
          <div className="flex justify-center mt-4 md:mt-4">
            <img
              src="/mgbw_logo.svg"
              alt="Marine Group Logo"
              className="w-64 md:w-80 h-auto object-contain"
            />
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-6 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="you@company.com"
                className={`w-full h-12 px-4 border-2 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 ${
                  error ? 'border-red-300' : 'border-gray-200'
                }`}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-[#1E3A5F] hover:text-[#152b47] font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  className={`w-full h-12 px-4 pr-12 border-2 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 ${
                    error ? 'border-red-300' : 'border-gray-200'
                  }`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full h-12 bg-[#1E3A5F] text-white font-semibold rounded-lg shadow-md hover:bg-[#152b47] hover:shadow-lg active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 mt-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <a href="mailto:rpasha@marinegroupbw.com" className="text-[#1E3A5F] hover:text-[#152b47] font-medium transition-colors">
                Contact Support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-8 rounded-2xl shadow-2xl border bg-white">
            <CardHeader className="text-center p-0 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
              <p className="text-gray-600 mt-2">
                {resetEmailSent
                  ? "Check your email for reset instructions"
                  : "Enter your email to receive a password reset link"}
              </p>
            </CardHeader>

            <CardContent>
              {resetEmailSent ? (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-700">
                    If an account exists with this email, you will receive password reset instructions shortly.
                  </p>
                  <button
                    onClick={handleCloseForgotPassword}
                    className="w-full h-12 bg-[#1E3A5F] text-white font-semibold rounded-lg shadow-md hover:bg-[#152b47] transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {resetError && (
                    <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                      {resetError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-semibold text-gray-700">
                      Email Address
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full h-12 px-4 border-2 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                      required
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleCloseForgotPassword}
                      className="flex-1 h-12 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!resetEmail.trim()}
                      className="flex-1 h-12 bg-[#1E3A5F] text-white font-semibold rounded-lg shadow-md hover:bg-[#152b47] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Send Reset Link
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EmployeeLoginPortal;