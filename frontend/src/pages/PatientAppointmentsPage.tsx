import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  Stethoscope,
  Info,
  Search,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  RotateCcw,
  Check,
  LayoutList,
  History,
} from 'lucide-react';
import { api } from '../services/api';
import { Appointment, User, Patient } from '../types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { useToast } from '@/app/ToastContext';

export const PatientAppointmentsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [myRecords, setMyRecords] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View state: 'list' or 'timeline'
  const [activeView, setActiveView] = useState<'list' | 'timeline'>('list');

  // Filter & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Booking Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookModalFeedback, setBookModalFeedback] = useState<string | null>(null);

  // Reschedule Modal State
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [appntRes, docRes, patRes] = await Promise.all([
        api.appointments.list({
          q: searchQuery,
          status: statusFilter,
          start_date: startDate,
          end_date: endDate,
          sort_by: 'scheduled_at',
          sort_dir: sortDirection,
          page,
          per_page: 8,
        }),
        api.doctors.list().catch(() => ({ success: true, doctors: [] })),
        api.patients.list().catch(() => ({ success: true, patients: [] })),
      ]);

      if (appntRes && appntRes.success) {
        setAppointments(appntRes.appointments || []);
        setTotal(appntRes.total || 0);
      }
      if (docRes && docRes.success) {
        setDoctors(docRes.doctors || []);
      }
      if (patRes && patRes.success) {
        setMyRecords(patRes.patients || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load appointments.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, startDate, endDate, sortDirection, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setSortDirection('asc');
    setPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter || startDate || endDate;
  const todayStr = new Date().toISOString().split('T')[0];

  // Booking Submission
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedTime || !reason.trim()) {
      setBookModalFeedback('All booking fields are required.');
      return;
    }

    if (myRecords.length === 0) {
      setBookModalFeedback('No active clinical patient record linked to your portal ID. Please contact clinical reception.');
      return;
    }

    const patientId = myRecords[0].id;
    const isoDateTime = `${selectedDate}T${selectedTime}:00`;

    setIsSubmitting(true);
    setBookModalFeedback(null);
    try {
      const res = await api.appointments.create({
        patient_id: patientId,
        doctor_id: Number(selectedDoctorId),
        scheduled_at: isoDateTime,
        reason: reason.trim(),
      });

      if (res && res.success) {
        success('Consultation requested successfully! Your doctor will confirm shortly.');
        setIsBookModalOpen(false);
        setSelectedDoctorId('');
        setSelectedDate('');
        setSelectedTime('');
        setReason('');
        fetchData();
      } else {
        setBookModalFeedback(res.message || 'Failed to book appointment.');
      }
    } catch (err: any) {
      setBookModalFeedback(err.message || 'Unable to schedule appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (appnt: Appointment) => {
    setRescheduleTarget(appnt);
    setRescheduleError(null);
    if (appnt.scheduled_at) {
      const dt = new Date(appnt.scheduled_at);
      setRescheduleDate(dt.toISOString().split('T')[0]);
      setRescheduleTime(dt.toTimeString().slice(0, 5));
    } else {
      setRescheduleDate('');
      setRescheduleTime('');
    }
    setRescheduleReason(appnt.reason || '');
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select a valid date and time.');
      return;
    }

    const isoDateTime = `${rescheduleDate}T${rescheduleTime}:00`;
    setIsRescheduling(true);
    setRescheduleError(null);
    try {
      const res = await api.appointments.reschedule(rescheduleTarget.id, {
        scheduled_at: isoDateTime,
        reason: rescheduleReason.trim() || undefined,
      });

      if (res && res.success) {
        success('Consultation successfully rescheduled! Status set to Pending confirmation.');
        setRescheduleTarget(null);
        fetchData();
      } else {
        setRescheduleError(res.message || 'Failed to reschedule appointment.');
      }
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment.');
    } finally {
      setIsRescheduling(false);
    }
  };

  // Confirm Cancellation
  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const res = await api.appointments.updateStatus(cancelTarget.id, 'Cancelled');
      if (res && res.success) {
        success('Consultation has been cancelled.');
        setCancelTarget(null);
        fetchData();
      } else {
        toastError(res.message || 'Failed to cancel appointment.');
      }
    } catch (err: any) {
      toastError(err.message || 'Error occurred while cancelling appointment.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CalendarCheck className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            <CalendarX className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <CalendarClock className="w-3.5 h-3.5" /> Pending Confirmation
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <LoadingSpinner />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading your scheduled consultations...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
        <h3 className="text-base font-bold text-rose-900">Appointments Service Alert</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
            My Appointments
          </h1>
          <p className="text-sm text-slate-500">
            View scheduled visits, check consultation status, or schedule an appointment with a specialist.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeView === 'list'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Card view"
            >
              <LayoutList className="w-3.5 h-3.5" /> Cards
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeView === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Timeline view"
            >
              <History className="w-3.5 h-3.5" /> Timeline
            </button>
          </div>

          <button
            onClick={() => {
              setBookModalFeedback(null);
              setIsBookModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Book Consultation
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search appointments by clinician or reason..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-44 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Search
          </button>
        </form>

        {/* Date range & Clear filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Scheduled Date:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition"
              >
                <X className="w-3 h-3 text-slate-400" /> Clear Filters
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {appointments.length} of {total} visits
          </span>
        </div>
      </div>

      {/* Quick Status Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Filter by Status:</span>
        {[
          { label: 'All Consultations', value: '' },
          { label: 'Pending', value: 'Pending' },
          { label: 'Confirmed', value: 'Confirmed' },
          { label: 'Completed', value: 'Completed' },
          { label: 'Cancelled', value: 'Cancelled' },
        ].map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => {
              setStatusFilter(chip.value);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              statusFilter === chip.value
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Appointments View: List or Timeline */}
      {appointments.length > 0 ? (
        activeView === 'list' ? (
          <div className="space-y-4">
            {appointments.map((appnt) => {
              const isTerminal = appnt.status === 'Completed' || appnt.status === 'Cancelled';
              return (
                <div
                  key={appnt.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          {appnt.doctor_name ? `Dr. ${appnt.doctor_name}` : 'Attending Hepatologist'}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Consultation #{appnt.id}
                        </p>
                      </div>
                      {getStatusBadge(appnt.status)}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <strong className="text-slate-800 dark:text-slate-200">Reason for Visit:</strong>{' '}
                      {appnt.reason}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        {appnt.scheduled_at
                          ? new Date(appnt.scheduled_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Date to be finalized'}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3.5 h-3.5" />
                        {appnt.scheduled_at
                          ? new Date(appnt.scheduled_at).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'TBD'}
                      </span>
                    </div>

                    {!isTerminal && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRescheduleModal(appnt)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reschedule
                        </button>
                        <button
                          onClick={() => setCancelTarget(appnt)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-xs font-semibold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / 8) || 1}
                totalItems={total}
                itemsPerPage={8}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        ) : (
          /* Timeline View */
          <div className="space-y-6">
            <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {appointments.map((appnt) => {
                const isTerminal = appnt.status === 'Completed' || appnt.status === 'Cancelled';
                const isUpcoming = appnt.status === 'Pending' || appnt.status === 'Confirmed';
                const appntDate = appnt.scheduled_at ? new Date(appnt.scheduled_at) : null;

                return (
                  <div key={appnt.id} className="relative group">
                    {/* Bullet */}
                    <div
                      className={`absolute -left-6 top-4 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 transition ${
                        appnt.status === 'Confirmed'
                          ? 'bg-emerald-500'
                          : appnt.status === 'Completed'
                          ? 'bg-blue-500'
                          : appnt.status === 'Cancelled'
                          ? 'bg-slate-400'
                          : 'bg-amber-500'
                      }`}
                    />

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {appnt.doctor_name ? `Dr. ${appnt.doctor_name}` : 'Attending Hepatologist'}
                          </span>
                          <span className="text-xs text-slate-400">#{appnt.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(appnt.status)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          {appntDate ? appntDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {appntDate ? appntDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <strong>Reason:</strong> {appnt.reason}
                      </div>

                      {!isTerminal && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => openRescheduleModal(appnt)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Reschedule
                          </button>
                          <button
                            onClick={() => setCancelTarget(appnt)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg text-xs font-semibold transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / 8) || 1}
                totalItems={total}
                itemsPerPage={8}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Calendar className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {hasActiveFilters ? 'No Consultations Match Your Filter' : 'No Consultations Scheduled'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try clearing the search query or status filter to see other appointments.'
              : 'You do not have any upcoming visits or consultations on file. You can request a visit with an attending hepatologist to review your liver condition and lab results.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
            <button
              onClick={() => {
                setBookModalFeedback(null);
                setIsBookModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> Book Consultation with Specialist
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Stethoscope className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Schedule Liver Specialist Consultation
                </h3>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookModalFeedback && (
              <div className="p-3.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{bookModalFeedback}</span>
              </div>
            )}

            {myRecords.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  No active clinical record linked to your portal ID. Clinical intake must be performed before appointments can be confirmed.
                </p>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold uppercase tracking-wider text-slate-500">
                  Select Attending Hepatologist
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(Number(e.target.value) || '')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Choose an attending doctor...</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name} ({doc.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-bold uppercase tracking-wider text-slate-500">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={todayStr}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold uppercase tracking-wider text-slate-500">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold uppercase tracking-wider text-slate-500">
                  Reason for Consultation / Symptoms
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Routine review of liver enzyme panel, consultation on jaundice or fatigue..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || myRecords.length === 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Reschedule Consultation #{rescheduleTarget.id}
                </h3>
              </div>
              <button
                onClick={() => setRescheduleTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rescheduleError && (
              <div className="p-3.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-300">
              <p>
                <strong>Clinician:</strong> Dr. {rescheduleTarget.doctor_name || 'Attending Doctor'}
              </p>
              <p className="mt-1">
                Rescheduling will set your appointment status back to <strong>Pending</strong> until your doctor confirms the new time slot.
              </p>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-bold uppercase tracking-wider text-slate-500">
                    New Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={todayStr}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold uppercase tracking-wider text-slate-500">
                    New Time
                  </label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold uppercase tracking-wider text-slate-500">
                  Reason for Rescheduling / Visit Notes
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={3}
                  placeholder="Provide updated clinical context or reason for changing the time..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRescheduling}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {isRescheduling ? 'Rescheduling...' : 'Submit New Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
              <CalendarX className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Cancel Consultation #{cancelTarget.id}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you wish to cancel your scheduled appointment with{' '}
                <strong>Dr. {cancelTarget.doctor_name || 'Attending Doctor'}</strong> on{' '}
                <strong>
                  {cancelTarget.scheduled_at
                    ? new Date(cancelTarget.scheduled_at).toLocaleDateString()
                    : 'scheduled date'}
                </strong>
                ? This action will mark the visit as Cancelled and notify your clinical team.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 text-xs"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isCancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientAppointmentsPage;
