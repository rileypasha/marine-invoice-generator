import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  const validatePassword = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    if (!validatePassword()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Reset password error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = password.trim() && confirmPassword.trim() && !error && !success;

  if (success) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-8 rounded-2xl shadow-xl border bg-white">
          <CardContent className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
            <p className="text-gray-600 mb-4">
              Your password has been successfully reset. Redirecting to login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900 mt-6">Reset Your Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password below</p>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-6 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
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
              <p className="text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full h-12 px-4 pr-12 border-2 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 ${
                    error ? 'border-red-300' : 'border-gray-200'
                  }`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
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
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <a href="/login" className="text-[#1E3A5F] hover:text-[#152b47] font-medium transition-colors">
                Back to Login
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
