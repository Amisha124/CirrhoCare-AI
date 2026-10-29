import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Calendar,
  Activity,
  HeartPulse,
  Download,
  AlertTriangle,
  RefreshCw,
  Stethoscope,
  Pill,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Patient } from '../types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/app/ToastContext';

export const PatientRecordsPage: React.FC = () => {
  const { success, error } = useToast();
  const [records, setRecords] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const url = api.exports.getPdfUrl();
      await api.exports.downloadFile(url, 'my_health_summary.pdf');
      success('Health summary report downloaded successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to download health summary report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.patients.list();
      if (res && res.success) {
        setRecords(res.patients || []);
      } else {
        setErrorMessage('Failed to load health records.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve clinical records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <LoadingSpinner />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Retrieving your confidential health records...
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
        <h3 className="text-base font-bold text-rose-900">Health Records Access Alert</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
        <button
          onClick={fetchRecords}
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
            My Health Records
          </h1>
          <p className="text-sm text-slate-500">
            Verified clinical evaluations, diagnosis triage, and attending clinician notes.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {records.length > 0 && (
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
              title="Download your official clinical evaluation report as PDF"
            >
              <Download className="w-3.5 h-3.5" />
              {isDownloading ? 'Generating PDF...' : 'Download Summary (PDF)'}
            </button>
          )}
          <Link
            to="/patient/appointments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedule Consultation
          </Link>
        </div>
      </div>

      {records.length > 0 ? (
        <div className="space-y-6">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-6"
            >
              {/* Top Record Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-slate-900 dark:text-white">
                      Evaluation #{rec.id}
                    </span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                        rec.latest_risk_label === 'High Risk'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : rec.latest_risk_label === 'Medium Risk'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {rec.latest_risk_label || 'Low Risk'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                      {rec.treatment_status || 'Under review'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Intake Date: {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/patient/biomarkers"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Biomarker Breakdown
                  </Link>
                </div>
              </div>

              {/* Vitals Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Bilirubin</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.bilirubin !== undefined && rec.bilirubin !== null ? `${rec.bilirubin} mg/dL` : 'Not available'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Albumin</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.albumin !== undefined && rec.albumin !== null ? `${rec.albumin} g/dL` : 'Not available'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Platelets</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.platelets !== undefined && rec.platelets !== null ? `${rec.platelets} x10³/µL` : 'Not available'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">SGOT (AST)</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.sgot !== undefined && rec.sgot !== null ? `${rec.sgot} U/L` : 'Not available'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">SGPT (ALT)</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.sgpt !== undefined && rec.sgpt !== null ? `${rec.sgpt} U/L` : 'Not available'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Prothrombin</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {rec.prothrombin !== undefined && rec.prothrombin !== null ? `${rec.prothrombin}s` : 'Not available'}
                  </span>
                </div>
              </div>

              {/* Prescriptions Section if any */}
              {rec.prescriptions && rec.prescriptions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-blue-600" />
                    Doctor Prescribed Medications & Diet Guidance
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rec.prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-blue-900 dark:text-blue-200">
                            {rx.medicine}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            Dr. {rx.doctor_name || 'Hepatologist'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          <strong>Dosage:</strong> {rx.dosage} (Duration: {rx.frequency_days} days)
                        </p>
                        {rx.diet_suggestion && (
                          <p className="text-slate-600 dark:text-slate-300">
                            <strong>Dietary Guidance:</strong> {rx.diet_suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Reports if any */}
              {rec.reports && rec.reports.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    Attached Diagnostic Reports
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {rec.reports.map((rep) => (
                      <a
                        key={rep.id}
                        href={api.reports.getDownloadUrl(rep.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-600" />
                        {rep.original_filename || rep.filename}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            No Health Records Found On File
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Your clinical history, physician notes, and laboratory evaluations will appear here as soon as an attending hepatologist or laboratory technician enters your diagnostic panel.
          </p>
          <div className="pt-2">
            <Link
              to="/patient/appointments"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              <Calendar className="w-4 h-4" /> Book Consultation with Specialist
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientRecordsPage;
