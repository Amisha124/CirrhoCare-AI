import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  FlaskConical,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent } from '@/components/common/Card';
import { Column, DataTable } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { RegisterPatientModal } from '@/components/patients/RegisterPatientModal';
import { LabTechDashboardPage } from './LabTechDashboardPage';
import { api } from '@/services/api';
import type { MedicalReport, Patient } from '@/types';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

const REPORT_CATEGORIES = [
  'Liver Function Test (LFT)',
  'Complete Blood Count (CBC)',
  'Ultrasound Abdomen',
  'Biopsy Pathology',
  'Coagulation Profile (PT/INR)',
  'Diagnostic Lab Report',
  'CT Scan / MRI',
];

const LAB_STATUS_OPTIONS = [
  'Registered',
  'Test In Progress',
  'Report Uploaded',
  'Completed',
] as const;

export const PatientsPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi } = useLanguage();
  const { success, error, info, warning } = useToast();

  const isLabTech = user?.role === 'labtech';
  const isAdmin = user?.role === 'admin';
  const isHepatologist = user?.role === 'hepatologist';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRisk, setSelectedRisk] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Exports & Registration Modal
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [invitingPatientId, setInvitingPatientId] = useState<number | null>(null);

  // Admin-only PIN reset state
  const [resettingPatientId, setResettingPatientId] = useState<number | null>(null);
  const [resetResult, setResetResult] = useState<{
    patient: Patient;
    portalId: string;
    newPin: string;
  } | null>(null);

  // Task 2: Enter Test Results Modal
  const [testResultsPatient, setTestResultsPatient] = useState<Patient | null>(null);
  const [testResultsForm, setTestResultsForm] = useState({
    bilirubin: '',
    direct_bilirubin: '',
    sgot: '',
    sgpt: '',
    albumin: '',
    platelets: '',
    prothrombin: '',
    alk_phos: '',
  });
  const [isSavingResults, setIsSavingResults] = useState(false);

  // Task 3: Upload PDF Report Modal
  const [uploadPdfPatient, setUploadPdfPatient] = useState<Patient | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('Liver Function Test (LFT)');
  const [markCompleteOnUpload, setMarkCompleteOnUpload] = useState<boolean>(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);

  // Task 4: Inline Status Updating
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const canRegister = isLabTech;

  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const res = await api.patients.list({
        q: searchQuery,
        risk: selectedRisk,
        status: selectedStatus,
        start_date: startDate,
        end_date: endDate,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: 15,
      });
      if (res.success) {
        setPatients(res.patients || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [page, selectedRisk, selectedStatus, startDate, endDate, sortColumn, sortDirection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPatients();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRisk('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
    setSortColumn('created_at');
    setSortDirection('desc');
    setPage(1);
  };

  const handleSort = (columnKey: string) => {
    const mappedKey = columnKey === 'age_gender' ? 'age' : columnKey === 'risk' ? 'latest_risk_label' : columnKey;
    if (sortColumn === mappedKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(mappedKey);
      setSortDirection('asc');
    }
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Task 1: Patient Registration Callback
  // ---------------------------------------------------------------------------
  const handlePatientRegistered = (newPatient: Patient) => {
    success(`Patient ${newPatient.full_name} registered successfully with ID: ${newPatient.portal_id}`);
    loadPatients();
  };

  // ---------------------------------------------------------------------------
  // Task 2: Enter / Edit Test Results
  // ---------------------------------------------------------------------------
  const handleOpenTestResults = (p: Patient) => {
    setTestResultsPatient(p);
    setTestResultsForm({
      bilirubin: p.bilirubin != null ? String(p.bilirubin) : '',
      direct_bilirubin: p.direct_bilirubin != null ? String(p.direct_bilirubin) : '',
      sgot: p.sgot != null ? String(p.sgot) : '',
      sgpt: p.sgpt != null ? String(p.sgpt) : '',
      albumin: p.albumin != null ? String(p.albumin) : '',
      platelets: p.platelets != null ? String(p.platelets) : '',
      prothrombin: p.prothrombin != null ? String(p.prothrombin) : '',
      alk_phos: p.alk_phos != null ? String(p.alk_phos) : '',
    });
  };

  const handleSaveTestResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testResultsPatient) return;

    setIsSavingResults(true);
    try {
      const payload: Partial<Patient> = {};
      if (testResultsForm.bilirubin !== '') payload.bilirubin = Number(testResultsForm.bilirubin);
      if (testResultsForm.direct_bilirubin !== '') payload.direct_bilirubin = Number(testResultsForm.direct_bilirubin);
      if (testResultsForm.sgot !== '') payload.sgot = Number(testResultsForm.sgot);
      if (testResultsForm.sgpt !== '') payload.sgpt = Number(testResultsForm.sgpt);
      if (testResultsForm.albumin !== '') payload.albumin = Number(testResultsForm.albumin);
      if (testResultsForm.platelets !== '') payload.platelets = Number(testResultsForm.platelets);
      if (testResultsForm.prothrombin !== '') payload.prothrombin = Number(testResultsForm.prothrombin);
      if (testResultsForm.alk_phos !== '') payload.alk_phos = Number(testResultsForm.alk_phos);

      // If patient is newly registered, advance status to Test In Progress
      if (testResultsPatient.lab_workflow_status === 'Registered') {
        payload.lab_workflow_status = 'Test In Progress';
      }

      const res = await api.patients.update(testResultsPatient.id, payload);
      if (res.success) {
        success(isHindi ? `परीक्षण परिणाम सहेजे गए: ${testResultsPatient.full_name}` : `Test results saved for ${testResultsPatient.full_name}`);
        setTestResultsPatient(null);
        loadPatients();
      }
    } catch (err: any) {
      error(err.message || 'Failed to save laboratory test results.');
    } finally {
      setIsSavingResults(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Task 3: Upload Diagnostic PDF Report
  // ---------------------------------------------------------------------------
  const handleOpenUploadPdf = (p: Patient) => {
    setUploadPdfPatient(p);
    setUploadFile(null);
    setUploadCategory('Liver Function Test (LFT)');
    setMarkCompleteOnUpload(false);
  };

  const handleSubmitUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadPdfPatient || !uploadFile) {
      error('Please select a PDF diagnostic report file to upload.');
      return;
    }

    const ext = uploadFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      error(`Unsupported file format. Please upload a PDF or document (${ALLOWED_EXTENSIONS.join(', ')}).`);
      return;
    }
    if (uploadFile.size > MAX_FILE_SIZE_BYTES) {
      error(`File size exceeds 8MB limit (${(uploadFile.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    setIsUploadingPdf(true);
    try {
      const latestOrder = uploadPdfPatient.lab_orders && uploadPdfPatient.lab_orders.length > 0
        ? uploadPdfPatient.lab_orders[0].id
        : undefined;

      const res = await api.reports.upload(
        uploadPdfPatient.id,
        uploadFile,
        uploadCategory,
        latestOrder,
        markCompleteOnUpload
      );

      if (res.success) {
        const newStatus = markCompleteOnUpload ? 'Completed' : 'Report Uploaded';
        await api.patients.update(uploadPdfPatient.id, { lab_workflow_status: newStatus });
        success(isHindi ? `रिपोर्ट अपलोड की गई: ${uploadPdfPatient.full_name}` : `Diagnostic PDF report uploaded for ${uploadPdfPatient.full_name}`);
        setUploadPdfPatient(null);
        setUploadFile(null);
        loadPatients();
      }
    } catch (err: any) {
      error(err.message || 'Failed to upload diagnostic PDF report.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleDownloadReport = async (report: MedicalReport) => {
    try {
      const downloadUrl = api.reports.getDownloadUrl(report.id);
      await api.exports.downloadFile(downloadUrl, report.original_filename);
      success(`Downloaded ${report.original_filename}`);
    } catch (err: any) {
      error(err.message || 'Failed to download report.');
    }
  };

  // ---------------------------------------------------------------------------
  // Task 4: Update Patient Status Dropdown
  // ---------------------------------------------------------------------------
  const getNormalizedLabStatus = (status: string | undefined): string => {
    if (!status) return 'Registered';
    if (['Registered', 'Test In Progress', 'Report Uploaded', 'Completed'].includes(status)) {
      return status;
    }
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'Completed';
    if (s.includes('report') || s.includes('uploaded')) return 'Report Uploaded';
    if (s.includes('progress') || s.includes('treatment') || s.includes('sample')) return 'Test In Progress';
    return 'Registered';
  };

  const handleStatusChange = async (patient: Patient, newStatus: string) => {
    setUpdatingStatusId(patient.id);
    try {
      const res = await api.patients.update(patient.id, { lab_workflow_status: newStatus });
      if (res.success) {
        success(isHindi ? `स्थिति बदलकर '${newStatus}' की गई (${patient.full_name})` : `Status updated to '${newStatus}' for ${patient.full_name}`);
        setPatients((prev) =>
          prev.map((p) => (p.id === patient.id ? { ...p, lab_workflow_status: newStatus } : p))
        );
      }
    } catch (err: any) {
      error(err.message || 'Failed to update patient status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Admin and Staff Action Handlers
  const handleInvite = async (patient: Patient) => {
    setInvitingPatientId(patient.id);
    try {
      const res = await api.patients.invite(patient.id);
      if (res.email_sent) {
        success(res.message || `Activation email sent to ${patient.email}.`);
      } else if (res.activation_url) {
        info(res.message || 'Activation link generated.');
      } else {
        warning(res.message || 'Activation invitation processed.');
      }
    } catch (err: any) {
      error(err.message || 'Failed to dispatch activation invitation.');
    } finally {
      setInvitingPatientId(null);
    }
  };

  const handleResetPin = async (patient: Patient) => {
    if (!isAdmin) {
      error('Unauthorized: Only administrators are authorized to reset patient login PINs.');
      return;
    }
    if (!window.confirm(`Generate a new Secret PIN for patient ${patient.full_name} (${patient.portal_id})?`)) {
      return;
    }
    setResettingPatientId(patient.id);
    try {
      const res = await api.patients.resetPin(patient.id);
      if (res.success) {
        setResetResult({
          patient,
          portalId: res.portal_id || patient.portal_id,
          newPin: res.new_pin,
        });
        success(`New PIN generated for ${patient.full_name}`);
      }
    } catch (err: any) {
      error(err.message || 'Failed to reset patient PIN.');
    } finally {
      setResettingPatientId(null);
    }
  };

  const handleExportCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const url = api.exports.getCsvUrl({
        q: searchQuery,
        risk: selectedRisk || undefined,
        status: selectedStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortColumn,
        sort_dir: sortDirection,
      });
      await api.exports.downloadFile(url, 'cirrhocare_patients_export.csv');
      success('Patient registry CSV exported successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to export patient records as CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const url = api.exports.getPdfUrl({
        q: searchQuery,
        risk: selectedRisk || undefined,
        status: selectedStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortColumn,
        sort_dir: sortDirection,
      });
      await api.exports.downloadFile(url, 'cirrhocare_patients_report.pdf');
      success('Clinical registry summary PDF exported successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to export clinical report as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Columns Definition
  // ---------------------------------------------------------------------------
  const columns: Column<Patient>[] = isLabTech
    ? [
        {
          key: 'full_name',
          header: isHindi ? 'रोगी विवरण' : 'Patient Details',
          sortable: true,
          render: (p) => (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                {p.full_name.charAt(0)}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900 leading-snug">{p.full_name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                    {p.portal_id}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {p.age}y · {p.gender}
                  </span>
                </div>
                {p.assigned_doctor_name && (
                  <p className="text-[11px] text-slate-500">
                    <span className="text-slate-400 font-semibold">{isHindi ? 'डॉक्टर:' : 'Doctor:'}</span> Dr. {p.assigned_doctor_name}
                  </p>
                )}
              </div>
            </div>
          ),
        },
        {
          key: 'test_results',
          header: isHindi ? 'परीक्षण परिणाम (Test Results)' : 'Laboratory Test Results',
          className: 'min-w-[240px]',
          render: (p) => {
            const hasResults =
              p.bilirubin != null ||
              p.direct_bilirubin != null ||
              p.sgot != null ||
              p.sgpt != null ||
              p.albumin != null ||
              p.platelets != null;

            return (
              <div className="space-y-1.5">
                {hasResults ? (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-slate-400 font-medium">{isHindi ? 'कुल बिली:' : 'Total Bili:'}</span>{' '}
                      <b className="text-slate-900">{p.bilirubin != null ? `${p.bilirubin} mg/dL` : '—'}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">{isHindi ? 'प्रत्यक्ष बिली:' : 'Direct Bili:'}</span>{' '}
                      <b className="text-slate-900">{p.direct_bilirubin != null ? `${p.direct_bilirubin} mg/dL` : '—'}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">SGOT (AST):</span>{' '}
                      <b className="text-slate-900">{p.sgot != null ? `${p.sgot} U/L` : '—'}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">SGPT (ALT):</span>{' '}
                      <b className="text-slate-900">{p.sgpt != null ? `${p.sgpt} U/L` : '—'}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">{isHindi ? 'एल्ब्यूमिन:' : 'Albumin:'}</span>{' '}
                      <b className="text-slate-900">{p.albumin != null ? `${p.albumin} g/dL` : '—'}</b>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">{isHindi ? 'प्लेटलेट्स:' : 'Platelets:'}</span>{' '}
                      <b className="text-slate-900">{p.platelets != null ? `${p.platelets}k` : '—'}</b>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic block py-0.5">
                    {isHindi ? 'परीक्षण परिणाम दर्ज नहीं हैं' : 'No results recorded yet'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenTestResults(p)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/80 transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                  title="Enter or update actual liver test results"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                  {hasResults ? (isHindi ? 'परिणाम संपादित करें' : 'Edit Results') : (isHindi ? 'परिणाम दर्ज करें' : 'Enter Test Results')}
                </button>
              </div>
            );
          },
        },
        {
          key: 'pdf_report',
          header: isHindi ? 'डायग्नोस्टिक रिपोर्ट (PDF)' : 'Diagnostic PDF Report',
          className: 'min-w-[210px]',
          render: (p) => {
            const latestReport = p.reports && p.reports.length > 0 ? p.reports[0] : null;

            if (latestReport) {
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-teal-50/60 border border-teal-200/80 p-2 rounded-xl">
                    <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="truncate max-w-[140px]" title={latestReport.original_filename}>
                      {latestReport.original_filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleDownloadReport(latestReport)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/70 transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Download or view diagnostic PDF report"
                    >
                      <Download className="w-3 h-3" />
                      {isHindi ? 'देखें / डाउनलोड' : 'View / Download'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenUploadPdf(p)}
                      className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      title="Upload a new replacement PDF report"
                    >
                      {isHindi ? 'नया अपलोड करें' : 'Upload New'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 italic block py-0.5">
                  {isHindi ? 'कोई रिपोर्ट अपलोड नहीं' : 'No report uploaded'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenUploadPdf(p)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Upload diagnostic PDF report for this patient"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isHindi ? 'पीडीएफ अपलोड करें' : 'Upload PDF'}
                </button>
              </div>
            );
          },
        },
        {
          key: 'status_dropdown',
          header: isHindi ? 'रोगी स्थिति (Status)' : 'Patient Status',
          className: 'min-w-[170px]',
          render: (p) => {
            const currentStatus = getNormalizedLabStatus(p.lab_workflow_status || p.treatment_status);

            const getSelectStyle = (status: string) => {
              switch (status) {
                case 'Completed':
                  return 'bg-emerald-50 text-emerald-800 border-emerald-300';
                case 'Report Uploaded':
                  return 'bg-purple-50 text-purple-800 border-purple-300';
                case 'Test In Progress':
                  return 'bg-blue-50 text-blue-800 border-blue-300';
                case 'Registered':
                default:
                  return 'bg-slate-50 text-slate-800 border-slate-300';
              }
            };

            return (
              <div className="space-y-1">
                <select
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(p, e.target.value)}
                  disabled={updatingStatusId === p.id}
                  className={`w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border outline-none transition cursor-pointer shadow-2xs ${getSelectStyle(
                    currentStatus
                  )} ${updatingStatusId === p.id ? 'opacity-50' : ''}`}
                  title="Select patient test status"
                >
                  <option value="Registered">{isHindi ? 'पंजीकृत (Registered)' : 'Registered'}</option>
                  <option value="Test In Progress">{isHindi ? 'प्रक्रियाधीन (Test In Progress)' : 'Test In Progress'}</option>
                  <option value="Report Uploaded">{isHindi ? 'रिपोर्ट अपलोड (Report Uploaded)' : 'Report Uploaded'}</option>
                  <option value="Completed">{isHindi ? 'पूर्ण (Completed)' : 'Completed'}</option>
                </select>
              </div>
            );
          },
        },
        {
          key: 'actions',
          header: isHindi ? 'कार्य' : 'Actions',
          className: 'text-right min-w-[110px]',
          headerClassName: 'text-right',
          render: (p) => (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenTestResults(p)}
                className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition shadow-2xs cursor-pointer"
                title="Enter / Edit Test Results"
              >
                <FlaskConical className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenUploadPdf(p)}
                className="p-2 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition shadow-2xs cursor-pointer"
                title="Upload PDF Report"
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
            </div>
          ),
        },
      ]
    : [
        // Standard view for Admin and Hepatologist
        {
          key: 'full_name',
          header: 'Patient Name',
          sortable: true,
          render: (p) => (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                {p.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-900">{p.full_name}</p>
                <p className="text-xs text-slate-400 font-mono">ID: {p.portal_id}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'age_gender',
          header: 'Demographics',
          sortable: true,
          render: (p) => (
            <span className="text-xs text-slate-600 font-medium">
              {p.age} yrs · {p.gender}
            </span>
          ),
        },
        {
          key: 'risk',
          header: 'Cirrhosis Risk',
          sortable: true,
          render: (p) => (
            <div className="flex items-center gap-2.5">
              <Badge risk={p.latest_risk_label} size="sm" />
              <span className="text-xs font-bold text-slate-700">{p.latest_risk_percent}%</span>
            </div>
          ),
        },
        {
          key: 'treatment_status',
          header: 'Clinical Status',
          sortable: true,
          render: (p) => (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
              {p.treatment_status}
            </span>
          ),
        },
        {
          key: 'biomarkers',
          header: 'Key Markers',
          render: (p) => (
            <div className="text-[11px] text-slate-500 space-x-2">
              <span>
                Bili: <b className="text-slate-800">{p.bilirubin != null ? p.bilirubin : 'Not available'}</b>
              </span>
              <span>
                Alb: <b className="text-slate-800">{p.albumin != null ? p.albumin : 'Not available'}</b>
              </span>
              <span>
                PLT: <b className="text-slate-800">{p.platelets != null ? p.platelets : 'Not available'}</b>
              </span>
            </div>
          ),
        },
        {
          key: 'actions',
          header: 'Actions',
          className: 'text-right',
          headerClassName: 'text-right',
          render: (p) => (
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleInvite(p)}
                    disabled={invitingPatientId === p.id}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Send or resend patient portal activation email"
                  >
                    <Mail className="w-3 h-3" />
                    {invitingPatientId === p.id ? 'Sending...' : 'Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPin(p)}
                    disabled={resettingPatientId === p.id}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Generate new secret PIN for patient login (Admin only)"
                  >
                    <KeyRound className="w-3 h-3" />
                    {resettingPatientId === p.id ? 'Resetting...' : 'Reset PIN'}
                  </button>
                </>
              )}
              {isHepatologist && (
                <Link
                  to={`/doctor/reviews?patient_id=${p.id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-100 text-purple-800 hover:bg-purple-200 transition"
                >
                  Review
                </Link>
              )}
            </div>
          ),
        },
      ];

  const hasActiveFilters = searchQuery || selectedRisk || selectedStatus || startDate || endDate;

  if (isLabTech) {
    return <LabTechDashboardPage />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {isLabTech ? (isHindi ? 'रोगी नमूने एवं प्रयोगशाला कार्य' : 'Patient Samples') : 'Patient Directory'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {isLabTech
              ? isHindi
                ? 'रोगी पंजीकरण करें, प्रयोगशाला परीक्षण परिणाम दर्ज करें, पीडीएफ रिपोर्ट अपलोड करें और परीक्षण स्थिति प्रबंधित करें।'
                : 'Register patients, enter laboratory test results, upload PDF diagnostic reports, and manage patient status.'
              : 'Browse clinical profiles, risk probability trends, and laboratory histories.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadPatients} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            {isHindi ? 'ताज़ा करें' : 'Refresh'}
          </Button>

          {!isLabTech && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExportingCsv || isExportingPdf}
                isLoading={isExportingCsv}
                leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingCsv || isExportingPdf}
                isLoading={isExportingPdf}
                leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}
              >
                Export PDF
              </Button>
            </>
          )}

          {canRegister && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRegisterOpen(true)}
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-xs font-bold"
            >
              + {isHindi ? 'रोगी पंजीकृत करें' : 'Register Patient'}
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
                placeholder={isHindi ? 'नाम, रोगी ID, या फोन से खोजें...' : 'Search by patient name, Patient ID, or phone...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </div>

            {/* Simple Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-48 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition text-slate-700 font-semibold"
            >
              <option value="">{isHindi ? 'सभी स्थितियाँ (All Statuses)' : 'All Statuses'}</option>
              <option value="Registered">{isHindi ? 'पंजीकृत (Registered)' : 'Registered'}</option>
              <option value="Test In Progress">{isHindi ? 'परीक्षण प्रक्रियाधीन' : 'Test In Progress'}</option>
              <option value="Report Uploaded">{isHindi ? 'रिपोर्ट अपलोड' : 'Report Uploaded'}</option>
              <option value="Completed">{isHindi ? 'पूर्ण (Completed)' : 'Completed'}</option>
            </select>

            {!isLabTech && (
              <select
                value={selectedRisk}
                onChange={(e) => {
                  setSelectedRisk(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-40 py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition text-slate-700"
              >
                <option value="">All Risk Tiers</option>
                <option value="High Risk">High Risk</option>
                <option value="Medium Risk">Medium Risk</option>
                <option value="Low Risk">Low Risk</option>
                <option value="Pending">Pending</option>
              </select>
            )}

            <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold">
              {isHindi ? 'खोजें' : 'Search'}
            </Button>
          </form>

          {/* Quick Clear & Counts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
            <div className="text-slate-500 font-medium">
              Showing <b className="text-slate-900">{patients.length}</b> of <b className="text-slate-900">{total}</b> patient records
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition cursor-pointer"
              >
                <X className="w-3 h-3 text-slate-500" /> {isHindi ? 'फ़िल्टर हटाएं' : 'Clear Filters'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Patients Data Table */}
      <DataTable
        columns={columns}
        data={patients}
        isLoading={isLoading}
        sortColumn={sortColumn === 'age' ? 'age_gender' : sortColumn === 'latest_risk_label' ? 'risk' : sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage={
          isLabTech
            ? isHindi
              ? 'कोई रोगी नमूने नहीं मिले।'
              : 'No patient samples match your search criteria.'
            : 'No patients match your search criteria.'
        }
        pagination={{
          currentPage: page,
          totalPages: Math.ceil(total / 15) || 1,
          totalItems: total,
          itemsPerPage: 15,
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* =======================================================================
          TASK 1: REGISTER PATIENT MODAL
      ======================================================================= */}
      <RegisterPatientModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handlePatientRegistered}
      />

      {/* =======================================================================
          TASK 2: ENTER TEST RESULTS MODAL
      ======================================================================= */}
      {testResultsPatient && (
        <Modal
          isOpen={Boolean(testResultsPatient)}
          onClose={() => {
            if (!isSavingResults) setTestResultsPatient(null);
          }}
          title={
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">
                {isHindi ? 'प्रयोगशाला परीक्षण परिणाम दर्ज करें' : 'Enter Laboratory Test Results'}
              </h3>
            </div>
          }
        >
          <form onSubmit={handleSaveTestResults} className="p-6 space-y-4">
            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/80 text-xs flex items-center justify-between">
              <div>
                <span className="text-teal-800 font-semibold">{isHindi ? 'रोगी:' : 'Patient:'}</span>{' '}
                <strong className="text-slate-900">{testResultsPatient.full_name}</strong>
              </div>
              <div>
                <span className="text-teal-800 font-semibold">ID:</span>{' '}
                <strong className="font-mono text-blue-700">{testResultsPatient.portal_id}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              {isHindi
                ? 'रोगी के वास्तविक यकृत परीक्षण परिणाम दर्ज करें। मान डेटाबेस में तुरंत सहेजे जाएंगे।'
                : 'Enter actual laboratory liver test results. Measurements will be saved directly against this Patient ID.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Total Bilirubin */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'कुल बिलीरुबिन (Total Bilirubin)' : 'Total Bilirubin'} <span className="text-slate-400 font-normal">(mg/dL)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={testResultsForm.bilirubin}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, bilirubin: e.target.value })}
                  placeholder="e.g. 1.2 (Normal: 0.2 - 1.2)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Direct Bilirubin */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'प्रत्यक्ष बिलीरुबिन (Direct Bilirubin)' : 'Direct Bilirubin'} <span className="text-slate-400 font-normal">(mg/dL)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={testResultsForm.direct_bilirubin}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, direct_bilirubin: e.target.value })}
                  placeholder="e.g. 0.3 (Normal: 0.0 - 0.3)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* SGOT (AST) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  SGOT / AST <span className="text-slate-400 font-normal">(U/L)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={testResultsForm.sgot}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, sgot: e.target.value })}
                  placeholder="e.g. 35 (Normal: 8 - 48)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* SGPT (ALT) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  SGPT / ALT <span className="text-slate-400 font-normal">(U/L)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={testResultsForm.sgpt}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, sgpt: e.target.value })}
                  placeholder="e.g. 32 (Normal: 7 - 56)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Albumin */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'एल्ब्यूमिन (Albumin)' : 'Albumin'} <span className="text-slate-400 font-normal">(g/dL)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={testResultsForm.albumin}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, albumin: e.target.value })}
                  placeholder="e.g. 3.8 (Normal: 3.5 - 5.0)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Platelets */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'प्लेटलेट्स (Platelets)' : 'Platelet Count'} <span className="text-slate-400 font-normal">(x10³/µL)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={testResultsForm.platelets}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, platelets: e.target.value })}
                  placeholder="e.g. 220 (Normal: 150 - 450)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Prothrombin Time */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'प्रोथ्रोम्बिन समय (PT/INR)' : 'Prothrombin Time'} <span className="text-slate-400 font-normal">(sec)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={testResultsForm.prothrombin}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, prothrombin: e.target.value })}
                  placeholder="e.g. 11.5 (Normal: 11.0 - 13.5)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Alkaline Phosphatase */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isHindi ? 'एल्कलाइन फॉस्फेट (Alk Phos)' : 'Alkaline Phosphatase'} <span className="text-slate-400 font-normal">(U/L)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={testResultsForm.alk_phos}
                  onChange={(e) => setTestResultsForm({ ...testResultsForm, alk_phos: e.target.value })}
                  placeholder="e.g. 85 (Normal: 44 - 147)"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestResultsPatient(null)}
                disabled={isSavingResults}
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingResults}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
              >
                {isSavingResults ? 'Saving...' : isHindi ? 'परिणाम सहेजें' : 'Save Results'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =======================================================================
          TASK 3: UPLOAD PDF REPORT MODAL
      ======================================================================= */}
      {uploadPdfPatient && (
        <Modal
          isOpen={Boolean(uploadPdfPatient)}
          onClose={() => {
            if (!isUploadingPdf) setUploadPdfPatient(null);
          }}
          title={
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">
                {isHindi ? 'डायग्नोस्टिक पीडीएफ रिपोर्ट अपलोड करें' : 'Upload Diagnostic PDF Report'}
              </h3>
            </div>
          }
        >
          <form onSubmit={handleSubmitUploadPdf} className="p-6 space-y-4">
            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/80 text-xs flex items-center justify-between">
              <div>
                <span className="text-teal-800 font-semibold">{isHindi ? 'रोगी:' : 'Target Patient:'}</span>{' '}
                <strong className="text-slate-900">{uploadPdfPatient.full_name}</strong>
              </div>
              <div>
                <span className="text-teal-800 font-semibold">ID:</span>{' '}
                <strong className="font-mono text-blue-700">{uploadPdfPatient.portal_id}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'परीक्षण श्रेणी' : 'Test / Report Category'}
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'पीडीएफ फ़ाइल चुनें (अधिकतम 8MB)' : 'Select Diagnostic PDF File (Max 8MB)'}
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadFile(file);
                }}
                required
                className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
              {uploadFile && (
                <p className="text-[11px] text-teal-700 font-medium mt-1">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markCompleteOnUpload}
                  onChange={(e) => setMarkCompleteOnUpload(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span>{isHindi ? 'परीक्षण को पूर्ण (Completed) के रूप में चिह्नित करें' : 'Also mark patient status as Completed'}</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUploadPdfPatient(null)}
                disabled={isUploadingPdf}
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isUploadingPdf}
                disabled={!uploadFile}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
                leftIcon={<UploadCloud className="w-4 h-4" />}
              >
                {isUploadingPdf ? 'Uploading...' : isHindi ? 'अपलोड करें' : 'Upload PDF'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff-Assisted PIN Reset Modal (Admin-Only) */}
      {isAdmin && resetResult && (
        <Modal
          isOpen={Boolean(resetResult)}
          onClose={() => setResetResult(null)}
          title={
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Patient Access PIN Reset (Admin Authorization)</h3>
            </div>
          }
        >
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              A new Secret PIN has been securely provisioned for <strong>{resetResult.patient.full_name}</strong>. Provide these credentials to the patient for portal access:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">Patient Name:</span>
                <span className="text-xs font-bold text-slate-900">{resetResult.patient.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">Patient ID:</span>
                <span className="text-sm font-mono font-extrabold text-blue-700">{resetResult.portalId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">New Secret PIN:</span>
                <span className="text-base font-mono font-extrabold text-purple-700 tracking-widest">{resetResult.newPin}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `CirrhoCare AI - Access PIN Reset\nPatient: ${resetResult.patient.full_name}\nPatient ID: ${resetResult.portalId}\nNew PIN: ${resetResult.newPin}`
                  );
                  success('Reset credentials copied to clipboard');
                }}
                leftIcon={<Copy className="w-3.5 h-3.5" />}
              >
                Copy Details
              </Button>
              <Button variant="primary" size="sm" onClick={() => setResetResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PatientsPage;
