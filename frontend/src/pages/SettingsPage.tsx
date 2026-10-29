import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { api } from '@/services/api';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      error('Full legal name cannot be blank.');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await api.auth.updateProfile({ name: displayName.trim() });
      if (res.success) {
        success('Profile display name updated successfully.');
      } else {
        error(res.message || 'Failed to update profile name.');
      }
    } catch (err: any) {
      error(err.message || 'Error updating profile name.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getWorkspacePath = () => {
    switch (user?.role) {
      case 'admin':
        return '/admin';
      case 'hepatologist':
        return '/doctor';
      case 'labtech':
        return '/lab';
      case 'patient':
        return '/patient';
      default:
        return '/';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Account & Security Settings</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Manage your verified clinical identity, security credentials, and active permissions.
          </p>
        </div>
        <Link
          to={getWorkspacePath()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          Back to Workspace
        </Link>
      </div>

      {/* Profile Overview Card */}
      <Card accentColor="blue" className="shadow-md">
        <CardHeader title="Clinical User Profile" subtitle="Your verified identity in CirrhoCare AI" />
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center font-bold text-2xl shadow-md">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{user?.name}</h3>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge role={user?.role} />
                {user?.portal_id && (
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    ID: {user.portal_id}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Legal Display Name Update Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Display Name *
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 transition"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUpdating}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Save Changes
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This name appears on clinical notes, reports, and audit trail logs.
              </p>
            </div>
          </form>

          {/* Account Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="text-slate-400 font-medium">Account Status</span>
              <p className="font-semibold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Active & Authorized
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="text-slate-400 font-medium">System Role</span>
              <p className="font-semibold text-slate-800 capitalize mt-0.5">{user?.role}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="text-slate-400 font-medium">Member Since</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="text-slate-400 font-medium">Session Protection</span>
              <p className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Flask HttpOnly / SameSite=Lax
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Credentials Card */}
      <Card accentColor="purple" className="shadow-md">
        <CardHeader title="Security & Authentication" subtitle="Password management and security tokens" />
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Cryptographic Password Reset</p>
                <p className="text-xs text-slate-500">Need to update your password? Request a secure time-limited token.</p>
              </div>
            </div>
            <a
              href="/auth/forgot-password"
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs transition text-center shrink-0"
            >
              Reset Password
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
