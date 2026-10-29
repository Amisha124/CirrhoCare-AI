import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Search,
  Calendar,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Prediction } from '../types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

export const PatientPredictionsPage: React.FC = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortColumn, setSortColumn] = useState<'created_at' | 'probability'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const perPage = 10;

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.predictions.list({
        q: searchQuery,
        risk: selectedRisk,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: perPage,
      });
      if (res && res.success) {
        setPredictions(res.predictions || []);
        setTotal(res.total ?? (res.predictions ? res.predictions.length : 0));
      } else {
        setErrorMessage('Failed to load AI prediction history.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve prediction history.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedRisk, startDate, endDate, sortColumn, sortDirection, page]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPredictions();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRisk('');
    setStartDate('');
    setEndDate('');
    setSortColumn('created_at');
    setSortDirection('desc');
    setPage(1);
  };

  const toggleSort = (col: 'created_at' | 'probability') => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedRisk || startDate || endDate;
  const totalPages = Math.ceil(total / perPage) || 1;

  if (isLoading && predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <LoadingSpinner />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Retrieving your recorded AI decision-support history...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
        <h3 className="text-base font-bold text-rose-900">Prediction History Access Alert</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
        <button
          onClick={fetchPredictions}
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
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
          AI Risk Prediction History
        </h1>
        <p className="text-sm text-slate-500">
          Stored investigational cirrhosis risk assessments and statistical evaluations.
        </p>
      </div>

      {/* Mandatory Experimental Model Disclaimer */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-4 shadow-sm">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-sm text-amber-900 dark:text-amber-100">
            Important Medical & Machine Learning Advisory
          </h3>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            CirrhoCare AI operates an exploratory Random Forest model trained on a benchmark dataset of <strong>only 17 observations</strong>. The computed risk scores and probabilities are experimental research metrics developed exclusively for investigational triage assistance.
          </p>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>This system does NOT provide a definitive clinical diagnosis.</strong> Do not initiate, stop, or adjust any medical treatments based on these scores. Always consult with your attending hepatologist or healthcare provider for an individualized diagnostic evaluation.
          </p>
        </div>
      </div>

      {/* Search and Filters Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments by model name, notes, or ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <select
            value={selectedRisk}
            onChange={(e) => {
              setSelectedRisk(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-48 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Risk Tiers</option>
            <option value="Low Risk">Low Risk</option>
            <option value="Medium Risk">Medium Risk</option>
            <option value="High Risk">High Risk</option>
          </select>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Search
          </button>
        </form>

        {/* Date Filters and Sorting Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Evaluated Between:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg font-medium transition"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>

          {/* Sorting Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sort by:</span>
            <button
              type="button"
              onClick={() => toggleSort('created_at')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                sortColumn === 'created_at'
                  ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Date
              {sortColumn === 'created_at' ? (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => toggleSort('probability')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                sortColumn === 'probability'
                  ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Probability
              {sortColumn === 'probability' ? (
                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Result summary banner */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span>
            Showing <strong className="text-slate-700 dark:text-slate-200">{predictions.length}</strong> of{' '}
            <strong className="text-slate-700 dark:text-slate-200">{total}</strong> recorded assessments
          </span>
          {hasActiveFilters && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Filtered results active
            </span>
          )}
        </div>
      </div>

      {/* Predictions List */}
      {predictions.length > 0 ? (
        <div className="space-y-4">
          {predictions.map((pred) => (
            <div
              key={pred.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-slate-900 dark:text-white block">
                      Assessment #{pred.id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Evaluated on:{' '}
                      {pred.created_at ? new Date(pred.created_at).toLocaleString() : 'Recorded'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Model: <span className="font-mono text-slate-700 dark:text-slate-300">{pred.model_name || 'Random Forest'}</span>. Evaluated using standardized numerical and clinical examination biomarkers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Calculated Risk
                  </span>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      pred.risk_label === 'High Risk'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        : pred.risk_label === 'Medium Risk'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    }`}
                  >
                    {pred.risk_label}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-center min-w-[90px]">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Probability
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {pred.probability !== undefined && pred.probability !== null ? `${pred.probability.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-4 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            {hasActiveFilters ? <Filter className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {hasActiveFilters ? 'No Matching AI Risk Assessments' : 'No Stored AI Risk Assessments'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'No assessments match your current search query or date filter criteria. Try broadening your filter parameters.'
              : 'Historical machine learning assessments are created when your clinical team performs an evaluation during triage. Stored predictions and evaluation timestamps will be preserved here for your review.'}
          </p>
          <div className="pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                <X className="w-4 h-4" /> Clear All Filters
              </button>
            ) : (
              <Link
                to="/patient/appointments"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                <Calendar className="w-4 h-4" /> Discuss with Attending Clinician
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientPredictionsPage;

