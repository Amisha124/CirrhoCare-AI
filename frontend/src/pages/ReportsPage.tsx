import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Download, FileText, Filter, Plus, RefreshCw, Search, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Button } from '@/components/common/Button';
import { Card, CardContent } from '@/components/common/Card';
import { Column, DataTable } from '@/components/common/DataTable';
import { api } from '@/services/api';
import type { MedicalReport } from '@/types';

const CLINICAL_CATEGORIES = [
  'Liver Function Test (LFT)',
  'Complete Blood Count (CBC)',
  'Ultrasound Abdomen',
  'Biopsy Pathology',
  'Coagulation Profile (PT/INR)',
  'Lab report',
  'CT Scan / MRI',
  'Follow-up Clinical Notes',
];

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('uploaded_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const canUpload = ['admin', 'labtech'].includes(user?.role || '');
  const canViewAnalytics = ['admin', 'labtech', 'hepatologist'].includes(user?.role || '');

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await api.reports.list({
        q: searchQuery,
        category: selectedCategory,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: 15,
      });
      if (res.success) {
        setReports(res.reports);
        setTotal(res.total);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [page, selectedCategory, startDate, endDate, sortColumn, sortDirection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadReports();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setStartDate('');
    setEndDate('');
    setSortColumn('uploaded_at');
    setSortDirection('desc');
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

  const hasActiveFilters = searchQuery || selectedCategory || startDate || endDate;

  const columns: Column<MedicalReport>[] = [
    {
      key: 'original_filename',
      header: 'Report Document',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900">{r.original_filename}</p>
            <p className="text-[11px] text-slate-400">Category: {r.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'patient_name',
      header: 'Patient Profile',
      render: (r) => (
        <span className="text-xs font-semibold text-slate-700">
          {r.patient_name || `Patient #${r.patient_id}`}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (r) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
          {r.category || 'Lab report'}
        </span>
      ),
    },
    {
      key: 'uploaded_at',
      header: 'Upload Date',
      sortable: true,
      render: (r) => (
        <span className="text-xs text-slate-500 font-medium">
          {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'security',
      header: 'Access Protection',
      render: () => (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
          <ShieldCheck className="w-3.5 h-3.5" />
          Authenticated
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Download',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (r) => (
        <div className="flex justify-end">
          <a
            href={api.reports.getDownloadUrl(r.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Medical & Laboratory Reports</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Protected laboratory documents, imaging scans, and pathology evaluations.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadReports} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {canViewAnalytics && (
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              Report Analytics
            </Link>
          )}
          {canUpload && (
            <Link
              to="/lab/upload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Report
            </Link>
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
                placeholder="Search by report filename, patient name, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-60 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-slate-700"
            >
              <option value="">All Categories</option>
              {CLINICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto">
              Search
            </Button>
          </form>

          {/* Date Range & Reset Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Upload Date:
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
                  title="Filter by upload start date"
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
                  title="Filter by upload end date"
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
              Showing <b className="text-slate-900">{reports.length}</b> of <b className="text-slate-900">{total}</b> reports
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={reports}
        isLoading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage="No laboratory reports match your criteria."
        pagination={{
          currentPage: page,
          totalPages: Math.ceil(total / 15) || 1,
          totalItems: total,
          itemsPerPage: 15,
          onPageChange: (p) => setPage(p),
        }}
      />
    </div>
  );
};
