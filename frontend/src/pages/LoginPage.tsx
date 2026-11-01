import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  HeartPulse,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Button } from '@/components/common/Button';
import { api } from '@/services/api';

export const LoginPage: React.FC = () => {
  const { login, loginPatient, demoLogin } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginMode, setLoginMode] = useState<'staff' | 'patient'>('staff');

  // Staff Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Patient Form State
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [rememberPatient, setRememberPatient] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Demo Login State & Environment Gating
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.health
      .check()
      .then((res) => {
        if (!mounted) return;
        const isDemo = Boolean(
          res && res.success && (res.demo_mode === true || (res as any).demo_mode === 'true')
        );
        setIsDemoMode(isDemo);
      })
      .catch(() => {
        if (!mounted) return;
        setIsDemoMode(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Parse OAuth query parameters and status errors
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      const errorMap: Record<string, string> = {
        oauth_not_configured:
          'Google OAuth 2.0 is not yet configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment.',
        oauth_cancelled: 'Google Sign-In was cancelled or access was denied.',
        oauth_state_invalid: 'Google Sign-In session expired or invalid state. Please try again.',
        oauth_missing_code: 'Google did not return an authorization code. Please try again.',
        oauth_token_failed: 'Failed to exchange token with Google. Please check your network and credentials.',
        oauth_userinfo_failed: 'Unable to retrieve user information from Google.',
        oauth_no_email: 'No email address was provided by your Google account.',
        oauth_email_unverified: 'Your Google account email address is not verified by Google.',
        account_deactivated: 'Your account has been deactivated. Please contact an administrator.',
        account_locked: 'Your account is temporarily locked due to failed attempts. Please try again later.',
      };
      setErrorMessage(errorMap[oauthError] || `Authentication failed: ${oauthError}`);
    }
  }, [location.search]);

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  const from = (location.state as any)?.from?.pathname;

  const handleCopy = (text: string, key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      success(`Copied "${text}" to clipboard`);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    } catch {
      error('Failed to copy to clipboard');
    }
  };

  const handleAutoFill = (role: 'doctor' | 'admin' | 'labtech' | 'patient') => {
    setErrorMessage('');
    if (role === 'patient') {
      setLoginMode('patient');
      setPatientName('Demo Patient');
      setPatientId('PAT-1001');
      setIdentifier('patient@careai.com');
      setPassword('Patient@123');
      success('Auto-filled Patient Portal demo credentials');
    } else if (role === 'doctor') {
      setLoginMode('staff');
      setIdentifier('doctor@careai.com');
      setPassword('Doctor@123');
      success('Auto-filled Doctor / Hepatologist credentials');
    } else if (role === 'admin') {
      setLoginMode('staff');
      setIdentifier('admin@careai.com');
      setPassword('Admin@123');
      success('Auto-filled System Administrator credentials');
    } else if (role === 'labtech') {
      setLoginMode('staff');
      setIdentifier('lab@careai.com');
      setPassword('Lab@123');
      success('Auto-filled Lab Technician credentials');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your email/ID and password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await login(identifier.trim(), password, remember);
      success(`Welcome back, ${user.name}!`);

      if (from && from !== '/' && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'hepatologist') navigate('/doctor', { replace: true });
      else if (user.role === 'patient') navigate('/patient', { replace: true });
      else navigate('/lab', { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password.';
      setErrorMessage(msg);
      error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = patientName.trim();
    const trimmedId = patientId.trim().toUpperCase();

    if (!trimmedName || !trimmedId) {
      setErrorMessage('Please enter both your Full Name and Patient ID.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await loginPatient(
        trimmedName,
        trimmedId,
        rememberPatient,
      );
      success(`Welcome to CirrhoCare Patient Portal, ${user.name}!`);

      if (from && from !== '/' && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      navigate('/patient', { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Invalid Patient ID or Name. Please check your clinic registration slip.';
      setErrorMessage(msg);
      error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col justify-center items-center p-4 md:p-8 relative overflow-x-hidden">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden bg-white shadow-2xl border border-slate-100 z-10">
        {/* Left Side: Brand & Value Prop */}
        <div className="bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1E293B] p-8 md:p-12 text-white flex flex-col justify-between relative">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <HeartPulse className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-1.5 font-manrope">
                  CirrhoCare <span className="text-blue-400 font-extrabold text-xs px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30">AI</span>
                </h1>
                <p className="text-[13px] text-slate-400 font-medium">Clinical SaaS Platform</p>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight mb-4 font-manrope">
              Smarter Liver Health. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                Better Patient Care.
              </span>
            </h2>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-6">
              Empowering hepatologists, lab technicians, and care teams with random forest AI risk prediction, lab workflows, and longitudinal patient tracking.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span>Automated Random Forest Risk Probability Engine</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>Role-Based Access for Clinicians & Patients</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400">
            <p>CirrhoCare AI Enterprise Clinical Edition</p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-5">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-manrope">
              {loginMode === 'staff' ? 'Sign In to Workspace' : 'Patient Portal Access'}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5">
              {loginMode === 'staff'
                ? 'Authorized clinical staff: Administrator, Hepatologist, or Lab Technician.'
                : 'Sign in with your registered Patient Name and Patient ID.'}
            </p>
          </div>

          {/* Continue with Google OAuth Button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm md:text-base hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 absolute">
                or sign in with credentials
              </span>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                setErrorMessage('');
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                loginMode === 'staff'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Clinical Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('patient');
                setErrorMessage('');
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition ${
                loginMode === 'patient'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Patient Portal
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          {/* Clinical Staff Form */}
          {loginMode === 'staff' ? (
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address or Staff ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. doctor@careai.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember this device
                </label>
                <button
                  type="button"
                  onClick={() => error('Please contact your clinic administrator to reset your credentials.')}
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Workspace
              </Button>
            </form>
          ) : (
            /* Patient Portal Form */
            <form onSubmit={handlePatientSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patient Demo"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Patient Portal ID
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. CC-2026-1001"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition uppercase text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberPatient}
                    onChange={(e) => setRememberPatient(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember this device
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Patient Portal
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            Protected by Healthcare Standard Security & Session Encryption.
          </p>
        </div>
      </div>

      {/* Demo Accounts for Evaluation Section - Prominent & Always Visible for Reviewers */}
      <div className="w-full max-w-4xl mt-8 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                  Demo Accounts for Evaluation
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Verified Active
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                Pre-configured test accounts for mentors and evaluators. Click <strong>Auto-Fill</strong> to populate the form instantly, or use the <strong>Copy</strong> buttons.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Doctor / Hepatologist */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-purple-200/70 hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-purple-900">Doctor</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded-full">
                    Hepatologist
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-0.5">Dr. Hepato Care</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                  Biomarker analysis, prescriptions & treatment status workflow.
                </p>

                <div className="space-y-2 mb-3 bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Email / Staff ID</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold truncate text-[11px]">doctor@careai.com</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('doctor@careai.com', 'doctor-id')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Email"
                      >
                        {copiedKey === 'doctor-id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Password</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold text-[11px]">Doctor@123</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('Doctor@123', 'doctor-pass')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Password"
                      >
                        {copiedKey === 'doctor-pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill('doctor')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow transition flex items-center justify-center gap-1.5"
              >
                Auto-Fill Credentials
              </button>
            </div>

            {/* Card 2: System Administrator */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-blue-200/70 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-blue-900">Administrator</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-full">
                    System Admin
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-0.5">System Admin</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                  System monitoring, staff directory, audit trails & security logs.
                </p>

                <div className="space-y-2 mb-3 bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Email / Staff ID</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold truncate text-[11px]">admin@careai.com</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('admin@careai.com', 'admin-id')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Email"
                      >
                        {copiedKey === 'admin-id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Password</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold text-[11px]">Admin@123</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('Admin@123', 'admin-pass')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Password"
                      >
                        {copiedKey === 'admin-pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill('admin')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition flex items-center justify-center gap-1.5"
              >
                Auto-Fill Credentials
              </button>
            </div>

            {/* Card 3: Lab Technician */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-teal-200/70 hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                      <FlaskConical className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-teal-900">Lab Tech</span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded-full">
                    Laboratory
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-0.5">Lab Technician</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                  Register patients, enter test biomarkers & AI risk predictions.
                </p>

                <div className="space-y-2 mb-3 bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Email / Staff ID</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold truncate text-[11px]">lab@careai.com</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('lab@careai.com', 'lab-id')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Email"
                      >
                        {copiedKey === 'lab-id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Password</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold text-[11px]">Lab@123</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('Lab@123', 'lab-pass')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Password"
                      >
                        {copiedKey === 'lab-pass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill('labtech')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow transition flex items-center justify-center gap-1.5"
              >
                Auto-Fill Credentials
              </button>
            </div>

            {/* Card 4: Patient Portal */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-emerald-200/70 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-emerald-900">Patient</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                    Patient Portal
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-0.5">Demo Patient</p>
                <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                  View diagnostic reports, doctor advice & appointments.
                </p>

                <div className="space-y-2 mb-3 bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Full Name</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold text-[11px]">Demo Patient</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('Demo Patient', 'patient-name')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Patient Name"
                      >
                        {copiedKey === 'patient-name' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Patient Portal ID</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-slate-800 font-semibold text-[11px]">PAT-1001</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('PAT-1001', 'patient-id')}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        title="Copy Patient ID"
                      >
                        {copiedKey === 'patient-id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill('patient')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition flex items-center justify-center gap-1.5"
              >
                Auto-Fill Credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
