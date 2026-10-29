import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Appointment } from '@/types';
import { cn } from '@/utils/cn';
import {
  formatDateLocalized,
  getAppointmentStatusText,
  getAppointmentReasonText,
} from '@/utils/translations';

type FilterStatus = 'all' | 'Pending' | 'Confirmed' | 'Rescheduled' | 'Rejected' | 'Completed';

export const DoctorAppointmentRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi, t } = useLanguage();
  const { success, error: toastError, warning } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // Modals state
  const [viewingAppnt, setViewingAppnt] = useState<Appointment | null>(null);

  // Confirm modal state
  const [confirmAppnt, setConfirmAppnt] = useState<Appointment | null>(null);
  const [confirmNotes, setConfirmNotes] = useState<string>('');
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState<boolean>(false);

  // Reschedule / Propose new date state
  const [rescheduleAppnt, setRescheduleAppnt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('10:00');
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState<boolean>(false);

  // Reject modal state
  const [rejectAppnt, setRejectAppnt] = useState<Appointment | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Load appointments from backend
  const loadAppointments = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await api.appointments.list({
        sort_by: 'scheduled_at',
        sort_dir: 'asc',
        per_page: 100,
      });

      if (res && res.success) {
        setAppointments(res.appointments || []);
      } else {
        toastError((res as any)?.message || 'Failed to load appointment requests.');
      }
    } catch (err: any) {
      toastError(err?.message || 'Error fetching appointment requests.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadAppointments();

    const handleUpdate = () => {
      loadAppointments(true);
    };

    window.addEventListener('appointment-updated', handleUpdate);
    return () => {
      window.removeEventListener('appointment-updated', handleUpdate);
    };
  }, [loadAppointments]);

  // Statistics
  const stats = useMemo(() => {
    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === 'Pending').length;
    const confirmed = appointments.filter((a) => a.status === 'Confirmed').length;
    const rescheduled = appointments.filter(
      (a) => a.status === 'Rescheduled' || a.status === 'Reschedule Requested'
    ).length;
    const rejected = appointments.filter((a) => a.status === 'Rejected').length;
    const completed = appointments.filter((a) => a.status === 'Completed').length;
    return { total, pending, confirmed, rescheduled, rejected, completed };
  }, [appointments]);

  // Filter & Search
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appnt) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Rescheduled') {
          if (appnt.status !== 'Rescheduled' && appnt.status !== 'Reschedule Requested') {
            return false;
          }
        } else if (appnt.status !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const patName = (appnt.patient_name || '').toLowerCase();
        const patId = (appnt.patient_portal_id || '').toLowerCase();
        const reason = (appnt.reason || '').toLowerCase();
        const type = (appnt.appointment_type || '').toLowerCase();
        if (!patName.includes(q) && !patId.includes(q) && !reason.includes(q) && !type.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Format Helpers
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    return formatDateLocalized(isoString, isHindi) || '—';
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString(isHindi ? 'hi-IN' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // 1. Confirm Appointment Handler
  const handleOpenConfirm = (appnt: Appointment) => {
    setConfirmAppnt(appnt);
    setConfirmNotes('Confirmed. Please report to the Liver Clinic 10 minutes prior.');
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmAppnt) return;

    setIsSubmittingConfirm(true);
    try {
      const res = await api.appointments.updateStatus(confirmAppnt.id, 'Confirmed', {
        doctor_notes: confirmNotes.trim() || undefined,
        reason: confirmNotes.trim() || undefined,
      });

      if (res && res.success) {
        success(`Appointment for ${confirmAppnt.patient_name || 'Patient'} confirmed successfully.`);
        setConfirmAppnt(null);
        if (viewingAppnt?.id === confirmAppnt.id) setViewingAppnt(null);
        window.dispatchEvent(new CustomEvent('appointment-updated'));
        await loadAppointments(true);
      } else {
        toastError(res?.message || 'Failed to confirm appointment.');
      }
    } catch (err: any) {
      toastError(err?.message || 'Error confirming appointment.');
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // 2. Propose New Date / Time (Reschedule) Handler
  const handleOpenReschedule = (appnt: Appointment) => {
    setRescheduleAppnt(appnt);
    if (appnt.scheduled_at) {
      const d = new Date(appnt.scheduled_at);
      setRescheduleDate(d.toISOString().slice(0, 10));
      setRescheduleTime(d.toTimeString().slice(0, 5));
    } else {
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 2);
      setRescheduleDate(nextDay.toISOString().slice(0, 10));
      setRescheduleTime('11:00');
    }
    setRescheduleNotes('Adjusted time to review laboratory panels and ensure doctor availability.');
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppnt) return;
    if (!rescheduleDate || !rescheduleTime) {
      warning('Please choose both a new date and time.');
      return;
    }

    const scheduledIso = `${rescheduleDate}T${rescheduleTime}:00`;
    setIsSubmittingReschedule(true);
    try {
      const res = await api.appointments.updateStatus(rescheduleAppnt.id, 'Rescheduled', {
        scheduled_at: scheduledIso,
        doctor_notes: rescheduleNotes.trim() || undefined,
        reason: rescheduleNotes.trim() || undefined,
      });

      if (res && res.success) {
        success(`New appointment slot proposed to ${rescheduleAppnt.patient_name || 'Patient'}.`);
        setRescheduleAppnt(null);
        if (viewingAppnt?.id === rescheduleAppnt.id) setViewingAppnt(null);
        window.dispatchEvent(new CustomEvent('appointment-updated'));
        await loadAppointments(true);
      } else {
        toastError(res?.message || 'Failed to propose new appointment slot.');
      }
    } catch (err: any) {
      toastError(err?.message || 'Error proposing new appointment slot.');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // 3. Reject Request Handler
  const handleOpenReject = (appnt: Appointment) => {
    setRejectAppnt(appnt);
    setRejectReason('');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectAppnt) return;
    if (!rejectReason.trim()) {
      warning('Please provide a clinical or scheduling reason for declining.');
      return;
    }

    setIsSubmittingReject(true);
    try {
      const res = await api.appointments.updateStatus(rejectAppnt.id, 'Rejected', {
        doctor_notes: rejectReason.trim(),
        reason: rejectReason.trim(),
      });

      if (res && res.success) {
        success(`Appointment request for ${rejectAppnt.patient_name || 'Patient'} rejected.`);
        setRejectAppnt(null);
        if (viewingAppnt?.id === rejectAppnt.id) setViewingAppnt(null);
        window.dispatchEvent(new CustomEvent('appointment-updated'));
        await loadAppointments(true);
      } else {
        toastError(res?.message || 'Failed to reject appointment request.');
      }
    } catch (err: any) {
      toastError(err?.message || 'Error rejecting appointment request.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t('Appointment Requests', 'अपॉइंटमेंट अनुरोध')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(
                  'Review and manage clinical consultation and follow-up requests submitted by patients',
                  'मरीज़ों द्वारा प्रस्तुत परामर्श और फॉलो-अप अनुरोधों की समीक्षा एवं प्रबंधन करें'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadAppointments(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (isRefreshing || isLoading) && 'animate-spin text-[#1877F2]')} />
            <span>{isRefreshing ? t('Refreshing...', 'रिफ्रेश हो रहा है...') : t('Refresh', 'रिफ्रेश')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('Total Requests', 'कुल अनुरोध')}</span>
            <span className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-400 font-medium">{t('records', 'रिकॉर्ड')}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100/80 p-4 shadow-xs bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">{t('Pending Confirmation', 'पुष्टि हेतु लंबित')}</span>
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-[#1877F2] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1877F2]">{stats.pending}</span>
            <span className="text-xs font-semibold text-blue-600">{t('needs review', 'समीक्षा आवश्यक')}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100/80 p-4 shadow-xs bg-gradient-to-br from-white to-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">{t('Confirmed', 'पुष्ट अपॉइंटमेंट')}</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">{stats.confirmed}</span>
            <span className="text-xs font-semibold text-emerald-600">{t('scheduled', 'निर्धारित')}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-sky-100/80 p-4 shadow-xs bg-gradient-to-br from-white to-sky-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-900">{t('Reschedule Proposed', 'पुनर्निर्धारण प्रस्तावित')}</span>
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-700">{stats.rescheduled}</span>
            <span className="text-xs font-semibold text-sky-600">{t('awaiting patient', 'रोगी की प्रतीक्षा')}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {(
            [
              { key: 'all', label: t('All', 'सभी'), count: stats.total },
              { key: 'Pending', label: t('Pending', 'लंबित'), count: stats.pending },
              { key: 'Confirmed', label: t('Confirmed', 'पुष्ट'), count: stats.confirmed },
              { key: 'Rescheduled', label: t('Reschedule Proposed', 'पुनर्निर्धारण प्रस्तावित'), count: stats.rescheduled },
              { key: 'Rejected', label: t('Rejected', 'अस्वीकृत'), count: stats.rejected },
              { key: 'Completed', label: t('Completed', 'पूर्ण'), count: stats.completed },
            ] as const
          ).map((tab) => {
            const isSelected = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5',
                  isSelected
                    ? 'bg-[#1877F2] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                )}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-xs font-bold',
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px] md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search patient, ID, or reason...', 'रोगी, आईडी, या कारण से खोजें...')}
            className="w-full pl-10 pr-8 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">{t('Loading appointment requests...', 'अपॉइंटमेंट अनुरोध लोड हो रहे हैं...')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('Connecting to clinical appointments database', 'नैदानिक अपॉइंटमेंट डेटाबेस से कनेक्ट हो रहा है')}</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <CalendarClock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">{t('No appointment requests found', 'कोई अपॉइंटमेंट अनुरोध नहीं मिला')}</h4>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? t('No appointments matched your search or status filter criteria.', 'आपकी खोज या फ़िल्टर मानदंडों से कोई अपॉइंटमेंट मेल नहीं खाती।')
                : t('No appointment requests have been submitted yet.', 'अभी तक कोई अपॉइंटमेंट अनुरोध प्रस्तुत नहीं किया गया है।')}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-3.5 text-sm font-semibold text-[#1877F2] hover:underline cursor-pointer"
              >
                {t('Clear all filters', 'सभी फ़िल्टर साफ़ करें')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{t('Patient Name', 'रोगी का नाम')}</th>
                  <th className="py-3.5 px-4">{t('Patient ID', 'रोगी आईडी')}</th>
                  <th className="py-3.5 px-4">{t('Type', 'प्रकार')}</th>
                  <th className="py-3.5 px-4">{t('Requested Date', 'अनुरोधित तिथि')}</th>
                  <th className="py-3.5 px-4">{t('Requested Time', 'अनुरोधित समय')}</th>
                  <th className="py-3.5 px-4">{t('Reason for Visit', 'परामर्श का कारण')}</th>
                  <th className="py-3.5 px-4">{t('Status', 'स्थिति')}</th>
                  <th className="py-3.5 px-4 text-right">{t('Actions', 'कार्रवाइयां')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAppointments.map((appnt) => {
                  const isPending = appnt.status === 'Pending';
                  const isConfirmed = appnt.status === 'Confirmed';
                  const isRescheduled = appnt.status === 'Rescheduled' || appnt.status === 'Reschedule Requested';
                  const isRejected = appnt.status === 'Rejected';
                  const isCompleted = appnt.status === 'Completed';

                  return (
                    <tr
                      key={appnt.id}
                      className={cn(
                        'hover:bg-blue-50/30 transition-colors',
                        isPending && 'bg-amber-50/20'
                      )}
                    >
                      {/* Patient Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1877F2] flex items-center justify-center font-bold text-xs shrink-0">
                            {appnt.patient_name ? appnt.patient_name.slice(0, 1).toUpperCase() : 'P'}
                          </div>
                          <span className="font-bold text-slate-900 truncate max-w-[150px]">
                            {appnt.patient_name || `Patient #${appnt.patient_id}`}
                          </span>
                        </div>
                      </td>

                      {/* Patient ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {appnt.patient_portal_id ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/60">
                            {appnt.patient_portal_id}
                          </span>
                        ) : (
                          `#${appnt.patient_id}`
                        )}
                      </td>

                      {/* Appointment Type */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            appnt.appointment_type === 'Follow-up'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1877F2] border-blue-200'
                          )}
                        >
                          {appnt.appointment_type === 'Follow-up'
                            ? (isHindi ? 'फॉलो-अप' : 'Follow-up')
                            : (isHindi ? 'परामर्श' : 'Consultation')}
                        </span>
                      </td>

                      {/* Requested Date */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {formatDate(appnt.scheduled_at)}
                      </td>

                      {/* Requested Time */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatTime(appnt.scheduled_at)}
                      </td>

                      {/* Reason for Visit */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={appnt.reason}>
                        {getAppointmentReasonText(appnt.reason, isHindi)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1',
                            isPending && 'bg-amber-50 text-amber-800 border-amber-200',
                            isConfirmed && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            isRescheduled && 'bg-sky-50 text-sky-800 border-sky-200',
                            isRejected && 'bg-rose-50 text-rose-800 border-rose-200',
                            isCompleted && 'bg-slate-100 text-slate-600 border-slate-200'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              isPending && 'bg-amber-500 animate-pulse',
                              isConfirmed && 'bg-emerald-500',
                              isRescheduled && 'bg-sky-500',
                              isRejected && 'bg-rose-500',
                              isCompleted && 'bg-slate-400'
                            )}
                          />
                          <span>{getAppointmentStatusText(isRescheduled ? 'Reschedule Proposed' : appnt.status, isHindi)}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setViewingAppnt(appnt)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title={t('View Details', 'विवरण देखें')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Confirm (for Pending or Rescheduled) */}
                          {(isPending || isRescheduled) && (
                            <button
                              type="button"
                              onClick={() => handleOpenConfirm(appnt)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                              title={t('Confirm Appointment', 'अपॉइंटमेंट की पुष्टि करें')}
                            >
                              {t('Confirm', 'पुष्टि करें')}
                            </button>
                          )}

                          {/* Quick Propose New Time */}
                          {(isPending || isConfirmed) && (
                            <button
                              type="button"
                              onClick={() => handleOpenReschedule(appnt)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-[#1877F2] hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                              title={t('Propose New Date/Time', 'नई तिथि/समय प्रस्तावित करें')}
                            >
                              {t('Reschedule', 'पुनर्निर्धारित')}
                            </button>
                          )}

                          {/* Quick Reject (for Pending) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleOpenReject(appnt)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                              title={t('Reject Request', 'अनुरोध अस्वीकार करें')}
                            >
                              {t('Reject', 'अस्वीकार')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Modal: View Details */}
      {viewingAppnt && (
        <Modal
          isOpen={!!viewingAppnt}
          onClose={() => setViewingAppnt(null)}
          title={
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1877F2]" />
              <span className="font-bold text-slate-900">
                {t('Appointment Details: ', 'अपॉइंटमेंट विवरण: ')}{viewingAppnt.patient_name || `Patient #${viewingAppnt.patient_id}`}
              </span>
            </div>
          }
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400">
                {t('Created: ', 'निर्मित: ')}{formatDate(viewingAppnt.created_at)}
              </span>
              <div className="flex items-center gap-2">
                {viewingAppnt.status === 'Pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenReject(viewingAppnt)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                    >
                      {t('Reject Request', 'अनुरोध अस्वीकार करें')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReschedule(viewingAppnt)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 text-[#1877F2] hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                    >
                      {t('Propose New Time', 'नया समय प्रस्तावित करें')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenConfirm(viewingAppnt)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                    >
                      {t('Confirm Appointment', 'अपॉइंटमेंट की पुष्टि करें')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setViewingAppnt(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {t('Close', 'बंद करें')}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            {/* Header Strip */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1877F2] flex items-center justify-center font-bold text-sm">
                  {viewingAppnt.patient_name ? viewingAppnt.patient_name.slice(0, 1).toUpperCase() : 'P'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {viewingAppnt.patient_name || `Patient #${viewingAppnt.patient_id}`}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500">
                    ID: {viewingAppnt.patient_portal_id || `#${viewingAppnt.patient_id}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#1877F2] border border-blue-200">
                  {viewingAppnt.appointment_type === 'Follow-up'
                    ? (isHindi ? 'फॉलो-अप' : 'Follow-up')
                    : (isHindi ? 'परामर्श' : 'Consultation')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {getAppointmentStatusText(viewingAppnt.status, isHindi)}
                </span>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60">
                <span className="text-[11px] text-slate-400 font-medium">{t('Requested Date & Time', 'अनुरोधित तिथि एवं समय')}</span>
                <p className="font-bold text-slate-900 mt-1">
                  {formatDate(viewingAppnt.scheduled_at)} {t('at', 'को')} {formatTime(viewingAppnt.scheduled_at)}
                </p>
              </div>

              <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60">
                <span className="text-[11px] text-slate-400 font-medium">{t('Assigned Clinician', 'सौंपे गए डॉक्टर')}</span>
                <p className="font-bold text-slate-900 mt-1">
                  {viewingAppnt.doctor_name ? (isHindi ? `डॉ. ${viewingAppnt.doctor_name}` : `Dr. ${viewingAppnt.doctor_name}`) : `Doctor #${viewingAppnt.doctor_id}`}
                </p>
              </div>
            </div>

            {/* Reason for Visit */}
            <div className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('Reason for Visit / Patient Notes', 'परामर्श का कारण / रोगी के नोट्स')}
              </span>
              <p className="mt-1.5 text-slate-800 leading-relaxed font-medium">
                {getAppointmentReasonText(viewingAppnt.reason, isHindi)}
              </p>
            </div>

            {/* Doctor Clinical Notes */}
            {viewingAppnt.doctor_notes && (
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/60 text-xs">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  {t("Doctor's Instructions & Notes", 'डॉक्टर के निर्देश एवं नोट्स')}
                </span>
                <p className="mt-1.5 text-slate-800 leading-relaxed font-medium">
                  {viewingAppnt.doctor_notes}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 2. Modal: Confirm Appointment */}
      {confirmAppnt && (
        <Modal
          isOpen={!!confirmAppnt}
          onClose={() => setConfirmAppnt(null)}
          title={
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-slate-900">{t('Confirm Appointment', 'अपॉइंटमेंट की पुष्टि करें')}</span>
            </div>
          }
          size="md"
        >
          <form onSubmit={handleConfirmSubmit} className="space-y-4">
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p className="font-bold">
                {t('Confirming consultation for ', 'परामर्श की पुष्टि: ')}{confirmAppnt.patient_name || 'Patient'}
              </p>
              <p className="text-[11px] text-emerald-800">
                {t('Scheduled for ', 'निर्धारित समय: ')}<strong>{formatDate(confirmAppnt.scheduled_at)}</strong> {t('at', 'को')}{' '}
                <strong>{formatTime(confirmAppnt.scheduled_at)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Preparation Instructions / Doctor Notes (Optional)', 'तैयारी निर्देश / डॉक्टर नोट्स (वैकल्पिक)')}
              </label>
              <textarea
                rows={3}
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder={isHindi ? 'उदा. कृपया रिपीट एलएफटी टेस्ट के लिए 10 मिनट पहले खाली पेट पहुंचें।' : 'e.g. Please arrive 10 minutes early with fasting for repeat LFT panel.'}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmAppnt(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                {t('Cancel', 'रद्द करें')}
              </button>
              <button
                type="submit"
                disabled={isSubmittingConfirm}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingConfirm ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Confirming...', 'पुष्टि हो रही है...')}</span>
                  </>
                ) : (
                  <span>{t('Confirm Appointment', 'अपॉइंटमेंट की पुष्टि करें')}</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Modal: Propose New Date/Time (Reschedule) */}
      {rescheduleAppnt && (
        <Modal
          isOpen={!!rescheduleAppnt}
          onClose={() => setRescheduleAppnt(null)}
          title={
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1877F2]" />
              <span className="font-bold text-slate-900">{t('Propose New Date / Time', 'नई तिथि / समय प्रस्तावित करें')}</span>
            </div>
          }
          size="md"
        >
          <form onSubmit={handleRescheduleSubmit} className="space-y-4">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <p className="font-bold">
                {t('Reschedule proposal for ', 'पुनर्निर्धारण प्रस्ताव: ')}{rescheduleAppnt.patient_name || 'Patient'}
              </p>
              <p className="text-[11px] text-blue-800">
                {t('Current slot was ', 'वर्तमान स्लॉट था: ')}{formatDate(rescheduleAppnt.scheduled_at)} {t('at', 'को')} {formatTime(rescheduleAppnt.scheduled_at)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Proposed Date', 'प्रस्तावित तिथि')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Proposed Time', 'प्रस्तावित समय')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Reason for Rescheduling / Message to Patient', 'पुनर्निर्धारण का कारण / मरीज़ के लिए संदेश')}
              </label>
              <textarea
                rows={3}
                value={rescheduleNotes}
                onChange={(e) => setRescheduleNotes(e.target.value)}
                placeholder={isHindi ? 'उदा. डॉक्टर एंडोस्कोपी राउंड में व्यस्त हैं। अगले ओपीडी दिन पूर्वाह्न 11:00 बजे का समय प्रस्तावित है।' : 'e.g. Doctor is in liver endoscopy rounds. Proposing 11:00 AM on next clinic day.'}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleAppnt(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                {t('Cancel', 'रद्द करें')}
              </button>
              <button
                type="submit"
                disabled={isSubmittingReschedule}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1877F2] hover:bg-blue-700 text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingReschedule ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Submitting...', 'भेजा जा रहा है...')}</span>
                  </>
                ) : (
                  <span>{t('Send Proposal', 'प्रस्ताव भेजें')}</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Modal: Reject Request */}
      {rejectAppnt && (
        <Modal
          isOpen={!!rejectAppnt}
          onClose={() => setRejectAppnt(null)}
          title={
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <span className="font-bold text-slate-900">{t('Decline Appointment Request', 'अपॉइंटमेंट अनुरोध अस्वीकार करें')}</span>
            </div>
          }
          size="md"
        >
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
              <p className="font-bold">
                {t('Declining consultation for ', 'परामर्श अस्वीकार किया जा रहा है: ')}{rejectAppnt.patient_name || 'Patient'}
              </p>
              <p className="text-[11px] text-rose-800">
                {t(
                  'The patient will be notified and this request slot will be cancelled. Please provide a clear clinical or scheduling reason.',
                  'रोगी को सूचित किया जाएगा और यह स्लॉट रद्द कर दिया जाएगा। कृपया स्पष्ट नैदानिक या समय-सारणी संबंधी कारण प्रदान करें।'
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Reason for Rejection', 'अस्वीकृति का कारण')} <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={isHindi ? 'उदा. यदि पीलिया या पेट दर्द तीव्र है तो कृपया तत्काल आपातकालीन वार्ड में संपर्क करें, या शुक्रवार का नया स्लॉट बुक करें।' : 'e.g. Please consult urgent care immediately if jaundice/pain is acute, or submit a new slot for Friday.'}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectAppnt(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                {t('Cancel', 'रद्द करें')}
              </button>
              <button
                type="submit"
                disabled={isSubmittingReject}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingReject ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Declining...', 'अस्वीकार हो रहा है...')}</span>
                  </>
                ) : (
                  <span>{t('Decline Request', 'अनुरोध अस्वीकार करें')}</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
