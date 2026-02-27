import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginFormData {
  email: string;
  password: string;
}

interface EmployeeLoginPortalProps {
  onLogin?: (credentials: LoginFormData) => void;
  companyName?: string;
  isLoading?: boolean;
}

const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 }
  }
};

const formItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } }
};

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
    <div className="fixed inset-0 flex flex-col md:grid md:grid-cols-2">

      {/* ── Desktop Hero Panel ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden md:flex relative flex-col items-center justify-center overflow-visible bg-gradient-to-br from-[#0F1D30] via-[#1E3A5F] to-[#162D4A]"
      >
        <div className="relative z-10 flex flex-col items-center text-center px-16">
          <motion.img
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            src="/marine_group_global_services_vector_logo.svg"
            alt="Marine Group Global Services"
            className="w-80 max-w-full h-auto brightness-0 invert"
          />
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="w-12 h-px bg-white/25 mt-8"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-white/60 text-sm font-light tracking-widest uppercase mt-6"
          >
            Invoicing Portal
          </motion.p>
        </div>
      </motion.div>

      {/* ── Mobile Header ── */}
      <div className="flex md:hidden items-center justify-center py-8 px-6 bg-gradient-to-r from-[#0F1D30] to-[#1E3A5F]">
        <img
          src="/marine_group_global_services_vector_logo.svg"
          alt="Marine Group Global Services"
          className="w-64 h-auto brightness-0 invert"
        />
      </div>

      {/* ── Form Panel ── */}
      <div className="flex-1 grid place-items-center px-6 py-10 md:py-0 overflow-y-auto md:overflow-visible bg-white">
        <motion.div
          variants={formContainerVariants}
          initial="hidden"
          animate="visible"
          className="w-[384px] max-w-[calc(100%-3rem)] pb-20 md:pb-0"
        >
          <motion.div variants={formItemVariants}>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 mb-8">
              Enter your credentials to continue
            </p>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
              >
                <span className="flex-1">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div variants={formItemVariants} className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="you@company.com"
                className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 ${
                  error ? 'border-red-300' : 'border-slate-300'
                }`}
                disabled={isSubmitting}
              />
            </motion.div>

            <motion.div variants={formItemVariants} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-[#1E3A5F] hover:text-[#152b47] font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  className={`w-full h-11 px-4 pr-12 rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 ${
                    error ? 'border-red-300' : 'border-slate-300'
                  }`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </motion.div>

            <motion.div variants={formItemVariants}>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full h-11 bg-[#1E3A5F] text-white font-semibold rounded-lg hover:bg-[#162D4A] hover:shadow-lg hover:shadow-[#1E3A5F]/20 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 mt-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </motion.div>
          </form>

          <motion.div variants={formItemVariants} className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Need help?{' '}
              <a href="mailto:rpasha@marinegroupbw.com" className="text-[#1E3A5F] hover:text-[#152b47] font-medium transition-colors">
                Contact Support
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Forgot Password Modal ── */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="w-full max-w-md p-8 rounded-2xl shadow-2xl border bg-white">
                <CardHeader className="text-center p-0 mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
                  <p className="text-slate-500 mt-2">
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
                      <p className="text-slate-600">
                        If an account exists with this email, you will receive password reset instructions shortly.
                      </p>
                      <button
                        onClick={handleCloseForgotPassword}
                        className="w-full h-11 bg-[#1E3A5F] text-white font-semibold rounded-lg hover:bg-[#162D4A] transition-colors"
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
                        <Label htmlFor="reset-email" className="text-sm font-medium text-slate-700">
                          Email Address
                        </Label>
                        <Input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white transition-all duration-200 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                          required
                        />
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          type="button"
                          onClick={handleCloseForgotPassword}
                          className="flex-1 h-11 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!resetEmail.trim()}
                          className="flex-1 h-11 bg-[#1E3A5F] text-white font-semibold rounded-lg hover:bg-[#162D4A] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                          Send Reset Link
                        </button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeLoginPortal;
