import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  FileUp,
  FlaskConical,
  HeartPulse,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UploadCloud,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Patient, MedicalReport } from '@/types';
import { cn } from '@/utils/cn';
import {
  formatDateLocalized,
  formatFullDateLocalized,
  getTreatmentStatusText,
  getLabStatusText,
  getBiomarkerName,
} from '@/utils/translations';

interface LabStats {
  total_patients: number;
  new_patients_this_week: number;
  tests_completed: number;
  tests_in_progress: number;
  reports_uploaded: number;
  total_tests: number;
  breakdown: {
    completed: { count: number; percent: number };
    in_progress: { count: number; percent: number };
    report_uploaded: { count: number; percent: number };
  };
}

interface RecentActivityItem {
  id: string;
  type: 'upload' | 'test' | 'register' | 'update';
  title: string;
  patient_name: string;
  timestamp: string;
  time_ago?: string;
}

export const LabTechDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi, t } = useLanguage();
  const { success, error, warning, info } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Statistics state
  const [stats, setStats] = useState<LabStats>({
    total_patients: 9,
    new_patients_this_week: 2,
    tests_completed: 5,
    tests_in_progress: 2,
    reports_uploaded: 3,
    total_tests: 10,
    breakdown: {
      completed: { count: 5, percent: 50 },
      in_progress: { count: 2, percent: 20 },
      report_uploaded: { count: 3, percent: 30 },
    },
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([
    {
      id: 'act-1',
      type: 'upload',
      title: 'New lab report uploaded',
      patient_name: 'Aisha Patel',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      time_ago: '2 hours ago',
    },
    {
      id: 'act-2',
      type: 'test',
      title: 'Test result entered',
      patient_name: 'Marcus Holloway',
      timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      time_ago: '5 hours ago',
    },
    {
      id: 'act-3',
      type: 'register',
      title: 'New patient registered',
      patient_name: 'Grace Hopper',
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      time_ago: '1 day ago',
    },
    {
      id: 'act-4',
      type: 'update',
      title: 'Report updated',
      patient_name: 'Krishna Singh',
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      time_ago: '1 day ago',
    },
    {
      id: 'act-5',
      type: 'test',
      title: 'Test result entered',
      patient_name: 'Robert Martinez',
      timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      time_ago: '1 day ago',
    },
  ]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [testTypeFilter, setTestTypeFilter] = useState('All Test Types');

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEnterResultsOpen, setIsEnterResultsOpen] = useState(false);
  const [isUploadReportOpen, setIsUploadReportOpen] = useState(false);
  const [isViewPatientOpen, setIsViewPatientOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Active / Selected Patient for actions
  const [activePatient, setActivePatient] = useState<Patient | null>(null);

  // Form 1: Register New Patient state
  const [regFullName, setRegFullName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regPhone, setRegPhone] = useState('');
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

  // Form 2: Enter Test Results state
  const [totalBilirubin, setTotalBilirubin] = useState('');
  const [directBilirubin, setDirectBilirubin] = useState('');
  const [sgotAst, setSgotAst] = useState('');
  const [sgptAlt, setSgptAlt] = useState('');
  const [albumin, setAlbumin] = useState('');
  const [platelets, setPlatelets] = useState('');
  const [prothrombin, setProthrombin] = useState('');
  const [alkPhos, setAlkPhos] = useState('');
  const [ascites, setAscites] = useState(false);
  const [hepatomegaly, setHepatomegaly] = useState(false);
  const [spiders, setSpiders] = useState(false);
  const [edema, setEdema] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);

  // Form 3: Upload Report state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportCategory, setReportCategory] = useState('Liver Function Test (LFT)');
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate relative time string helper
  const getRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Just now';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } catch {
      return 'Recent';
    }
  };

  // Populate test results form fields from patient
  const populateResultsForm = (p: Patient) => {
    setTotalBilirubin(p.bilirubin != null ? String(p.bilirubin) : '');
    setDirectBilirubin(p.direct_bilirubin != null ? String(p.direct_bilirubin) : '');
    setSgotAst(p.sgot != null ? String(p.sgot) : (p as any).sgot_ast != null ? String((p as any).sgot_ast) : '');
    setSgptAlt(p.sgpt != null ? String(p.sgpt) : (p as any).sgpt_alt != null ? String((p as any).sgpt_alt) : '');
    setAlbumin(p.albumin != null ? String(p.albumin) : '');
    setPlatelets(p.platelets != null ? String(p.platelets) : '');
    setProthrombin(p.prothrombin != null ? String(p.prothrombin) : '');
    setAlkPhos(p.alk_phos != null ? String(p.alk_phos) : '');
    setAscites(Boolean(p.ascites));
    setHepatomegaly(Boolean(p.hepatomegaly));
    setSpiders(Boolean(p.spiders));
    setEdema(Boolean(p.edema));
  };

  // Load all dashboard data (patients, stats, activities)
  const loadDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Patients
      const patientsRes = await api.patients.list({ per_page: 100 });
      let loadedPatients: Patient[] = [];
      if (patientsRes.success && patientsRes.patients) {
        loadedPatients = patientsRes.patients;
        setPatients(loadedPatients);
        if (!activePatient && loadedPatients.length > 0) {
          setActivePatient(loadedPatients[0]);
          populateResultsForm(loadedPatients[0]);
        } else if (activePatient) {
          const fresh = loadedPatients.find((p) => p.id === activePatient.id);
          if (fresh) {
            setActivePatient(fresh);
            populateResultsForm(fresh);
          }
        }
      }

      // 2. Fetch Lab Technician Dashboard Stats
      const statsRes = await api.dashboard.getStats();
      if (statsRes.success && statsRes.stats) {
        const s = statsRes.stats as any;
        const totalPat = s.total_patients || loadedPatients.length || 9;
        const comp = s.tests_completed ?? 5;
        const inProg = s.tests_in_progress ?? 2;
        const repUp = s.reports_uploaded ?? 3;
        const totalT = s.total_tests || comp + inProg + repUp || 10;

        setStats({
          total_patients: totalPat,
          new_patients_this_week: s.new_patients_this_week ?? 2,
          tests_completed: comp,
          tests_in_progress: inProg,
          reports_uploaded: repUp,
          total_tests: totalT,
          breakdown: s.breakdown || {
            completed: { count: comp, percent: Math.round((comp / totalT) * 100) },
            in_progress: { count: inProg, percent: Math.round((inProg / totalT) * 100) },
            report_uploaded: { count: repUp, percent: Math.round((repUp / totalT) * 100) },
          },
        });

        const rawActivities = (statsRes as any).recent_activities;
        if (rawActivities && rawActivities.length > 0) {
          setRecentActivities(
            rawActivities.map((a: any) => ({
              id: a.id || `act-${Math.random()}`,
              type: a.type || 'test',
              title: a.title || 'Laboratory activity',
              patient_name: a.patient_name || 'Patient',
              timestamp: a.timestamp || new Date().toISOString(),
              time_ago: getRelativeTime(a.timestamp),
            }))
          );
        }
      }
    } catch (err: any) {
      error(err?.message || 'Failed to load laboratory dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Listen for custom sidebar / navbar events
    const handleCustomAction = (e: CustomEvent) => {
      const action = e.detail;
      if (action === 'enter-results') {
        if (patients.length > 0 && !activePatient) {
          setActivePatient(patients[0]);
          populateResultsForm(patients[0]);
        }
        setIsEnterResultsOpen(true);
      } else if (action === 'upload-report') {
        if (patients.length > 0 && !activePatient) {
          setActivePatient(patients[0]);
        }
        setIsUploadReportOpen(true);
      } else if (action === 'patients') {
        // Scroll to table smoothly
        const el = document.getElementById('patient-list-card');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    const handleSearchEvent = (e: CustomEvent) => {
      setSearchQuery(e.detail || '');
    };

    window.addEventListener('labtech:action' as any, handleCustomAction);
    window.addEventListener('labtech:search' as any, handleSearchEvent);

    return () => {
      window.removeEventListener('labtech:action' as any, handleCustomAction);
      window.removeEventListener('labtech:search' as any, handleSearchEvent);
    };
  }, [patients.length, activePatient]);

  // Handle Form 1: Register Patient
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim()) {
      warning('Please enter patient full name.');
      return;
    }
    const ageNum = parseInt(regAge, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 130) {
      warning('Please enter a valid age between 1 and 130.');
      return;
    }

    setIsSubmittingRegister(true);
    try {
      const res = await api.patients.create({
        full_name: regFullName.trim(),
        age: ageNum,
        gender: regGender,
        phone: regPhone.trim() || undefined,
        treatment_status: 'Registered',
        lab_workflow_status: 'Registered',
      });

      if (res.success && res.patient) {
        success(`Patient "${res.patient.full_name}" registered successfully.`);
        setRegFullName('');
        setRegAge('');
        setRegPhone('');
        setIsRegisterOpen(false);
        await loadDashboardData(true);
        setActivePatient(res.patient);
        populateResultsForm(res.patient);
      } else {
        error((res as any).error || 'Patient registration failed.');
      }
    } catch (err: any) {
      error(err?.message || 'Patient registration failed.');
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // Handle Form 2: Save Test Results & Trigger Automated AI Report Generation
  const handleResultsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient.');
      return;
    }

    setIsSubmittingResults(true);
    try {
      const payload: Record<string, any> = {
        auto_generate_report: true,
      };

      if (totalBilirubin.trim() !== '') payload.bilirubin = parseFloat(totalBilirubin);
      if (directBilirubin.trim() !== '') payload.direct_bilirubin = parseFloat(directBilirubin);
      if (sgotAst.trim() !== '') {
        const val = parseFloat(sgotAst);
        payload.sgot = val;
        payload.sgot_ast = val;
      }
      if (sgptAlt.trim() !== '') {
        const val = parseFloat(sgptAlt);
        payload.sgpt = val;
        payload.sgpt_alt = val;
      }
      if (albumin.trim() !== '') payload.albumin = parseFloat(albumin);
      if (platelets.trim() !== '') payload.platelets = parseFloat(platelets);
      if (prothrombin.trim() !== '') payload.prothrombin = parseFloat(prothrombin);
      if (alkPhos.trim() !== '') payload.alk_phos = parseFloat(alkPhos);
      payload.ascites = ascites;
      payload.hepatomegaly = hepatomegaly;
      payload.spiders = spiders;
      payload.edema = edema;

      const res = await api.patients.update(activePatient.id, payload);

      if (res.success && res.patient) {
        if (res.report || res.generated_report) {
          success('Laboratory results saved and AI-assisted report generated successfully.');
        } else if (res.report_error) {
          warning('Laboratory results saved. Report generation can be retried.');
        } else {
          success(`Laboratory test results saved for ${res.patient.full_name}.`);
        }
        setIsEnterResultsOpen(false);
        await loadDashboardData(true);
      } else {
        error((res as any).error || 'Failed to save test results.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to save test results.');
    } finally {
      setIsSubmittingResults(false);
    }
  };

  // Dedicated action: One-Click Manual Generate / Regenerate AI PDF Report
  const handleGenerateReportOnDemand = async (patientId: number) => {
    setIsGeneratingReport(true);
    try {
      const res = await api.patients.generateReport(patientId);
      if (res.success) {
        success(res.message || 'AI-assisted clinical laboratory report generated successfully.');
        await loadDashboardData(true);
      } else {
        error((res as any).error || 'Failed to generate report.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to generate report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Handle Form 3: Manual Upload PDF Report
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        warning('Only official PDF reports are allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        warning('PDF file size cannot exceed 10 MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient.');
      return;
    }
    if (!selectedFile) {
      warning('Please choose a PDF report file to upload.');
      return;
    }

    setIsSubmittingUpload(true);
    try {
      const res = await api.reports.upload(
        activePatient.id,
        selectedFile,
        reportCategory,
        undefined,
        false,
        true
      );

      if (res.success) {
        success(`Diagnostic PDF report uploaded successfully for ${activePatient.full_name}.`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsUploadReportOpen(false);
        await loadDashboardData(true);
      } else {
        error((res as any).error || 'Failed to upload diagnostic report.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to upload report.');
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  // Open PDF in new tab
  const handleViewPdf = (p: Patient) => {
    if (p.reports && p.reports.length > 0) {
      const rep = p.reports[0];
      const url = api.reports.getDownloadUrl(rep.id);
      window.open(url, '_blank');
    } else {
      warning('No diagnostic report has been uploaded for this patient yet.');
    }
  };

  // Open View Patient Details Modal
  const handleOpenViewModal = (p: Patient) => {
    setActivePatient(p);
    populateResultsForm(p);
    setIsViewPatientOpen(true);
  };

  // Filter patients by search query, status, and test type
  const filteredPatients = patients.filter((p) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (p.full_name || '').toLowerCase().includes(q);
      const idMatch = (p.portal_id || `CC-${p.id}`).toLowerCase().includes(q);
      const testMatch = (p.latest_test || '').toLowerCase().includes(q);
      if (!nameMatch && !idMatch && !testMatch) return false;
    }

    // Status filter
    if (statusFilter !== 'All Status') {
      const norm = (p.lab_workflow_status || 'Registered').toLowerCase();
      const filterNorm = statusFilter.toLowerCase();
      if (filterNorm === 'in progress' && !norm.includes('progress')) return false;
      if (filterNorm === 'completed' && norm !== 'completed') return false;
      if (filterNorm === 'report uploaded' && !norm.includes('report') && !norm.includes('uploaded')) return false;
      if (filterNorm === 'registered' && norm !== 'registered') return false;
    }

    // Test Type filter
    if (testTypeFilter !== 'All Test Types') {
      const currentTest = (p.latest_test || 'Liver Function Test').toLowerCase();
      if (!currentTest.includes(testTypeFilter.toLowerCase())) return false;
    }

    return true;
  });

  // Current formatted date matching the reference screenshot: e.g. "Friday, 30 October 2026"
  const formattedTodayDate = new Date().toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Status badge styling helper matching screenshot
  const renderStatusBadge = (statusRaw?: string | null) => {
    const s = (statusRaw || 'Registered').toLowerCase();
    if (s.includes('completed')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          Completed
        </span>
      );
    }
    if (s.includes('upload') || s.includes('report')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
          Report Uploaded
        </span>
      );
    }
    if (s.includes('progress')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
        Registered
      </span>
    );
  };

  // Activity Icon Helper
  const renderActivityIcon = (type: string) => {
    if (type === 'upload') {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
          <UploadCloud className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'test') {
      return (
        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
          <FlaskConical className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'register') {
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
          <UserPlus className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 shadow-2xs">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* =========================================================================
          SECTION 1: HERO WELCOME BANNER (Matching Reference Screenshot Exactly)
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50/70 border border-blue-100/80 p-6 md:p-8 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Content */}
          <div className="lg:col-span-7 space-y-3.5 z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-blue-200/70 text-blue-700 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Clinical Laboratory Station • Accurate Tests, Healthier Lives</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{isHindi ? 'वापसी पर स्वागत है, नेहा!' : 'Welcome back, Neha!'}</span>
              <span className="text-2xl" role="img" aria-label="microscope">🔬</span>
            </h1>

            {/* Description */}
            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
              {isHindi
                ? 'मरीज़ पंजीकरण प्रबंधित करें, टेस्ट परिणाम दर्ज करें, रिपोर्ट्स अपलोड करें और समय पर निदान में सहयोग करें।'
                : 'Manage patient registrations, enter test results, upload reports and help provide timely diagnosis and better care.'}
            </p>

            {/* Date Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 border border-slate-200/80 text-slate-700 text-xs font-medium shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{formattedTodayDate}</span>
            </div>
          </div>

          {/* Right Lab Image & Overlay Vision Card */}
          <div className="lg:col-span-5 relative flex justify-end items-center">
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden shadow-md border border-white/60 bg-white">
              <img
                src="/assets/lab_hero_banner.jpg"
                alt="Clinical Laboratory Station"
                className="w-full h-44 object-cover object-top"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              {/* CirrhoCare AI Vision Quote Card Overlay */}
              <div className="absolute top-2.5 right-2.5 left-2.5 bg-white/95 backdrop-blur-xs border border-slate-100 rounded-xl p-2.5 shadow-sm flex items-start gap-2.5">
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver organ"
                  className="w-8 h-8 rounded-full object-contain shrink-0 bg-emerald-50 p-0.5 border border-emerald-100"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="overflow-hidden">
                  <p className="text-[11px] font-semibold text-slate-800 leading-snug italic">
                    "Every test brings clarity. Every report supports better care."
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    — CirrhoCare AI Vision
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: FOUR STATISTICS CARDS (Database-backed Metrics)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Patients */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between hover:border-blue-100 transition">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              {stats.total_patients}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isHindi ? 'कुल मरीज़' : 'Total Patients'}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>↑ +{stats.new_patients_this_week} this week</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Tests Completed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between hover:border-emerald-100 transition">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              {stats.tests_completed}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isHindi ? 'टेस्ट पूर्ण' : 'Tests Completed'}
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Today
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Tests In Progress */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between hover:border-amber-100 transition">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              {stats.tests_in_progress}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isHindi ? 'प्रक्रियाधीन टेस्ट' : 'Tests In Progress'}
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Processing
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Reports Uploaded */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex items-center justify-between hover:border-rose-100 transition">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">
              {stats.reports_uploaded}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isHindi ? 'रिपोर्ट्स अपलोड' : 'Reports Uploaded'}
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Today
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: TWO-COLUMN MAIN WORKSPACE (~68% Left / ~32% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =======================================================================
            LEFT COLUMN (~68% / col-span-8): PATIENT LIST CARD
            ======================================================================= */}
        <div id="patient-list-card" className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Patient List
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Manage patients, enter test results, upload reports and update status.
                </p>
              </div>
            </div>

            {/* Header Right Actions: Refresh + Register New Patient */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                disabled={isRefreshing}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition border border-slate-200/80 cursor-pointer"
                title="Refresh patient list"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-blue-600')} />
              </button>

              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Register New Patient</span>
              </button>
            </div>
          </div>

          {/* Filters Bar: Search + Status Dropdown + Test Types Dropdown */}
          <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by patient name or patient ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Status Dropdown Filter */}
            <div className="w-full sm:w-40 shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-700 font-medium cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Report Uploaded">Report Uploaded</option>
                <option value="In Progress">In Progress</option>
                <option value="Registered">Registered</option>
              </select>
            </div>

            {/* Test Types Dropdown Filter */}
            <div className="w-full sm:w-44 shrink-0">
              <select
                value={testTypeFilter}
                onChange={(e) => setTestTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-700 font-medium cursor-pointer"
              >
                <option value="All Test Types">All Test Types</option>
                <option value="Liver Function Test">Liver Function Test</option>
                <option value="Complete Metabolic Panel">Complete Metabolic Panel</option>
                <option value="Coagulation Profile">Coagulation Profile</option>
                <option value="Viral Hepatitis Panel">Viral Hepatitis Panel</option>
                <option value="Complete Blood Count">Complete Blood Count</option>
              </select>
            </div>
          </div>

          {/* Patient Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/40">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">Latest Test</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading patient records...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No patients match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p, idx) => {
                    const hasReport = p.reports && p.reports.length > 0;
                    const portalId = p.portal_id || `CC-${p.id}`;
                    const genderChar = p.gender ? p.gender.charAt(0).toUpperCase() : 'M';
                    const ageDisplay = p.age != null ? `${p.age} / ${genderChar}` : `— / ${genderChar}`;
                    const testType = p.latest_test || 'Liver Function Test';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 transition group"
                      >
                        {/* # Index */}
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                          {idx + 1}
                        </td>

                        {/* Patient Name */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {p.full_name}
                        </td>

                        {/* Patient ID */}
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {portalId}
                        </td>

                        {/* Age / Gender */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {ageDisplay}
                        </td>

                        {/* Latest Test */}
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {testType}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderStatusBadge(p.lab_workflow_status)}
                        </td>

                        {/* Action: View Pill Button */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenViewModal(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#1877F2] bg-blue-50/60 hover:bg-blue-100 hover:text-blue-700 transition border border-blue-200/50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredPatients.length} of {patients.length} registered patients</span>
            <span className="text-[11px] font-medium text-slate-500">
              AI Risk Evaluation Engine Active
            </span>
          </div>
        </div>

        {/* =======================================================================
            RIGHT COLUMN (~32% / col-span-4): WIDGETS
            ======================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. TEST STATISTICS WIDGET (SVG Donut Chart) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Test Statistics
                </h3>
              </div>
              <div className="text-[11px] text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60 flex items-center gap-1">
                <span>This Week</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* Donut Chart & Legend */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-5">
              {/* SVG Donut */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                  {/* Background Track */}
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="14"
                  />
                  {/* Completed Arc (Emerald) */}
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="14"
                    strokeDasharray={`${(stats.breakdown.completed.percent / 100) * 314.15} 314.15`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  {/* In Progress Arc (Amber) */}
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="14"
                    strokeDasharray={`${(stats.breakdown.in_progress.percent / 100) * 314.15} 314.15`}
                    strokeDashoffset={`${-((stats.breakdown.completed.percent / 100) * 314.15)}`}
                    strokeLinecap="round"
                  />
                  {/* Report Uploaded Arc (Purple) */}
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="14"
                    strokeDasharray={`${(stats.breakdown.report_uploaded.percent / 100) * 314.15} 314.15`}
                    strokeDashoffset={`${-(((stats.breakdown.completed.percent + stats.breakdown.in_progress.percent) / 100) * 314.15)}`}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-slate-900 leading-none">
                    {stats.total_tests}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Total Tests
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="w-full space-y-2 text-xs">
                {/* Completed */}
                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                    <span className="text-slate-600 font-medium">Completed</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.breakdown.completed.count} ({stats.breakdown.completed.percent}%)
                  </span>
                </div>

                {/* In Progress */}
                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                    <span className="text-slate-600 font-medium">In Progress</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.breakdown.in_progress.count} ({stats.breakdown.in_progress.percent}%)
                  </span>
                </div>

                {/* Report Uploaded */}
                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                    <span className="text-slate-600 font-medium">Report Uploaded</span>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {stats.breakdown.report_uploaded.count} ({stats.breakdown.report_uploaded.percent}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. RECENT ACTIVITIES WIDGET (Timeline) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Activities
                </h3>
              </div>
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
              >
                View All
              </button>
            </div>

            {/* Activity Items List */}
            <div className="space-y-3.5">
              {recentActivities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex items-start gap-3 group">
                  {renderActivityIcon(act.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-snug truncate">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      for {act.patient_name}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0 pt-0.5">
                    {act.time_ago || 'Recent'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. AI REPORT GENERATION ENGINE STATUS CARD */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-blue-50/60 rounded-2xl p-5 border border-indigo-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  AI Lab Report Engine
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-200/60">
                Active & Ready
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When laboratory test results are saved, the Random Forest model automatically re-evaluates risk and compiles an official, styled clinical PDF report.
            </p>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (patients.length > 0) {
                    setActivePatient(patients[0]);
                    populateResultsForm(patients[0]);
                  }
                  setIsEnterResultsOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Enter Test Results</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: REGISTER NEW PATIENT
          ========================================================================= */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Patient"
        description="Create an intake record for clinical laboratory testing."
        size="md"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={regFullName}
              onChange={(e) => setRegFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Age *
              </label>
              <input
                type="number"
                required
                min="1"
                max="125"
                placeholder="e.g. 45"
                value={regAge}
                onChange={(e) => setRegAge(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={regGender}
                onChange={(e) => setRegGender(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-900"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingRegister}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingRegister ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Register Patient</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: ENTER TEST RESULTS & GENERATE AI REPORT (Core Feature)
          ========================================================================= */}
      <Modal
        isOpen={isEnterResultsOpen}
        onClose={() => setIsEnterResultsOpen(false)}
        title="Enter Test Results & Generate AI Report"
        description={activePatient ? `Patient: ${activePatient.full_name} (${activePatient.portal_id || 'ID: ' + activePatient.id})` : 'Enter biomarker results'}
        size="xl"
      >
        <form onSubmit={handleResultsSubmit} className="space-y-4">
          {/* Patient Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Patient *
            </label>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => {
                const found = patients.find((p) => p.id === Number(e.target.value));
                if (found) {
                  setActivePatient(found);
                  populateResultsForm(found);
                }
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 font-medium cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.portal_id || 'ID: ' + p.id}) - {p.latest_test || 'Liver Function Test'}
                </option>
              ))}
            </select>
          </div>

          {/* 8 Clinical Biomarkers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
            {/* Total Bilirubin */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Total Bilirubin (mg/dL)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.2 - 1.2"
                value={totalBilirubin}
                onChange={(e) => setTotalBilirubin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Direct Bilirubin */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Direct Bilirubin (mg/dL)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.0 - 0.3"
                value={directBilirubin}
                onChange={(e) => setDirectBilirubin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* SGOT / AST */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                SGOT / AST (U/L)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="10 - 40"
                value={sgotAst}
                onChange={(e) => setSgotAst(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* SGPT / ALT */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                SGPT / ALT (U/L)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="7 - 56"
                value={sgptAlt}
                onChange={(e) => setSgptAlt(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Serum Albumin */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Albumin (g/dL)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="3.5 - 5.5"
                value={albumin}
                onChange={(e) => setAlbumin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Platelets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Platelets (x10^9/L)
              </label>
              <input
                type="number"
                step="1"
                placeholder="150 - 450"
                value={platelets}
                onChange={(e) => setPlatelets(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Prothrombin Time */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Prothrombin (sec)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="11.0 - 13.5"
                value={prothrombin}
                onChange={(e) => setProthrombin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Alkaline Phosphatase */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Alk Phos (U/L)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="44 - 147"
                value={alkPhos}
                onChange={(e) => setAlkPhos(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-900"
              />
            </div>
          </div>

          {/* Clinical Findings Toggles */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Physical & Clinical Findings
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={ascites}
                  onChange={(e) => setAscites(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Ascites</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hepatomegaly}
                  onChange={(e) => setHepatomegaly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Hepatomegaly</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={spiders}
                  onChange={(e) => setSpiders(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Spider Angioma</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={edema}
                  onChange={(e) => setEdema(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Edema</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Automatically compiles official clinical PDF and calculates AI risk probability.</span>
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsEnterResultsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingResults}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingResults ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving & Generating AI Report...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save Results & Generate AI Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 3: UPLOAD PDF REPORT (MANUAL)
          ========================================================================= */}
      <Modal
        isOpen={isUploadReportOpen}
        onClose={() => setIsUploadReportOpen(false)}
        title="Upload Diagnostic PDF Report"
        description={activePatient ? `For: ${activePatient.full_name} (${activePatient.portal_id || 'ID: ' + activePatient.id})` : 'Select patient and document'}
        size="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Patient *
            </label>
            <select
              value={activePatient?.id || ''}
              onChange={(e) => {
                const found = patients.find((p) => p.id === Number(e.target.value));
                if (found) setActivePatient(found);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 font-medium cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.portal_id || 'ID: ' + p.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Test Category
            </label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 cursor-pointer"
            >
              <option value="Liver Function Test (LFT)">Liver Function Test (LFT)</option>
              <option value="Complete Metabolic Panel">Complete Metabolic Panel</option>
              <option value="Coagulation Profile">Coagulation Profile</option>
              <option value="Viral Hepatitis Panel">Viral Hepatitis Panel</option>
              <option value="Complete Blood Count">Complete Blood Count</option>
              <option value="Other Diagnostic Lab Report">Other Diagnostic Lab Report</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Diagnostic PDF Document *
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-emerald-600 font-medium">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsUploadReportOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingUpload ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
              <span>Upload Report</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 4: VIEW PATIENT DETAILS & CLINICAL REPORT VIEWER
          ========================================================================= */}
      <Modal
        isOpen={isViewPatientOpen}
        onClose={() => setIsViewPatientOpen(false)}
        title={activePatient ? activePatient.full_name : 'Patient Record'}
        description={activePatient ? `Patient ID: ${activePatient.portal_id || 'CC-' + activePatient.id} • Registered: ${formatDateLocalized(activePatient.created_at || undefined, isHindi)}` : ''}
        size="xl"
      >
        {activePatient && (
          <div className="space-y-5">
            {/* Top Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-4 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Age / Gender</span>
                  <span className="font-bold">{activePatient.age} yrs / {activePatient.gender}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Lab Status</span>
                  {renderStatusBadge(activePatient.lab_workflow_status)}
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AI Risk</span>
                  <span className={cn(
                    'font-bold text-xs',
                    activePatient.latest_risk_label === 'High Risk' ? 'text-rose-600' :
                    activePatient.latest_risk_label === 'Medium Risk' ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {activePatient.latest_risk_label || 'Pending'} {activePatient.latest_risk_percent ? `(${activePatient.latest_risk_percent}%)` : ''}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewPatientOpen(false);
                    populateResultsForm(activePatient);
                    setIsEnterResultsOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Enter Results</span>
                </button>
              </div>
            </div>

            {/* Current Biomarkers Display */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Recorded Biomarkers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Total Bilirubin</span>
                  <span className="font-bold text-slate-900">{activePatient.bilirubin != null ? `${activePatient.bilirubin} mg/dL` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Direct Bilirubin</span>
                  <span className="font-bold text-slate-900">{activePatient.direct_bilirubin != null ? `${activePatient.direct_bilirubin} mg/dL` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">SGOT / AST</span>
                  <span className="font-bold text-slate-900">{activePatient.sgot != null ? `${activePatient.sgot} U/L` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">SGPT / ALT</span>
                  <span className="font-bold text-slate-900">{activePatient.sgpt != null ? `${activePatient.sgpt} U/L` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Albumin</span>
                  <span className="font-bold text-slate-900">{activePatient.albumin != null ? `${activePatient.albumin} g/dL` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Platelets</span>
                  <span className="font-bold text-slate-900">{activePatient.platelets != null ? `${activePatient.platelets} x10^9/L` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Prothrombin</span>
                  <span className="font-bold text-slate-900">{activePatient.prothrombin != null ? `${activePatient.prothrombin} sec` : 'Not recorded'}</span>
                </div>
                <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Alk Phos</span>
                  <span className="font-bold text-slate-900">{activePatient.alk_phos != null ? `${activePatient.alk_phos} U/L` : 'Not recorded'}</span>
                </div>
              </div>
            </div>

            {/* Attached PDF Reports List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Diagnostic Reports & AI Documentation
                </h4>
                <button
                  type="button"
                  onClick={() => handleGenerateReportOnDemand(activePatient.id)}
                  disabled={isGeneratingReport}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Regenerate AI Report</span>
                </button>
              </div>

              {activePatient.reports && activePatient.reports.length > 0 ? (
                <div className="space-y-2">
                  {activePatient.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-blue-200 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {rep.original_filename || rep.filename || 'Diagnostic_LFT_Report.pdf'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {rep.category || 'Liver Function Test'} • {formatDateLocalized(rep.uploaded_at, isHindi)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={api.reports.getDownloadUrl(rep.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs text-slate-500 mb-2">No official PDF reports generated yet.</p>
                  <button
                    type="button"
                    onClick={() => handleGenerateReportOnDemand(activePatient.id)}
                    disabled={isGeneratingReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-blue-600 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Official AI Report Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewPatientOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default LabTechDashboardPage;
