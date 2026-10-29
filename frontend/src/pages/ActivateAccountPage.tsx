import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';

type ActivationState = 'verifying' | 'valid' | 'invalid' | 'submitting' | 'activated';

export const ActivateAccountPage: React.FC = () => {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = routeToken || searchParams.get('token') || '';

  const [state, setState] = useState<ActivationState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [patientUser, setPatientUser] = useState<{ name: string; email: string; portal_id?: string } | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMessage('No activation token was provided. Please check the link from your email.');
      return;
    }

    let isMounted = true;
    setState('verifying');

    api.auth
      .verifyActivationToken(token)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.valid) {
          setPatientUser(res.user);
          setState('valid');
        } else {
          setState('invalid');
          setErrorMessage(res.message || 'This activation link is invalid or has expired.');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setState('invalid');
        setErrorMessage(
          err.message || 'Unable to verify activation link. Please contact clinic staff or try again.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setState('submitting');
    setErrorMessage('');

    try {
      const res = await api.auth.activateAccount(token, password, confirmPassword);
      if (res.success) {
        setState('activated');
      } else {
        setState('valid');
        setErrorMessage(res.message || 'Failed to activate account.');
      }
    } catch (err: any) {
      setState('valid');
      setErrorMessage(err.message || 'Failed to activate account. Please check your password and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 z-10 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-[#0B132B] via-[#0F172A] to-[#1E293B] p-6 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5">
                CirrhoCare <span className="text-blue-400 font-extrabold text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-400/30">AI</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Patient Portal Account Activation</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Setup</span>
          </div>
        </div>

        {/* State 1: Verifying */}
        {state === 'verifying' && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <LoadingSpinner label="Validating activation link..." />
            <h2 className="text-base font-bold text-slate-800 mt-2">Verifying Activation Credentials</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Please wait while we validate your secure single-use token against the clinical surveillance registry...
            </p>
          </div>
        )}

        {/* State 2: Invalid / Expired */}
        {state === 'invalid' && (
          <div className="p-8 sm:p-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Activation Link Invalid or Expired</h2>
            <p className="text-xs text-slate-600 mt-2 max-w-md leading-relaxed">
              {errorMessage ||
                'This invitation link is invalid, has expired, or has already been used to set an account password.'}
            </p>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left w-full text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">What should you do?</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>If you already activated your account, you can proceed directly to sign in.</li>
                <li>If your link has expired (links are valid for 48 hours), contact your clinical laboratory staff to request a fresh invitation.</li>
              </ul>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3 w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          </div>
        )}

        {/* State 3: Valid Token - Password Form */}
        {(state === 'valid' || state === 'submitting') && (
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Welcome to CirrhoCare AI</h2>
              <p className="text-xs text-slate-500 mt-1">
                Please set your private password to activate your clinical patient portal.
              </p>
            </div>

            {/* Patient Context Badge */}
            {patientUser && (
              <div className="mb-6 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {patientUser.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{patientUser.name}</h3>
                    <p className="text-xs text-slate-500">{patientUser.email}</p>
                  </div>
                </div>
                {patientUser.portal_id && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Patient ID</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{patientUser.portal_id}</span>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Create Personal Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Enter at least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition"
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

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Re-type your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirements Checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Password has at least 8 characters</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Passwords match identically</span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={state === 'submitting'}
                disabled={!isFormValid || state === 'submitting'}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Activate Account & Proceed
              </Button>
            </form>
          </div>
        )}

        {/* State 4: Activated Success */}
        {state === 'activated' && (
          <div className="p-8 sm:p-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Account Successfully Activated!</h2>
            <p className="text-xs text-slate-600 mt-2 max-w-md leading-relaxed">
              Your confidential password has been securely stored. You can now access your laboratory test results, AI
              cirrhosis monitoring trends, and physician appointments.
            </p>

            {patientUser && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left w-full text-xs">
                <p className="text-slate-500">Your Login Credentials:</p>
                <p className="text-slate-900 font-bold mt-1">
                  Email / Identifier: <span className="text-blue-600">{patientUser.email}</span>
                </p>
                {patientUser.portal_id && (
                  <p className="text-slate-900 font-bold">
                    Patient Portal ID: <span className="font-mono text-blue-600">{patientUser.portal_id}</span>
                  </p>
                )}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/login')}
              className="w-full mt-8"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Patient Portal
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        CirrhoCare AI Clinical Platform · Compliant with Healthcare Privacy Standards
      </p>
    </div>
  );
};
