import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
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
  const [isCheckingDemoMode, setIsCheckingDemoMode] = useState<boolean>(true);
  const [demoLoadingRole, setDemoLoadingRole] = useState<'admin' | 'doctor' | 'labtech' | 'patient' | null>(null);

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
      })
      .finally(() => {
        if (mounted) {
          setIsCheckingDemoMode(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const from = (location.state as any)?.from?.pathname;

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
    if (!patientName.trim() || !patientId.trim()) {
      setErrorMessage('Please provide your Patient Name and Patient ID.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await loginPatient(
        patientName.trim(),
        patientId.trim().toUpperCase(),
        rememberPatient,
      );
      success(`Welcome to your Patient Portal, ${user.name}!`);

      if (from && from !== '/' && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      navigate('/patient', { replace: true });
    } catch (err: any) {
      const msg =
        err.message ||
        'Patient name or Patient ID is incorrect.';
      setErrorMessage(msg);
      error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'admin' | 'doctor' | 'labtech' | 'patient') => {
    setErrorMessage('');
    setDemoLoadingRole(role);

    try {
      const user = await demoLogin(role);
      success(`Signed in as ${user.name}`);

      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'hepatologist') navigate('/doctor', { replace: true });
      else if (user.role === 'patient') navigate('/patient', { replace: true });
      else navigate('/lab', { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Demo login failed. Please ensure demo mode is enabled.';
      setErrorMessage(msg);
      error(msg);
    } finally {
      setDemoLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col justify-center items-center p-4 relative overflow-hidden">
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
                <h1 className="text-xl font-black tracking-tight flex items-center gap-1.5">
                  CirrhoCare <span className="text-blue-400 font-extrabold text-xs px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30">AI</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Clinical SaaS Platform</p>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight mb-4">
              Smarter Liver Health. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                Better Patient Care.
              </span>
            </h2>

            <p className="text-xs md:text-sm text-slate-400 leading-relaxed mb-6">
              Empowering hepatologists, lab technicians, and care teams with random forest AI risk prediction, lab workflows, and longitudinal patient tracking.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span>Automated Random Forest Risk Probability Engine</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
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
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {loginMode === 'staff' ? 'Sign In to Workspace' : 'Patient Portal Access'}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5">
              {loginMode === 'staff'
                ? 'Authorized clinical staff: Administrator, Hepatologist, or Lab Technician.'
                : 'Sign in with your registered Patient Name and Patient ID.'}
            </p>
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
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Patient Portal
            </button>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          {loginMode === 'staff' ? (
            /* Staff Login Form */
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
                    className="w-full pl-10 pr-10 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
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
                <a
                  href="/auth/forgot-password"
                  className="text-blue-600 hover:text-blue-800 font-semibold transition"
                >
                  Forgot password?
                </a>
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
            /* Patient ID-based Login Form */
            <form onSubmit={handlePatientSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Registered Patient Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anil Kapoor"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-base md:text-[15px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Patient ID
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. CC-2026-7780"
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

          {/* Demo Accounts Section - 1-Click Role Access (Gated to Demo/Dev Mode) */}
          {isDemoMode && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Demo Accounts
                </span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Demo Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Instant access for evaluating role dashboards and clinical workflows.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={demoLoadingRole === 'admin'}
                  disabled={isLoading || demoLoadingRole !== null}
                  onClick={() => handleDemoLogin('admin')}
                  className="w-full text-sm font-semibold justify-center py-2.5 text-slate-800 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                >
                  Login as Admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={demoLoadingRole === 'doctor'}
                  disabled={isLoading || demoLoadingRole !== null}
                  onClick={() => handleDemoLogin('doctor')}
                  className="w-full text-sm font-semibold justify-center py-2.5 text-purple-700 border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                >
                  Login as Doctor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={demoLoadingRole === 'labtech'}
                  disabled={isLoading || demoLoadingRole !== null}
                  onClick={() => handleDemoLogin('labtech')}
                  className="w-full text-sm font-semibold justify-center py-2.5 text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                >
                  Login as Lab Technician
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={demoLoadingRole === 'patient'}
                  disabled={isLoading || demoLoadingRole !== null}
                  onClick={() => handleDemoLogin('patient')}
                  className="w-full text-sm font-semibold justify-center py-2.5 text-blue-700 border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                >
                  Login as Patient
                </Button>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            Protected by Healthcare Standard Security & Session Encryption.
          </p>
        </div>
      </div>
    </div>
  );
};
