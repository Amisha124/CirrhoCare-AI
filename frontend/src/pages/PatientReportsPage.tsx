import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalReport } from '../types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

export const PatientReportsPage: React.FC = () => {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortColumn, setSortColumn] = useState('uploaded_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.reports.list({
        q: searchQuery,
        category: selectedCategory,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: 10,
      });
      if (res && res.success) {
        setReports(res.reports || []);
        setTotal(res.total || 0);
      } else {
        setErrorMessage('Failed to load laboratory reports.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve laboratory documents.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, startDate, endDate, sortColumn, sortDirection, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReports();
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

  if (isLoading && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <LoadingSpinner />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading your laboratory documents and diagnostic scans...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
        <h3 className="text-base font-bold text-rose-900">Laboratory Documents Access Alert</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
        <button
          onClick={fetchReports}
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
            Lab Reports & Documents
          </h1>
          <p className="text-sm text-slate-500">
            Securely access your diagnostic files, ultrasound scans, biopsy results, and blood panels.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-4 h-4" /> End-to-End Encrypted Access
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your reports by filename or category..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-52 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Categories</option>
            <option value="Lab report">Lab Report</option>
            <option value="Blood panel">Blood Panel</option>
            <option value="Ultrasound Scan">Ultrasound Scan</option>
            <option value="Liver Biopsy">Liver Biopsy</option>
            <option value="Diagnostic Imaging">Diagnostic Imaging</option>
          </select>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Search
          </button>
        </form>

        {/* Date range & Clear filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
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
            Showing {reports.length} of {total} documents
          </span>
        </div>
      </div>

      {/* Reports List */}
      {reports.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold text-[11px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th
                    className="py-4 px-6 cursor-pointer select-none hover:bg-slate-100/60 transition"
                    onClick={() => handleSort('original_filename')}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Document Name</span>
                      {sortColumn === 'original_filename' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 cursor-pointer select-none hover:bg-slate-100/60 transition"
                    onClick={() => handleSort('category')}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Category</span>
                      {sortColumn === 'category' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 cursor-pointer select-none hover:bg-slate-100/60 transition"
                    onClick={() => handleSort('uploaded_at')}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Upload Date</span>
                      {sortColumn === 'uploaded_at' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((rep) => (
                  <tr
                    key={rep.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {rep.original_filename || rep.filename}
                          </span>
                          <span className="text-[10px] text-slate-400">Document ID: #{rep.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {rep.category || 'Diagnostic'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {rep.uploaded_at
                        ? new Date(rep.uploaded_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <a
                        href={api.reports.getDownloadUrl(rep.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 10) || 1}
              totalItems={total}
              itemsPerPage={10}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <FileCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {hasActiveFilters ? 'No Reports Match Your Search' : 'No Lab Reports Archived Yet'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try adjusting your search keywords, category filter, or date range.'
              : 'Medical reports, laboratory blood panels, liver biopsies, and ultrasound documents uploaded by your healthcare team will appear here for secure viewing and download.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              <X className="w-3.5 h-3.5" /> Clear Search Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default PatientReportsPage;
