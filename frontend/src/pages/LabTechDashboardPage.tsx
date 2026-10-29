import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Patient } from '@/types';
import { cn } from '@/utils/cn';
import {
  formatDateLocalized,
  formatFullDateLocalized,
  getTreatmentStatusText,
  getLabStatusText,
  getBiomarkerName,
} from '@/utils/translations';

export const LabTechDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi, t } = useLanguage();
  const { success, error, warning } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected patient for Enter Test Results and Upload PDF forms
  const [activePatient, setActivePatient] = useState<Patient | null>(null);

  // Visibility of the 3 bottom form cards (all open by default on desktop to match screenshot)
  const [showRegisterCard, setShowRegisterCard] = useState(true);
  const [showResultsCard, setShowResultsCard] = useState(true);
  const [showUploadCard, setShowUploadCard] = useState(true);

  // Form 1: Register Patient state
  const [regFullName, setRegFullName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('');
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
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);

  // Form 3: Upload PDF Report state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View Patient Details Modal
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);

  // Refs for scrolling to form cards
  const registerCardRef = useRef<HTMLDivElement>(null);
  const resultsCardRef = useRef<HTMLDivElement>(null);
  const uploadCardRef = useRef<HTMLDivElement>(null);

  // Load all patients from backend
  const loadPatients = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await api.patients.list({ per_page: 100 });
      if (res.success && res.patients) {
        setPatients(res.patients);
        if (!activePatient && res.patients.length > 0) {
          setActivePatient(res.patients[0]);
          populateResultsForm(res.patients[0]);
        } else if (activePatient) {
          // Re-sync active patient with fresh data
          const updatedActive = res.patients.find((p) => p.id === activePatient.id);
          if (updatedActive) {
            setActivePatient(updatedActive);
            populateResultsForm(updatedActive);
          }
        }
      }
    } catch (err: any) {
      error(err?.message || 'Failed to load patient records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Pre-fill results form when active patient changes
  const populateResultsForm = (p: Patient) => {
    setTotalBilirubin(p.bilirubin != null ? String(p.bilirubin) : '');
    setDirectBilirubin(p.direct_bilirubin != null ? String(p.direct_bilirubin) : '');
    setSgotAst(p.sgot != null ? String(p.sgot) : (p as any).sgot_ast != null ? String((p as any).sgot_ast) : '');
    setSgptAlt(p.sgpt != null ? String(p.sgpt) : (p as any).sgpt_alt != null ? String((p as any).sgpt_alt) : '');
    setAlbumin(p.albumin != null ? String(p.albumin) : '');
    setPlatelets(p.platelets != null ? String(p.platelets) : '');
    setProthrombin(p.prothrombin != null ? String(p.prothrombin) : '');
    setAlkPhos(p.alk_phos != null ? String(p.alk_phos) : '');
  };

  const handleSelectForResults = (p: Patient) => {
    setActivePatient(p);
    populateResultsForm(p);
    setShowResultsCard(true);
    setTimeout(() => {
      resultsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const handleSelectForUpload = (p: Patient) => {
    setActivePatient(p);
    setSelectedFile(null);
    setShowUploadCard(true);
    setTimeout(() => {
      uploadCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // View PDF action: downloads or opens PDF in new tab
  const handleViewPdf = (p: Patient) => {
    if (p.reports && p.reports.length > 0) {
      const latestReport = p.reports[0];
      const downloadUrl = api.reports.getDownloadUrl(latestReport.id);
      window.open(downloadUrl, '_blank');
    } else {
      warning('No diagnostic report has been uploaded for this patient yet.');
    }
  };

  // Status change handler: persists laboratory workflow status to backend
  const handleStatusChange = async (patientId: number, newStatus: string) => {
    // Optimistic local update of lab_workflow_status
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, lab_workflow_status: newStatus } : p))
    );
    if (activePatient && activePatient.id === patientId) {
      setActivePatient((prev) => (prev ? { ...prev, lab_workflow_status: newStatus } : null));
    }

    try {
      const res = await api.patients.update(patientId, { lab_workflow_status: newStatus });
      if (res.success) {
        success(`Laboratory workflow status updated to "${newStatus}".`);
      } else {
        error((res as any).error || 'Failed to update status.');
        loadPatients(true);
      }
    } catch (err: any) {
      error(err?.message || 'Failed to update status.');
      loadPatients(true);
    }
  };

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
    if (!regGender || regGender === 'Select gender') {
      warning('Please select a gender.');
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
      });

      if (res.success && res.patient) {
        success(`Patient "${res.patient.full_name}" registered with ID: ${res.patient.portal_id || 'CC-' + res.patient.id}`);
        // Reset form
        setRegFullName('');
        setRegAge('');
        setRegGender('');
        setRegPhone('');
        // Refresh patient list and set as active patient
        await loadPatients(true);
        setActivePatient(res.patient);
        populateResultsForm(res.patient);
      } else {
        error((res as any).error || 'Registration failed.');
      }
    } catch (err: any) {
      error(err?.message || 'Registration failed.');
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // Handle Form 2: Save Test Results
  const handleResultsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient from the list first.');
      return;
    }

    setIsSubmittingResults(true);
    try {
      const payload: Record<string, any> = {};
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

      // Advance newly registered patient to 'Test In Progress'
      if (!activePatient.lab_workflow_status || activePatient.lab_workflow_status === 'Registered') {
        payload.lab_workflow_status = 'Test In Progress';
      }

      const res = await api.patients.update(activePatient.id, payload);
      if (res.success && res.patient) {
        success(`Laboratory test results saved for ${res.patient.full_name}.`);
        await loadPatients(true);
      } else {
        error((res as any).error || 'Failed to save test results.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to save test results.');
    } finally {
      setIsSubmittingResults(false);
    }
  };

  // Handle Form 3: Upload PDF Report
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        warning('Only PDF files are allowed.');
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
      warning('Please select a patient from the list first.');
      return;
    }
    if (!selectedFile) {
      warning('Please choose a PDF report file to upload.');
      return;
    }

    const existingReport = activePatient.reports && activePatient.reports.length > 0
      ? activePatient.reports[0]
      : null;

    setIsSubmittingUpload(true);
    try {
      const res = await api.reports.upload(
        activePatient.id,
        selectedFile,
        'Liver Function Test (LFT)',
        undefined,
        false,
        true,
        existingReport?.id
      );

      if (res.success) {
        success(
          existingReport
            ? `Diagnostic PDF report replaced successfully for ${activePatient.full_name}.`
            : `Diagnostic PDF report uploaded successfully for ${activePatient.full_name}.`
        );
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadPatients(true);
      } else {
        error((res as any).error || 'Failed to upload diagnostic report.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to upload report.');
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  // Filter patients by name or patient ID
  const filteredPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (p.full_name || '').toLowerCase().includes(q);
    const idMatch = (p.portal_id || `CC-${p.id}`).toLowerCase().includes(q);
    return nameMatch || idMatch;
  });

  // Current formatted date matching the reference screenshot: "Today: Wednesday, 28 October 2026"
  const getFormattedDate = () => {
    return `${t('Today: ', 'आज: ')}${formatFullDateLocalized(new Date(), isHindi)}`;
  };

  // Normalize status string to one of the 4 standard options
  const normalizeStatus = (status?: string | null): string => {
    if (!status) return 'Registered';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'Completed';
    if (s.includes('report') || s.includes('uploaded')) return 'Report Uploaded';
    if (s.includes('progress') || s.includes('pending') || s.includes('review')) return 'Test In Progress';
    return 'Registered';
  };

  // Subtle colors matching the reference screenshot exactly:
  // - Registered: light blue
  // - Test In Progress: light amber
  // - Report Uploaded: light purple
  // - Completed: light green
  const getStatusSelectStyle = (status?: string | null) => {
    const norm = normalizeStatus(status);
    switch (norm) {
      case 'Registered':
        return 'bg-[#eaf3fe] text-[#1877F2] border-[#cbe1fc]';
      case 'Test In Progress':
        return 'bg-[#fef6e7] text-[#d97706] border-[#fcd34d]';
      case 'Report Uploaded':
        return 'bg-[#f4edfd] text-[#7c3aed] border-[#ddd6fe]';
      case 'Completed':
        return 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]';
      default:
        return 'bg-[#eaf3fe] text-[#1877F2] border-[#cbe1fc]';
    }
  };

  const getStatusChevronColor = (status?: string | null) => {
    const norm = normalizeStatus(status);
    switch (norm) {
      case 'Registered':
        return 'text-[#1877F2]';
      case 'Test In Progress':
        return 'text-[#d97706]';
      case 'Report Uploaded':
        return 'text-[#7c3aed]';
      case 'Completed':
        return 'text-[#059669]';
      default:
        return 'text-[#1877F2]';
    }
  };

  // Clinical Treatment Status badge helper
  const getClinicalStatusBadge = (status?: string | null) => {
    const s = (status || 'Awaiting Doctor Review').toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {getTreatmentStatusText('Treatment Completed', isHindi)}
        </span>
      );
    }
    if (s.includes('follow')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getTreatmentStatusText('Follow-up Required', isHindi)}
        </span>
      );
    }
    if (s.includes('under') || s.includes('treatment')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {getTreatmentStatusText('Under Treatment', isHindi)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {getTreatmentStatusText('Awaiting Doctor Review', isHindi)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4. Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#eef7ff] via-[#e8f4fd] to-[#e3f0fc] p-6 lg:p-7 border border-[#d6eafb] relative overflow-hidden shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left Column: Heading and Info */}
          <div className="flex-1 min-w-0">
            {/* Pill Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 border border-sky-200/60 text-xs font-semibold text-slate-700 shadow-2xs mb-3">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span>{t('Clinical Laboratory Station • Accurate Tests, Healthier Lives', 'क्लिनिकल प्रयोगशाला केंद्र • सटीक परीक्षण, स्वस्थ जीवन')}</span>
            </div>

            {/* Heading */}
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-2">
              {t('Welcome back, ', 'पुनः स्वागत है, ')}{user?.name && !user.name.toLowerCase().includes('demo') && !user.name.toLowerCase().includes('tech') ? user.name.split(' ')[0] : (isHindi ? 'नेहा' : 'Neha')}! 🔬 💙
            </h1>

            {/* Description */}
            <p className="text-slate-600 text-xs lg:text-sm leading-relaxed max-w-xl mb-4 font-normal">
              {t(
                'Your work in the laboratory supports accurate diagnosis and better patient care. Register patients, enter test results, upload reports and update status — all in one place.',
                'प्रयोगशाला में आपका कार्य सटीक निदान और बेहतर रोगी देखभाल का समर्थन करता है। मरीजों को पंजीकृत करें, परीक्षण परिणाम दर्ज करें, रिपोर्ट अपलोड करें और स्थिति अपडेट करें - सब एक ही स्थान पर।'
              )}
            </p>

            {/* Date Card */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-sky-100 text-xs font-semibold text-slate-700 shadow-2xs">
              <Calendar className="w-4 h-4 text-cyan-600" />
              <span>{getFormattedDate()}</span>
            </div>
          </div>

          {/* Right Column: Laboratory Image & Vision Quote Card */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {/* Medical Laboratory Image Card */}
            <div className="w-64 h-36 lg:w-72 lg:h-38 rounded-2xl overflow-hidden border border-sky-200/60 shadow-sm relative shrink-0 bg-white">
              <img
                src="/assets/lab_hero_banner.jpg"
                alt="Clinical Laboratory Station"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Vision Quote Card */}
            <div className="w-60 lg:w-68 h-36 lg:h-38 rounded-2xl p-4 bg-[#fef9ee] border border-[#fde8c8] flex flex-col justify-between shadow-2xs relative shrink-0">
              <div>
                <p className="text-xs lg:text-sm font-semibold text-slate-800 leading-snug italic pr-12">
                  {t(
                    '“Every test brings clarity. Every report supports better care.”',
                    '“प्रत्येक परीक्षण स्पष्टता लाता है। प्रत्येक रिपोर्ट बेहतर देखभाल का आधार बनती है।”'
                  )}
                </p>
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver Diagnostic Graphic"
                  className="w-12 h-10 object-contain rounded-md absolute right-3 top-4 drop-shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {t('— CirrhoCare AI Laboratory Vision', '— सिरोकेयर एआई प्रयोगशाला दृष्टिकोण')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Patient List Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Users className="w-5 h-5 text-[#1877F2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{t('Patient List', 'मरीज़ों की सूची')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(
                  'Manage patients, enter test results, upload reports and update status.',
                  'मरीजों का प्रबंधन करें, परीक्षण परिणाम दर्ज करें, रिपोर्ट अपलोड करें और स्थिति अपडेट करें।'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadPatients(true)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title={t('Refresh patient list', 'रोगी सूची रीफ़्रेश करें')}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-blue-600')} />
            </button>
            <button
              onClick={() => {
                setShowRegisterCard(true);
                setTimeout(() => {
                  registerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
              }}
              className="inline-flex items-center justify-center gap-1.5 bg-[#1877F2] hover:bg-blue-700 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('Register Patient', 'मरीज़ पंजीकृत करें')}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('Search by patient name or patient ID...', 'रोगी के नाम या आईडी से खोजें...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800 transition"
          />
        </div>

        {/* Patient Table */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-600">{t('Loading laboratory patient records...', 'प्रयोगशाला रोगी रिकॉर्ड लोड हो रहे हैं...')}</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-slate-100">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">{t('No patients found', 'कोई रोगी नहीं मिला')}</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? t('Try adjusting your search query.', 'अपनी खोज क्वेरी समायोजित करने का प्रयास करें।')
                : t('Register a new patient to get started.', 'शुरू करने के लिए एक नया मरीज पंजीकृत करें।')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-xs md:text-sm text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-3.5 text-center w-12">#</th>
                  <th className="py-3.5 px-4">{t('Patient Name', 'रोगी का नाम')}</th>
                  <th className="py-3.5 px-4">{t('Patient ID', 'रोगी आईडी')}</th>
                  <th className="py-3.5 px-4">{t('Test Results', 'परीक्षण परिणाम')}</th>
                  <th className="py-3.5 px-4">{t('PDF Report', 'पीडीएफ रिपोर्ट')}</th>
                  <th className="py-3.5 px-4">{t('Status', 'स्थिति')}</th>
                  <th className="py-3.5 px-3.5 text-center">{t('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPatients.map((patient, index) => {
                  const hasReport = patient.reports && patient.reports.length > 0;
                  const isRowActive = activePatient?.id === patient.id;

                  return (
                    <tr
                      key={patient.id}
                      className={cn(
                        'hover:bg-slate-50/70 transition-colors',
                        isRowActive && 'bg-blue-50/20'
                      )}
                    >
                      {/* # */}
                      <td className="py-3.5 px-3.5 text-center text-slate-500 font-bold text-xs">
                        {index + 1}
                      </td>

                      {/* Patient Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{patient.full_name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs text-slate-400 font-medium">{t('Doctor: ', 'डॉक्टर: ')}</span>
                          {getClinicalStatusBadge(patient.treatment_status)}
                        </div>
                      </td>

                      {/* Patient ID */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 text-xs font-semibold">
                        {patient.portal_id || `CC-2026-${String(patient.id).padStart(4, '0')}`}
                      </td>

                      {/* Test Results */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleSelectForResults(patient)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-sky-50 text-[#1877F2] hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-[#1877F2]" />
                          <span>{t('Enter Results', 'परिणाम दर्ज करें')}</span>
                        </button>
                      </td>

                      {/* PDF Report */}
                      <td className="py-3.5 px-4">
                        {hasReport ? (
                          <button
                            onClick={() => handleViewPdf(patient)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                            title={t('View / Download uploaded PDF report', 'अपलोड की गई पीडीएफ रिपोर्ट देखें / डाउनलोड करें')}
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('View PDF', 'पीडीएफ देखें')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectForUpload(patient)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                            title={t('Upload PDF diagnostic report', 'डायग्नोस्टिक पीडीएफ रिपोर्ट अपलोड करें')}
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t('Upload PDF', 'पीडीएफ अपलोड करें')}</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="relative inline-block w-40">
                          <select
                            value={normalizeStatus(patient.lab_workflow_status || patient.treatment_status)}
                            onChange={(e) => handleStatusChange(patient.id, e.target.value)}
                            className={cn(
                              'w-full text-xs font-medium px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer pr-7 transition',
                              getStatusSelectStyle(patient.lab_workflow_status || patient.treatment_status)
                            )}
                          >
                            <option value="Registered">{getLabStatusText('Registered', isHindi)}</option>
                            <option value="Test In Progress">{getLabStatusText('Test in Progress', isHindi)}</option>
                            <option value="Report Uploaded">{getLabStatusText('Report Uploaded', isHindi)}</option>
                            <option value="Completed">{getLabStatusText('Completed', isHindi)}</option>
                          </select>
                          <ChevronDown
                            className={cn(
                              'w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none',
                              getStatusChevronColor(patient.lab_workflow_status || patient.treatment_status)
                            )}
                          />
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => setViewingPatient(patient)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t('View', 'देखें')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 9. Three Compact Form Cards in a Horizontal Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Card 1: Register Patient */}
        {showRegisterCard && (
          <div
            ref={registerCardRef}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#1877F2]" />
                <h3 className="text-sm font-bold text-slate-900">{t('Register Patient', 'मरीज़ पंजीकृत करें')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterCard(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                title={t('Close form', 'फ़ॉर्म बंद करें')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t('Full Name', 'पूरा नाम')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t('Enter patient name', 'मरीज़ का नाम दर्ज करें')}
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t('Age', 'आयु')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder={t('Enter age', 'आयु दर्ज करें')}
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  min="1"
                  max="130"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t('Gender', 'लिंग')} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800"
                  required
                >
                  <option value="">{t('Select gender', 'लिंग चुनें')}</option>
                  <option value="Male">{t('Male', 'पुरुष')}</option>
                  <option value="Female">{t('Female', 'महिला')}</option>
                  <option value="Other">{t('Other', 'अन्य')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t('Phone Number (Optional)', 'फ़ोन नंबर (वैकल्पिक)')}
                </label>
                <input
                  type="tel"
                  placeholder={t('Enter phone number', 'फ़ोन नंबर दर्ज करें')}
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegFullName('');
                    setRegAge('');
                    setRegGender('');
                    setRegPhone('');
                    setShowRegisterCard(false);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRegister}
                  className="px-4 py-2.5 text-sm font-bold text-white bg-[#1877F2] hover:bg-blue-700 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingRegister ? t('Registering...', 'पंजीकरण हो रहा है...') : t('Register Patient', 'मरीज़ पंजीकृत करें')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Card 2: Enter Test Results */}
        {showResultsCard && (
          <div
            ref={resultsCardRef}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-[#1877F2]" />
                <h3 className="text-base font-bold text-slate-900">{t('Enter Test Results', 'परीक्षण परिणाम दर्ज करें')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResultsCard(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
                title={t('Close form', 'फ़ॉर्म बंद करें')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Patient Banner */}
            {activePatient && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between text-xs md:text-sm">
                <span className="font-bold text-slate-800 truncate">
                  {t('Patient: ', 'मरीज़: ')}{activePatient.full_name}
                </span>
                <span className="font-mono text-slate-600 text-xs font-semibold shrink-0">
                  {activePatient.portal_id || `CC-2026-${String(activePatient.id).padStart(4, '0')}`}
                </span>
              </div>
            )}

            {/* Two-Column Input Grid */}
            <form onSubmit={handleResultsSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Total Bilirubin', isHindi)} (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1.2"
                    value={totalBilirubin}
                    onChange={(e) => setTotalBilirubin(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Direct Bilirubin', isHindi)} (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.4"
                    value={directBilirubin}
                    onChange={(e) => setDirectBilirubin(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('SGOT (AST)', isHindi)} (U/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 40"
                    value={sgotAst}
                    onChange={(e) => setSgotAst(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('SGPT (ALT)', isHindi)} (U/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 45"
                    value={sgptAlt}
                    onChange={(e) => setSgptAlt(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Albumin', isHindi)} (g/dL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 3.5"
                    value={albumin}
                    onChange={(e) => setAlbumin(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Platelets', isHindi)} (×10³/µL)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 150"
                    value={platelets}
                    onChange={(e) => setPlatelets(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Prothrombin Time', isHindi)} (sec)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 14.2"
                    value={prothrombin}
                    onChange={(e) => setProthrombin(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 truncate">
                    {getBiomarkerName('Alk Phosphatase', isHindi)} (U/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 120"
                    value={alkPhos}
                    onChange={(e) => setAlkPhos(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 text-slate-800"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResultsCard(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResults}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1877F2] hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {isSubmittingResults ? t('Saving...', 'सहेजा जा रहा है...') : t('Save Results', 'परिणाम सहेजें')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Card 3: Upload PDF Report */}
        {showUploadCard && (
          <div
            ref={uploadCardRef}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">{t('Upload PDF Report', 'पीडीएफ रिपोर्ट अपलोड करें')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadCard(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                title={t('Close form', 'फ़ॉर्म बंद करें')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Patient Information Strip */}
            <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-2.5 flex items-center gap-2.5 mb-3.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1877F2] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {t('Patient: ', 'मरीज़: ')}{activePatient?.full_name || 'Motu Yadav'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  {t('Patient ID: ', 'रोगी आईडी: ')}{activePatient?.portal_id || 'CC-2026-3292'}
                </p>
              </div>
            </div>

            {/* Large Bordered Upload Area */}
            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-sky-50/20 transition cursor-pointer"
              >
                <UploadCloud className="w-8 h-8 text-blue-500/70 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-800">{t('Select PDF file', 'पीडीएफ फ़ाइल चुनें')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-2.5">
                  {t('Only PDF files are allowed (Max 10 MB)', 'केवल पीडीएफ फाइलें अनुमत हैं (अधिकतम 10 एमबी)')}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-4 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition"
                >
                  {t('Choose File', 'फ़ाइल चुनें')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <div className="mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded-lg text-left flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-blue-900 max-w-[180px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-blue-600 shrink-0">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setShowUploadCard(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpload || !selectedFile}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1877F2] hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {isSubmittingUpload
                    ? t('Uploading...', 'अपलोड हो रहा है...')
                    : activePatient?.reports && activePatient.reports.length > 0
                    ? t('Upload Replacement PDF', 'प्रतिस्थापन पीडीएफ अपलोड करें')
                    : t('Upload PDF', 'पीडीएफ अपलोड करें')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Re-open Form Pills if closed */}
      {(!showRegisterCard || !showResultsCard || !showUploadCard) && (
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-slate-400">{t('Quick forms:', 'त्वरित फॉर्म:')}</span>
          {!showRegisterCard && (
            <button
              onClick={() => setShowRegisterCard(true)}
              className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 transition"
            >
              + {t('Open Register Patient', 'मरीज़ पंजीकरण खोलें')}
            </button>
          )}
          {!showResultsCard && (
            <button
              onClick={() => setShowResultsCard(true)}
              className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 transition"
            >
              + {t('Open Test Results', 'परीक्षण परिणाम खोलें')}
            </button>
          )}
          {!showUploadCard && (
            <button
              onClick={() => setShowUploadCard(true)}
              className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg border border-blue-200 transition"
            >
              + {t('Open Upload PDF', 'पीडीएफ अपलोड खोलें')}
            </button>
          )}
        </div>
      )}

      {/* Patient Details View Modal */}
      {viewingPatient && (
        <Modal
          isOpen={!!viewingPatient}
          onClose={() => setViewingPatient(null)}
          title={`${t('Patient Record: ', 'रोगी रिकॉर्ड: ')}${viewingPatient.full_name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">{viewingPatient.full_name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {t('ID:', 'आईडी:')} {viewingPatient.portal_id || `CC-2026-${viewingPatient.id}`} • {viewingPatient.age} {t('yrs', 'वर्ष')} • {viewingPatient.gender === 'Male' ? t('Male', 'पुरुष') : viewingPatient.gender === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')}
                </p>
                {viewingPatient.phone && (
                  <p className="text-xs text-slate-500 mt-0.5">{t('Phone:', 'फ़ोन:')} {viewingPatient.phone}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={cn('px-3 py-1 rounded-lg text-xs font-semibold border', getStatusSelectStyle(viewingPatient.lab_workflow_status || viewingPatient.treatment_status))}>
                  {t('Lab: ', 'लैब: ')}{getLabStatusText(viewingPatient.lab_workflow_status || viewingPatient.treatment_status, isHindi)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-medium">{t('Doctor:', 'डॉक्टर:')}</span>
                  {getClinicalStatusBadge(viewingPatient.treatment_status)}
                </div>
              </div>
            </div>

            {/* Biomarker Summary */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('Laboratory Biomarkers', 'प्रयोगशाला बायोमार्कर')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Total Bilirubin', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.bilirubin ?? '—'} mg/dL</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Direct Bilirubin', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.direct_bilirubin ?? '—'} mg/dL</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('SGOT (AST)', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.sgot ?? (viewingPatient as any).sgot_ast ?? '—'} U/L</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('SGPT (ALT)', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.sgpt ?? (viewingPatient as any).sgpt_alt ?? '—'} U/L</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Albumin', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.albumin ?? '—'} g/dL</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Platelets', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.platelets ?? '—'} ×10³/µL</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Prothrombin Time', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.prothrombin ?? '—'} sec</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">{getBiomarkerName('Alk Phosphatase', isHindi)}</span>
                  <span className="font-semibold text-slate-800">{viewingPatient.alk_phos ?? '—'} U/L</span>
                </div>
              </div>
            </div>

            {/* Diagnostic Reports */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('Diagnostic Reports', 'डायग्नोस्टिक रिपोर्ट')} ({viewingPatient.reports?.length || 0})
              </h4>
              {viewingPatient.reports && viewingPatient.reports.length > 0 ? (
                <div className="space-y-2">
                  {viewingPatient.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-800">{rep.original_filename || rep.filename}</p>
                          <p className="text-[10px] text-slate-400">{rep.category} • {rep.uploaded_at ? formatDateLocalized(rep.uploaded_at, isHindi) : ''}</p>
                        </div>
                      </div>
                      <a
                        href={api.reports.getDownloadUrl(rep.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('Download', 'डाउनलोड')}</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">{t('No reports uploaded yet.', 'अभी तक कोई रिपोर्ट अपलोड नहीं की गई है।')}</p>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const p = viewingPatient;
                  setViewingPatient(null);
                  handleSelectForResults(p);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
              >
                {t('Edit Test Results', 'परीक्षण परिणाम संपादित करें')}
              </button>
              <button
                onClick={() => {
                  const p = viewingPatient;
                  setViewingPatient(null);
                  handleSelectForUpload(p);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
              >
                {t('Upload PDF', 'पीडीएफ अपलोड करें')}
              </button>
              <button
                onClick={() => setViewingPatient(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                {t('Close', 'बंद करें')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
