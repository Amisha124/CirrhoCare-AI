import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  Filter,
  Plus,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  User,
  Stethoscope,
  List,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent } from '@/components/common/Card';
import { Column, DataTable } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Appointment, Patient, User as UserType } from '@/types';

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('scheduled_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  // Booking Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [patientList, setPatientList] = useState<Patient[]>([]);
  const [doctorList, setDoctorList] = useState<UserType[]>([]);
  const [bookPatientId, setBookPatientId] = useState<number | ''>('');
  const [bookDoctorId, setBookDoctorId] = useState<number | ''>(
    user?.role === 'hepatologist' ? user.id : ''
  );
  const [bookDate, setBookDate] = useState<string>('');
  const [bookTime, setBookTime] = useState<string>('');
  const [bookReason, setBookReason] = useState<string>('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState<boolean>(false);
  const [bookError, setBookError] = useState<string | null>(null);

  // Reschedule Modal State
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancellation Confirmation Modal State
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.appointments.list({
        q: searchQuery,
        status: selectedStatus,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: 15,
      });
      if (res.success) {
        setAppointments(res.appointments);
        setTotal(res.total);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedStatus, startDate, endDate, sortColumn, sortDirection, page, error]);

  const loadBookingPrerequisites = async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        api.patients.list({ per_page: 100 }),
        api.doctors.list(),
      ]);
      if (patRes.success) setPatientList(patRes.patients || []);
      if (docRes.success) setDoctorList(docRes.doctors || []);
    } catch (err: any) {
      error(err.message || 'Failed to load clinicians and patients');
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAppointments();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
    setSortColumn('scheduled_at');
    setSortDirection('asc');
    setPage(1);
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
    setPage(1);
  };

  // Status Transitions
  const handleStatusUpdate = async (id: number, status: 'Confirmed' | 'Completed' | 'Cancelled') => {
    try {
      const res = await api.appointments.updateStatus(id, status);
      if (res.success) {
        success(`Appointment marked as ${status}`);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
      }
    } catch (err: any) {
      error(err.message || 'Failed to update appointment status');
    }
  };

  // Open Book Modal
  const openBookModal = () => {
    setBookError(null);
    setBookPatientId('');
    setBookDoctorId(user?.role === 'hepatologist' ? user.id : '');
    setBookDate('');
    setBookTime('');
    setBookReason('');
    loadBookingPrerequisites();
    setIsBookModalOpen(true);
  };

  // Submit Booking
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookPatientId || !bookDoctorId || !bookDate || !bookTime || !bookReason.trim()) {
      setBookError('All fields (patient, clinician, date, time, and reason) are required.');
      return;
    }

    const isoDateTime = `${bookDate}T${bookTime}:00`;
    setIsBookingSubmitting(true);
    setBookError(null);
    try {
      const res = await api.appointments.create({
        patient_id: Number(bookPatientId),
        doctor_id: Number(bookDoctorId),
        scheduled_at: isoDateTime,
        reason: bookReason.trim(),
      });
      if (res.success) {
        success('Consultation successfully scheduled!');
        setIsBookModalOpen(false);
        loadAppointments();
      }
    } catch (err: any) {
      setBookError(err.message || 'Failed to schedule consultation.');
    } finally {
      setIsBookingSubmitting(false);
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
      setRescheduleError('Please select a valid new date and time.');
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
      if (res.success) {
        success('Consultation successfully rescheduled!');
        setRescheduleTarget(null);
        loadAppointments();
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
      if (res.success) {
        success('Consultation cancelled successfully.');
        setCancelTarget(null);
        loadAppointments();
      }
    } catch (err: any) {
      error(err.message || 'Failed to cancel appointment');
    } finally {
      setIsCancelling(false);
    }
  };

  const hasActiveFilters = searchQuery || selectedStatus || startDate || endDate;
  const todayStr = new Date().toISOString().split('T')[0];

  const columns: Column<Appointment>[] = [
    {
      key: 'patient_name',
      header: 'Patient Identity',
      render: (a) => (
        <div>
          <p className="font-bold text-slate-900">{a.patient_name || `Patient #${a.patient_id}`}</p>
          {a.patient_portal_id && (
            <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
              {a.patient_portal_id}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'doctor_name',
      header: 'Attending Clinician',
      render: (a) => (
        <span className="text-xs font-semibold text-slate-700">
          {a.doctor_name ? `Dr. ${a.doctor_name}` : `Doctor #${a.doctor_id}`}
        </span>
      ),
    },
    {
      key: 'scheduled_at',
      header: 'Scheduled Date & Time',
      sortable: true,
      render: (a) => {
        const isPast = a.scheduled_at && new Date(a.scheduled_at) < new Date();
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Clock className={`w-3.5 h-3.5 ${isPast ? 'text-slate-400' : 'text-blue-600'}`} />
            <span className={isPast ? 'text-slate-500' : 'text-slate-800 font-semibold'}>
              {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'reason',
      header: 'Clinical Reason',
      render: (a) => <span className="text-xs text-slate-600 max-w-xs truncate block" title={a.reason}>{a.reason}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (a) => {
        const variants: Record<string, string> = {
          Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          Completed: 'bg-blue-50 text-blue-700 border-blue-200',
          Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
          Pending: 'bg-amber-50 text-amber-700 border-amber-200',
        };
        return (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${variants[a.status] || ''}`}>
            {a.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (a) => {
        if (!['admin', 'hepatologist'].includes(user?.role || '')) return null;

        // Terminal states: no further mutations permitted
        if (a.status === 'Completed' || a.status === 'Cancelled') {
          return <span className="text-[11px] text-slate-400 font-medium">Locked ({a.status})</span>;
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            {a.status === 'Pending' && (
              <button
                type="button"
                onClick={() => handleStatusUpdate(a.id, 'Confirmed')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
              >
                Confirm
              </button>
            )}
            {a.status === 'Confirmed' && (
              <button
                type="button"
                onClick={() => handleStatusUpdate(a.id, 'Completed')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              >
                Complete
              </button>
            )}
            <button
              type="button"
              onClick={() => openRescheduleModal(a)}
              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => setCancelTarget(a)}
              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
            >
              Cancel
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            Clinical Consultations & Appointments
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time hepatology scheduling, conflict detection, and consultation status management.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* View Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Timeline
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={loadAppointments} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>

          {['admin', 'hepatologist'].includes(user?.role || '') && (
            <Button variant="primary" size="sm" onClick={openBookModal} leftIcon={<Plus className="w-4 h-4" />}>
              New Appointment
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by patient name, ID, clinician, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-44 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto">
              Search
            </Button>
          </form>

          {/* Date Range & Reset Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" /> Scheduled Date:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500"
                  title="Filter by appointment start date"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500"
                  title="Filter by appointment end date"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition"
                >
                  <X className="w-3 h-3 text-slate-500" /> Clear Filters
                </button>
              )}
            </div>

            <div className="text-slate-500 font-medium">
              Showing <b className="text-slate-900">{appointments.length}</b> of <b className="text-slate-900">{total}</b> appointments
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Status Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
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
              setSelectedStatus(chip.value);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              selectedStatus === chip.value
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* View Mode: Table vs Timeline */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={appointments}
          isLoading={isLoading}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          emptyMessage="No clinical appointments match your criteria."
          pagination={{
            currentPage: page,
            totalPages: Math.ceil(total / 15) || 1,
            totalItems: total,
            onPageChange: (p) => setPage(p),
          }}
        />
      ) : (
        <div className="space-y-6">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-slate-400 text-sm">
                No clinical consultations match your criteria.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appointments.map((a) => {
                const isPast = a.scheduled_at && new Date(a.scheduled_at) < new Date();
                return (
                  <Card key={a.id} className="hover:shadow-md transition">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">{a.patient_name || `Patient #${a.patient_id}`}</h4>
                          <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                            {a.patient_portal_id || `#${a.patient_id}`}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            a.status === 'Confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : a.status === 'Completed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : a.status === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          <span>{a.doctor_name ? `Dr. ${a.doctor_name}` : `Doctor #${a.doctor_id}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock className={`w-3.5 h-3.5 ${isPast ? 'text-slate-400' : 'text-blue-600'}`} />
                          <span>{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 truncate" title={a.reason}>
                        <strong>Reason:</strong> {a.reason}
                      </div>

                      {/* Card Actions */}
                      {['admin', 'hepatologist'].includes(user?.role || '') && a.status !== 'Completed' && a.status !== 'Cancelled' && (
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 text-xs">
                          {a.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(a.id, 'Confirmed')}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              Confirm
                            </button>
                          )}
                          {a.status === 'Confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(a.id, 'Completed')}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openRescheduleModal(a)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(a)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SCHEDULE NEW CONSULTATION                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Clinical Consultation"
        description="Book a new liver care consultation with real-time overlap and conflict detection."
      >
        <form onSubmit={handleBookSubmit} className="space-y-4">
          {bookError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{bookError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Patient</label>
            <select
              value={bookPatientId}
              onChange={(e) => setBookPatientId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            >
              <option value="">Select Admitted Patient...</option>
              {patientList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.portal_id || `#${p.id}`}) — {p.latest_risk_label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Attending Clinician</label>
            <select
              value={bookDoctorId}
              onChange={(e) => setBookDoctorId(e.target.value ? Number(e.target.value) : '')}
              required
              disabled={user?.role === 'hepatologist'}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 disabled:opacity-75"
            >
              <option value="">Select Clinician...</option>
              {doctorList.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name} ({d.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Consultation Date</label>
              <input
                type="date"
                min={todayStr}
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
                required
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Time</label>
              <input
                type="time"
                value={bookTime}
                onChange={(e) => setBookTime(e.target.value)}
                required
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Clinical Reason</label>
            <textarea
              rows={3}
              value={bookReason}
              onChange={(e) => setBookReason(e.target.value)}
              placeholder="e.g. 3-month liver enzyme follow-up, viral hepatitis review, or ultrasound evaluation..."
              maxLength={220}
              required
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[10px] text-slate-400 text-right">{bookReason.length} / 220 chars</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isBookingSubmitting}>
              Schedule Consultation
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: RESCHEDULE CONSULTATION                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Consultation"
        description="Select a new appointment slot. Conflicting clinician and patient bookings will be checked automatically."
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
          {rescheduleError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{rescheduleError}</span>
            </div>
          )}

          {rescheduleTarget && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <p>
                <strong>Patient:</strong> {rescheduleTarget.patient_name}
              </p>
              <p>
                <strong>Current Time:</strong>{' '}
                {rescheduleTarget.scheduled_at
                  ? new Date(rescheduleTarget.scheduled_at).toLocaleString()
                  : 'Not set'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">New Date</label>
              <input
                type="date"
                min={todayStr}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">New Time</label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                required
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Reason / Notes</label>
            <input
              type="text"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="e.g. Clinician shift change or patient request..."
              maxLength={220}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setRescheduleTarget(null)}>
              Dismiss
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isRescheduling}>
              Confirm Reschedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CANCEL APPOINTMENT CONFIRMATION                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Consultation Confirmation"
        description="Are you sure you want to cancel this scheduled consultation? This action cannot be reversed."
      >
        <div className="space-y-4">
          {cancelTarget && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p>
                <strong>Patient:</strong> {cancelTarget.patient_name}
              </p>
              <p>
                <strong>Clinician:</strong> Dr. {cancelTarget.doctor_name}
              </p>
              <p>
                <strong>Scheduled For:</strong>{' '}
                {cancelTarget.scheduled_at ? new Date(cancelTarget.scheduled_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Keep Appointment
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelConfirm}
              isLoading={isCancelling}
              className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
            >
              Yes, Cancel Consultation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default AppointmentsPage;

