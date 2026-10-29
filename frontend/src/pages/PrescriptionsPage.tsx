import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Eye,
  FileText,
  Filter,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Column, DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Prescription } from '@/types';

export const PrescriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  const loadPrescriptions = async () => {
    setIsLoading(true);
    try {
      const res = await api.prescriptions.list({
        q: searchQuery,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: 15,
      });
      if (res.success) {
        setPrescriptions(res.prescriptions);
        setTotal(res.total);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load prescriptions archive');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [page, startDate, endDate, sortColumn, sortDirection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPrescriptions();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSortColumn('created_at');
    setSortDirection('desc');
    setPage(1);
  };

  const handleSort = (columnKey: string) => {
    const mapped = columnKey === 'patient' ? 'created_at' : columnKey === 'frequency' ? 'frequency_days' : columnKey === 'follow_up' ? 'follow_up_date' : columnKey;
    if (sortColumn === mapped) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(mapped);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const hasActiveFilters = searchQuery || startDate || endDate;

  const handlePrint = () => {
    window.print();
  };

  const columns: Column<Prescription>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: (rx) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
            {rx.patient_name ? rx.patient_name.charAt(0) : 'P'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-xs">{rx.patient_name || `Patient #${rx.patient_id}`}</p>
            <span className="text-[10px] text-slate-400">ID #{rx.patient_id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'medicine',
      header: 'Prescribed Medicine',
      sortable: true,
      render: (rx) => (
        <div>
          <span className="font-bold text-slate-900 text-xs">{rx.medicine}</span>
          <p className="text-[11px] text-slate-500">{rx.dosage}</p>
        </div>
      ),
    },
    {
      key: 'frequency',
      header: 'Duration',
      sortable: true,
      render: (rx) => (
        <span className="text-xs text-slate-600 font-medium">
          {rx.frequency_days} days
        </span>
      ),
    },
    {
      key: 'doctor',
      header: 'Prescribing Clinician',
      render: (rx) => (
        <span className="text-xs font-semibold text-slate-700">
          {rx.doctor_name ? `Dr. ${rx.doctor_name}` : `Doctor #${rx.doctor_id}`}
        </span>
      ),
    },
    {
      key: 'follow_up',
      header: 'Follow-up Date',
      sortable: true,
      render: (rx) => (
        <span className="text-xs text-slate-600 font-medium">
          {rx.follow_up_date || 'None scheduled'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date Issued',
      sortable: true,
      render: (rx) => (
        <span className="text-xs text-slate-500">
          {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (rx) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedPrescription(rx)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1"
          >
            <Eye className="w-3 h-3" /> View Rx
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-6 h-6 text-indigo-600" />
            Prescriptions Archive
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Historical medication orders, dietary recommendations, and clinical consultation records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPrescriptions}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          {['hepatologist', 'admin'].includes(user?.role || '') && (
            <Link
              to="/doctor/reviews"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Prescription
            </Link>
          )}
        </div>
      </div>

      {/* Search & Date Filter Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by medication name, patient, or physician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
            <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto">
              Search
            </Button>
          </form>

          {/* Date Range & Reset Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Issued Date:
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-500"
                  title="Filter by prescription start date"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-500"
                  title="Filter by prescription end date"
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
              Showing <b className="text-slate-900">{prescriptions.length}</b> of <b className="text-slate-900">{total}</b> prescriptions
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions Table with sorting & pagination */}
      <DataTable
        columns={columns}
        data={prescriptions}
        isLoading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage="No prescriptions match your criteria."
        pagination={{
          currentPage: page,
          totalPages: Math.ceil(total / 15) || 1,
          totalItems: total,
          itemsPerPage: 15,
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Printable Prescription Modal using shared Modal */}
      <Modal
        isOpen={Boolean(selectedPrescription)}
        onClose={() => setSelectedPrescription(null)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              Rx
            </div>
            <span>CirrhoCare AI Medical Prescription</span>
          </div>
        }
        description={
          selectedPrescription
            ? `Order Ref: #${selectedPrescription.id} · Issued ${
                selectedPrescription.created_at
                  ? new Date(selectedPrescription.created_at).toLocaleDateString()
                  : ''
              }`
            : undefined
        }
        size="md"
        footer={
          <div className="flex items-center justify-between w-full print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Rx
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedPrescription(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedPrescription && (
          <div className="space-y-4">
            {/* Patient & Doctor Meta */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Patient</span>
                <strong className="text-slate-900 text-sm">
                  {selectedPrescription.patient_name || `Patient #${selectedPrescription.patient_id}`}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Attending Physician</span>
                <strong className="text-indigo-900 text-sm">
                  {selectedPrescription.doctor_name
                    ? `Dr. ${selectedPrescription.doctor_name}`
                    : `Doctor #${selectedPrescription.doctor_id}`}
                </strong>
              </div>
            </div>

            {/* Medicine Details */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-indigo-950">{selectedPrescription.medicine}</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {selectedPrescription.frequency_days} Days Course
                </span>
              </div>
              <p className="text-xs text-slate-700">
                <strong>Dosage Instructions:</strong> {selectedPrescription.dosage}
              </p>
            </div>

            {/* Clinical Notes & Diet */}
            {selectedPrescription.clinical_notes && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase text-slate-600">Clinical Observations & Rationale</h4>
                <p className="text-xs text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                  {selectedPrescription.clinical_notes}
                </p>
              </div>
            )}

            {selectedPrescription.diet_suggestion && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase text-slate-600">Dietary & Lifestyle Directives</h4>
                <p className="text-xs text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                  {selectedPrescription.diet_suggestion}
                </p>
              </div>
            )}

            {selectedPrescription.follow_up_date && (
              <div className="text-xs text-indigo-900 font-bold p-2.5 rounded-xl bg-purple-50 border border-purple-200/60">
                Scheduled Clinical Follow-up: {selectedPrescription.follow_up_date}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
