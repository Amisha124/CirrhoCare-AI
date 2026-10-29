import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  Key,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { api } from '@/services/api';
import type { Patient, PatientDashboardData } from '@/types';

export const PatientProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [patientRecord, setPatientRecord] = useState<Patient | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);

  const fetchPatientRecord = useCallback(async () => {
    try {
      const res = await api.dashboard.getStats<PatientDashboardData>();
      if (res && res.success && res.latest_record) {
        setPatientRecord(res.latest_record);
      }
    } catch {
      // Non-critical background fetch
    } finally {
      setIsLoadingRecord(false);
    }
  }, []);

  useEffect(() => {
    fetchPatientRecord();
  }, [fetchPatientRecord]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Full legal name cannot be empty.');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await api.auth.updateProfile({ name: name.trim() });
      if (res && res.success) {
        success('Profile legal name successfully updated.');
      } else {
        error(res.message || 'Failed to update profile name.');
      }
    } catch (err: any) {
      error(err.message || 'Unable to update profile name.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-teal-950 p-6 md:p-8 text-white shadow-xl shadow-slate-950/20 relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 backdrop-blur-md border border-teal-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                Verified Patient Identity
              </span>
              <span className="text-teal-400/80 text-xs font-medium">• Account & Security</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Patient Profile & Settings
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              Review your patient registration credentials, manage your profile identity, and view linked healthcare records.
            </p>
          </div>

          <div className="px-5 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-right">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-teal-200/80">
              Portal Identification
            </span>
            <span className="font-mono text-base font-black text-white">
              {user?.portal_id || patientRecord?.portal_id || 'PENDING'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Profile Details & Edit Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Identity Card */}
        <Card className="border-slate-200/80 shadow-md">
          <CardHeader className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Health Account Identity</h3>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-teal-500 to-indigo-600 text-white flex items-center justify-center font-black text-3xl shadow-lg shadow-teal-500/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">{user?.name}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>
            </div>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                Verified Patient Account
              </span>
            </div>
            <div className="pt-3 border-t border-slate-100 text-left text-xs space-y-2 text-slate-600">
              <div>Role: <strong className="text-slate-900 capitalize">{user?.role}</strong></div>
              <div>Portal ID: <strong className="text-slate-900 font-mono">{user?.portal_id || 'PAT-DEMO'}</strong></div>
              <div>Status: <strong className="text-emerald-700">Active</strong></div>
            </div>
          </CardContent>
        </Card>

        {/* Right 2 Columns: Editable Legal Profile & Clinical Linkage */}
        <div className="md:col-span-2 space-y-6">
          {/* Editable Form */}
          <Card className="border-slate-200/80 shadow-md">
            <CardHeader className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
              <p className="text-xs text-slate-500">Update your verified legal name on file</p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Your legal full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full pl-10 pr-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isUpdating}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Linked Clinical Record */}
          <Card className="border-slate-200/80 shadow-md">
            <CardHeader className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Linked Clinical Health Record</h3>
              </div>
              {patientRecord && (
                <Badge risk={patientRecord.latest_risk_label as any} size="sm" />
              )}
            </CardHeader>
            <CardContent className="p-6">
              {patientRecord ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Age</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">{patientRecord.age} years</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Biological Sex</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">{patientRecord.gender}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Treatment Status</span>
                    <span className="text-sm font-black text-indigo-700 block mt-0.5">{patientRecord.treatment_status}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Registration</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {patientRecord.created_at ? new Date(patientRecord.created_at).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No linked clinical chart found for this portal account. Clinical records will appear once created by hospital reception or your attending physician.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Navigation Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link
          to="/patient"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-300 hover:shadow-md transition text-left"
        >
          <Activity className="w-5 h-5 text-teal-600 mb-1" />
          <span className="text-xs font-bold text-slate-900 block">Personal Dashboard</span>
          <span className="text-[11px] text-slate-500">Health overview & KPIs</span>
        </Link>
        <Link
          to="/patient/reports"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition text-left"
        >
          <FileText className="w-5 h-5 text-blue-600 mb-1" />
          <span className="text-xs font-bold text-slate-900 block">Medical Documents</span>
          <span className="text-[11px] text-slate-500">Download test scans</span>
        </Link>
        <Link
          to="/patient/appointments"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-300 hover:shadow-md transition text-left"
        >
          <Calendar className="w-5 h-5 text-purple-600 mb-1" />
          <span className="text-xs font-bold text-slate-900 block">Consultations</span>
          <span className="text-[11px] text-slate-500">Book clinical visits</span>
        </Link>
        <Link
          to="/notifications"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition text-left"
        >
          <Bell className="w-5 h-5 text-amber-600 mb-1" />
          <span className="text-xs font-bold text-slate-900 block">Notifications</span>
          <span className="text-[11px] text-slate-500">Security & health alerts</span>
        </Link>
      </div>
    </div>
  );
};

export default PatientProfilePage;
