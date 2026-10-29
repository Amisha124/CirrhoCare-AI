import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  FlaskConical,
  HeartPulse,
  Loader2,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { Appointment, MedicalReport, Patient, Prescription } from '@/types';
import { cn } from '@/utils/cn';
import {
  formatDateLocalized,
  formatFullDateLocalized,
  getTreatmentStatusText,
  getLabStatusText,
  getAppointmentStatusText,
  getAppointmentReasonText,
  getBiomarkerName,
} from '@/utils/translations';

interface MedicineRow {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const HepatologistDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi, t } = useLanguage();
  const { success, error, warning } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected patient for the Right Panel
  const [activePatient, setActivePatient] = useState<Patient | null>(null);

  // Active tab in right panel: 'lab_results' | 'lab_report' | 'prescription' | 'diet_care' | 'appointments'
  const [activeTab, setActiveTab] = useState<'lab_results' | 'lab_report' | 'prescription' | 'diet_care' | 'appointments'>('lab_results');

  // PDF Viewer Modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<MedicalReport | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfProbeError, setPdfProbeError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Patient appointments state
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Appointment action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'Confirm' | 'Rescheduled' | 'Rejected' | 'Completed' | null>(null);
  const [selectedAppnt, setSelectedAppnt] = useState<Appointment | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Tab 3: Multi-Medicine Prescription state
  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([
    { name: '', dose: '', frequency: '', duration: '', instructions: '' },
  ]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Tab 4: Diet & Care Plan state
  const [recommendedFoods, setRecommendedFoods] = useState('');
  const [avoidFoods, setAvoidFoods] = useState('');
  const [mealInstructions, setMealInstructions] = useState('');
  const [restActivity, setRestActivity] = useState('');
  const [additionalCare, setAdditionalCare] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSubmittingAdvice, setIsSubmittingAdvice] = useState(false);

  // Patient prescriptions list cache
  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([]);
  const [isLoadingRx, setIsLoadingRx] = useState(false);

  // Treatment Status Management state
  const [selectedTreatmentStatus, setSelectedTreatmentStatus] = useState<string>('Awaiting Doctor Review');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isCompletionConfirmOpen, setIsCompletionConfirmOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Load all patients from backend
  const loadPatients = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await api.patients.list({ per_page: 100 });
      if (res.success && res.patients) {
        setPatients(res.patients);

        if (!activePatient && res.patients.length > 0) {
          selectPatient(res.patients[0]);
        } else if (activePatient) {
          // Re-sync active patient with fresh data
          const updated = res.patients.find((p) => p.id === activePatient.id);
          if (updated) {
            selectPatient(updated, false);
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

  // When active patient changes, sync advice form and fetch patient prescriptions
  const selectPatient = (patient: Patient, resetTab = true) => {
    setActivePatient(patient);
    setSelectedTreatmentStatus(patient.treatment_status || 'Awaiting Doctor Review');
    if (resetTab) {
      setActiveTab('lab_results');
    }

    // Populate Diet & Care from patient data if available
    if (patient.diet_plan) {
      const parts = patient.diet_plan.split('\n\n');
      setRecommendedFoods(parts[0]?.replace(/^Recommended:\s*/i, '') || patient.diet_plan);
      setAvoidFoods(parts[1]?.replace(/^Avoid:\s*/i, '') || '');
      setMealInstructions(parts[2]?.replace(/^Meals:\s*/i, '') || '');
    } else {
      setRecommendedFoods('');
      setAvoidFoods('');
      setMealInstructions('');
    }

    if (patient.care_instructions) {
      const parts = patient.care_instructions.split('\n\n');
      setRestActivity(parts[0]?.replace(/^Rest:\s*/i, '') || patient.care_instructions);
      setAdditionalCare(parts[1]?.replace(/^Care:\s*/i, '') || '');
    } else {
      setRestActivity('');
      setAdditionalCare('');
    }

    setFollowUpDate(patient.follow_up_date ? String(patient.follow_up_date).slice(0, 10) : '');

    // Load prescriptions and appointments for this patient
    loadPrescriptionsForPatient(patient.id);
    loadAppointmentsForPatient(patient.id);
  };

  const loadPrescriptionsForPatient = async (patientId: number) => {
    setIsLoadingRx(true);
    try {
      const res = await api.prescriptions.list({ patient_id: patientId, per_page: 50 });
      if (res.success && res.prescriptions) {
        setPatientPrescriptions(res.prescriptions);
      } else {
        setPatientPrescriptions([]);
      }
    } catch {
      setPatientPrescriptions([]);
    } finally {
      setIsLoadingRx(false);
    }
  };

  const loadAppointmentsForPatient = async (patientId: number) => {
    setIsLoadingAppointments(true);
    try {
      const res = await api.appointments.list({ patient_id: patientId, per_page: 50 });
      if (res.success && res.appointments) {
        setPatientAppointments(res.appointments);
      } else {
        setPatientAppointments([]);
      }
    } catch {
      setPatientAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  // Medicine rows helpers
  const handleAddMedicineRow = () => {
    setMedicineRows((prev) => [
      ...prev,
      { name: '', dose: '', frequency: '', duration: '', instructions: '' },
    ]);
  };

  const handleRemoveMedicineRow = (index: number) => {
    if (medicineRows.length <= 1) return;
    setMedicineRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMedicineChange = (index: number, field: keyof MedicineRow, value: string) => {
    setMedicineRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Handle Save Treatment Status
  const handleSaveTreatmentStatus = async (overrideStatus?: string, overrideNotes?: string) => {
    if (!activePatient) {
      warning('Please select a patient first.');
      return;
    }

    const targetStatus = overrideStatus || selectedTreatmentStatus;

    if (targetStatus === 'Treatment Completed' && !overrideStatus && !isCompletionConfirmOpen) {
      setIsCompletionConfirmOpen(true);
      return;
    }

    setIsSavingStatus(true);
    try {
      const res = await api.patients.updateReviewStatus(activePatient.id, targetStatus, {
        confirm: targetStatus === 'Treatment Completed',
        treatment_notes: overrideNotes || completionNotes || undefined,
      });

      if (res.success && res.patient) {
        success(`Treatment status updated to "${res.patient.treatment_status}" for ${activePatient.full_name}.`);
        setActivePatient(res.patient);
        setSelectedTreatmentStatus(res.patient.treatment_status);
        setIsCompletionConfirmOpen(false);
        setCompletionNotes('');

        // Update local patient list immediately
        setPatients((prev) =>
          prev.map((p) =>
            p.id === res.patient.id
              ? {
                  ...p,
                  treatment_status: res.patient.treatment_status,
                  treatment_status_updated_at: res.patient.treatment_status_updated_at,
                }
              : p
          )
        );

        window.dispatchEvent(new CustomEvent('patient-status-updated', { detail: res.patient }));
      } else {
        error((res as any)?.error || res?.message || 'Failed to update treatment status.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to update treatment status.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Submit Multi-Medicine Prescription
  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient first.');
      return;
    }

    const validMedicines = medicineRows.filter((r) => r.name.trim() !== '');
    if (validMedicines.length === 0) {
      warning('Please enter at least one medicine name.');
      return;
    }

    setIsSubmittingRx(true);
    try {
      const medicinesPayload = validMedicines.map((m) => ({
        medicine: m.name.trim(),
        dosage: m.dose.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        instructions: m.instructions.trim(),
      }));

      const res = await api.prescriptions.create(activePatient.id, {
        medicines: medicinesPayload,
        clinical_notes: prescriptionNotes.trim(),
        follow_up_date: followUpDate.trim() || undefined,
      });

      if (res.success) {
        success(`Prescription saved successfully for ${activePatient.full_name}.`);
        setMedicineRows([{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
        setPrescriptionNotes('');
        await loadPatients(true);
        await loadPrescriptionsForPatient(activePatient.id);
      } else {
        error((res as any).error || 'Failed to save prescription.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to save prescription.');
    } finally {
      setIsSubmittingRx(false);
    }
  };

  // Submit Diet & Care Advice
  const handleSaveAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient first.');
      return;
    }

    setIsSubmittingAdvice(true);
    try {
      const dietParts = [];
      if (recommendedFoods.trim()) dietParts.push(`Recommended: ${recommendedFoods.trim()}`);
      if (avoidFoods.trim()) dietParts.push(`Avoid: ${avoidFoods.trim()}`);
      if (mealInstructions.trim()) dietParts.push(`Meals: ${mealInstructions.trim()}`);
      const dietPlanCompiled = dietParts.join('\n\n');

      const careParts = [];
      if (restActivity.trim()) careParts.push(`Rest: ${restActivity.trim()}`);
      if (additionalCare.trim()) careParts.push(`Care: ${additionalCare.trim()}`);
      const careCompiled = careParts.join('\n\n');

      const res = await api.patients.saveAdvice(activePatient.id, {
        diet_plan: dietPlanCompiled,
        care_instructions: careCompiled,
        follow_up_date: followUpDate.trim() || undefined,
      });

      if (res.success) {
        success(`Diet plan & care instructions saved for ${activePatient.full_name}.`);
        await loadPatients(true);
      } else {
        error((res as any).error || 'Failed to save advice.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to save advice.');
    } finally {
      setIsSubmittingAdvice(false);
    }
  };

  // PDF Viewer probe effect: avoids rendering raw JSON error responses inside an iframe
  useEffect(() => {
    if (!viewingReport || !pdfModalOpen) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setPdfProbeError(null);
      setIsLoadingPdf(false);
      return;
    }

    let active = true;
    setIsLoadingPdf(true);
    setPdfProbeError(null);
    setPdfBlobUrl(null);

    fetch(`${api.reports.getDownloadUrl(viewingReport.id)}?inline=true`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          let msg = 'This diagnostic report could not be previewed inline.';
          try {
            const data = await res.json();
            if (data?.error) {
              msg = data.error;
            }
          } catch {
            // non-json response
          }
          setPdfProbeError(msg);
          return;
        }
        const blob = await res.blob();
        if (!active) return;
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      })
      .catch((err) => {
        if (!active) return;
        setPdfProbeError(err?.message || 'Network error loading report file.');
      })
      .finally(() => {
        if (active) setIsLoadingPdf(false);
      });

    return () => {
      active = false;
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [viewingReport, pdfModalOpen]);

  // PDF Viewer helper
  const handleViewPdf = (rep: MedicalReport) => {
    setViewingReport(rep);
    setPdfProbeError(null);
    setPdfModalOpen(true);
  };

  // Appointment action helpers
  const openAppointmentAction = (appnt: Appointment, type: 'Confirm' | 'Rescheduled' | 'Rejected' | 'Completed') => {
    setSelectedAppnt(appnt);
    setActionType(type);
    setActionNote('');
    setRescheduleDate(appnt.scheduled_at ? appnt.scheduled_at.slice(0, 16) : '');
    setActionModalOpen(true);
  };

  const handleExecuteAppointmentAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAppnt || !actionType) return;

    if (actionType === 'Rescheduled' && !rescheduleDate) {
      error('Please select a new date and time for rescheduling.');
      return;
    }
    if (actionType === 'Rejected' && !actionNote.trim()) {
      error('Please provide a reason for rejecting the appointment.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      const payload: any = {
        doctor_notes: actionNote.trim() || undefined,
        reason: actionNote.trim() || undefined,
      };
      if (actionType === 'Rescheduled' && rescheduleDate) {
        payload.scheduled_at = rescheduleDate;
      }

      const targetStatus = actionType === 'Confirm' ? 'Confirmed' : actionType;
      const res = await api.appointments.updateStatus(selectedAppnt.id, targetStatus, payload);
      if (res.success) {
        success(`Appointment status updated to ${actionType}.`);
        setActionModalOpen(false);
        setSelectedAppnt(null);
        setActionType(null);
        if (activePatient) {
          loadAppointmentsForPatient(activePatient.id);
        }
      } else {
        error(res.message || 'Failed to update appointment status.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating appointment status.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Filter patients by name or ID
  const filteredPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (p.full_name || '').toLowerCase().includes(q);
    const idMatch = (p.portal_id || `CC-${p.id}`).toLowerCase().includes(q);
    return nameMatch || idMatch;
  });

  // Current formatted date matching reference screenshot: "Today: Wednesday, 28 October 2026"
  const getFormattedDate = () => {
    return `${t('Today: ', 'आज: ')}${formatFullDateLocalized(new Date(), isHindi)}`;
  };

  // Helper to normalize status colors
  const getStatusBadge = (status?: string | null) => {
    const raw = status || 'Awaiting Doctor Review';
    const s = raw.toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#d1fae5] text-[#059669] border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {getTreatmentStatusText('Treatment Completed', isHindi)}
        </span>
      );
    }
    if (s.includes('follow')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fef3c7] text-[#b45309] border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getTreatmentStatusText('Follow-up Required', isHindi)}
        </span>
      );
    }
    if (s.includes('under') || s.includes('treatment')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {getTreatmentStatusText('Under Treatment', isHindi)}
        </span>
      );
    }
    if (s.includes('progress')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fef3c7] text-[#d97706] border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getLabStatusText('Test in Progress', isHindi)}
        </span>
      );
    }
    if (s.includes('report') || s.includes('uploaded')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#f3e8ff] text-[#7c3aed] border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {getLabStatusText('Report Uploaded', isHindi)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#eaf3fe] text-[#1877F2] border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {getTreatmentStatusText(raw === 'Registered' ? 'Awaiting Doctor Review' : raw, isHindi)}
      </span>
    );
  };

  // Biomarker value helper
  const renderBiomarkerValue = (val: number | null | undefined, unit: string) => {
    if (val === null || val === undefined || isNaN(Number(val))) {
      return <span className="italic text-slate-400 font-normal">{t('Not entered', 'दर्ज नहीं')}</span>;
    }
    return (
      <span className="font-semibold text-slate-800">
        {val} <span className="text-xs text-slate-500 font-normal">{unit}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#eef7ff] via-[#e8f4fd] to-[#e3f0fc] p-6 lg:p-7 border border-[#d6eafb] relative overflow-hidden shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left Column: Heading and Info */}
          <div className="flex-1 min-w-0">
            {/* Pill Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 border border-sky-200/60 text-xs font-semibold text-slate-700 shadow-2xs mb-3">
              <span className="w-2 h-2 rounded-full bg-[#1877F2] animate-pulse" />
              <span>{t('Hepatology Consultation Station • Precision Care & Treatment', 'हेपेटोलॉजी परामर्श केंद्र • सटीक देखभाल एवं उपचार')}</span>
            </div>

            {/* Heading */}
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-2">
              {t('Welcome back, Dr. Sharma! 🩺 💙', 'पुनः स्वागत है, डॉ. शर्मा! 🩺 💙')}
            </h1>

            {/* Description */}
            <p className="text-slate-600 text-xs lg:text-sm leading-relaxed max-w-xl mb-4 font-normal">
              {t(
                'Review patient details, view lab reports, prescribe medicines, and provide care instructions.',
                'मरीज़ के विवरण की समीक्षा करें, लैब रिपोर्ट देखें, दवाएं लिखें, और देखभाल निर्देश प्रदान करें।'
              )}
            </p>

            {/* Date Card */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-sky-100 text-xs font-semibold text-slate-700 shadow-2xs">
              <Calendar className="w-4 h-4 text-[#1877F2]" />
              <span>{getFormattedDate()}</span>
            </div>
          </div>

          {/* Right Column: Medical Graphic & Vision Quote Card */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {/* Mascot Image Card */}
            <div className="w-64 h-36 lg:w-72 lg:h-38 rounded-2xl overflow-hidden border border-sky-200/60 shadow-sm relative shrink-0 bg-white">
              <img
                src="/assets/doctor_sidebar_mascot.jpg"
                alt="Hepatologist Care Station"
                className="w-full h-full object-contain p-2"
              />
            </div>

            {/* Vision Quote Card */}
            <div className="w-60 lg:w-68 h-36 lg:h-38 rounded-2xl p-4 bg-[#fef9ee] border border-[#fde8c8] flex flex-col justify-between shadow-2xs relative shrink-0">
              <div>
                <p className="text-xs lg:text-sm font-semibold text-slate-800 leading-snug italic pr-12">
                  {t(
                    '“Precision diagnosis, compassionate care, healthier livers.”',
                    '“सटीक निदान, संवेदनशील देखभाल, स्वस्थ यकृत।”'
                  )}
                </p>
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver Diagnostic Graphic"
                  className="w-12 h-10 object-contain rounded-md absolute right-3 top-4 drop-shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {t('— CirrhoCare AI Clinical Vision', '— सिरोकेयर एआई चिकित्सीय दृष्टिकोण')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Desktop Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            LEFT COLUMN (7 cols): Patient Table
        ========================================================================= */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:p-6">
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1877F2] shrink-0">
                <Users className="w-5 h-5 text-[#1877F2]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{t('Patient List', 'मरीज़ों की सूची')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    'Review patient details, view lab reports, prescribe medicines, and provide care instructions.',
                    'मरीज़ के विवरण की समीक्षा करें, लैब रिपोर्ट देखें, दवाएं लिखें, और देखभाल निर्देश प्रदान करें।'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {t('Total Patients: ', 'कुल मरीज़: ')}<strong className="text-slate-800">{patients.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => loadPatients(true)}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title={t('Refresh patient list', 'रोगी सूची रीफ़्रेश करें')}
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-blue-600')} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('Search by patient name or patient ID...', 'रोगी के नाम या आईडी से खोजें...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-slate-50/80 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Patients Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-3.5 w-12 text-center">#</th>
                  <th className="py-3.5 px-3.5">{t('Patient Name', 'रोगी का नाम')}</th>
                  <th className="py-3.5 px-3.5">{t('Patient ID', 'रोगी आईडी')}</th>
                  <th className="py-3.5 px-3.5">{t('Age', 'आयु')}</th>
                  <th className="py-3.5 px-3.5">{t('Gender', 'लिंग')}</th>
                  <th className="py-3.5 px-3.5">{t('Bilirubin', 'बिलीरुबिन')}</th>
                  <th className="py-3.5 px-3.5">{t('Albumin', 'एल्ब्यूमिन')}</th>
                  <th className="py-3.5 px-3.5 text-center">{t('Lab Report', 'लैब रिपोर्ट')}</th>
                  <th className="py-3.5 px-3.5 text-center">{t('Status', 'स्थिति')}</th>
                  <th className="py-3.5 px-3.5 text-center">{t('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#1877F2]" />
                        <span>{t('Loading clinical patient records...', 'रोगी रिकॉर्ड लोड हो रहे हैं...')}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-600">{t('No patients found', 'कोई रोगी नहीं मिला')}</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery
                          ? t('Try clearing your search filters', 'अपने खोज फ़िल्टर साफ़ करने का प्रयास करें')
                          : t('Lab technician intake patients will appear here', 'लैब तकनीशियन द्वारा दर्ज किए गए रोगी यहां दिखाई देंगे')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p, idx) => {
                    const isSelected = activePatient?.id === p.id;
                    const hasReport = p.reports && p.reports.length > 0;
                    const firstReport = hasReport ? p.reports![0] : null;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => selectPatient(p, false)}
                        className={cn(
                          'hover:bg-blue-50/40 transition cursor-pointer',
                          isSelected ? 'bg-blue-50/60 font-medium' : ''
                        )}
                      >
                        <td className="py-3.5 px-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {p.full_name}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {p.portal_id || `CC-${p.id}`}
                        </td>
                        <td className="py-3.5 px-3.5 text-slate-700 whitespace-nowrap">{p.age}</td>
                        <td className="py-3.5 px-3.5 text-slate-700 capitalize whitespace-nowrap">
                          {p.gender === 'male' || p.gender === 'Male'
                            ? (isHindi ? 'पुरुष' : 'Male')
                            : p.gender === 'female' || p.gender === 'Female'
                            ? (isHindi ? 'महिला' : 'Female')
                            : (p.gender || '—')}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {p.bilirubin != null ? (
                            <span className="font-semibold text-slate-800">{p.bilirubin} mg/dL</span>
                          ) : (
                            <span className="italic text-slate-400">{t('Not entered', 'दर्ज नहीं')}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {p.albumin != null ? (
                            <span className="font-semibold text-slate-800">{p.albumin} g/dL</span>
                          ) : (
                            <span className="italic text-slate-400">{t('Not entered', 'दर्ज नहीं')}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {hasReport && firstReport ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewPdf(firstReport);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                              title={t('Click to view PDF diagnostic report', 'पीडीएफ डायग्नोस्टिक रिपोर्ट देखने के लिए क्लिक करें')}
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{t('View PDF', 'पीडीएफ देखें')}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200/60">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{t('Not uploaded', 'अपलोड नहीं')}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(p.treatment_status)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPatient(p, false);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer',
                              isSelected
                                ? 'bg-[#1877F2] text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('View', 'देखें')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN (5 cols): Patient Details Panel with 4 Tabs
        ========================================================================= */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:p-6 sticky top-20">
          {activePatient ? (
            <div className="space-y-4">
              {/* Header Strip */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-[#1877F2] flex items-center justify-center font-bold text-sm shrink-0">
                      {activePatient.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-slate-900 truncate">
                        {activePatient.full_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono text-[11px] text-[#1877F2] font-bold">
                          {activePatient.portal_id || `CC-${activePatient.id}`}
                        </span>
                        <span>•</span>
                        <span>{activePatient.age} Y, {activePatient.gender || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(activePatient.treatment_status)}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    {t('Doctor: ', 'डॉक्टर: ')}<strong className="text-slate-800">{activePatient.assigned_doctor_name || (isHindi ? 'डॉ. शर्मा' : 'Dr. Sharma')}</strong>
                  </span>
                  <span>
                    {t('Reports: ', 'रिपोर्ट: ')}<strong className="text-slate-800">{activePatient.reports?.length || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Treatment Status Management Control */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/40 border border-blue-100 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#1877F2]" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {t('Treatment Status', 'उपचार स्थिति')}
                    </span>
                  </div>
                  {activePatient.treatment_status_updated_at && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('Updated: ', 'अद्यतन: ')}{formatDateLocalized(activePatient.treatment_status_updated_at, isHindi)}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedTreatmentStatus}
                      onChange={(e) => setSelectedTreatmentStatus(e.target.value)}
                      className="w-full text-sm font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:border-[#1877F2] outline-none transition cursor-pointer pr-8 text-slate-800"
                    >
                      <option value="Awaiting Doctor Review">{t('Awaiting Doctor Review', 'डॉक्टर समीक्षा की प्रतीक्षा')}</option>
                      <option value="Under Treatment">{t('Under Treatment', 'उपचाराधीन')}</option>
                      <option value="Follow-up Required">{t('Follow-up Required', 'फॉलो-अप आवश्यक')}</option>
                      <option value="Treatment Completed">{t('Treatment Completed', 'उपचार पूर्ण')}</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveTreatmentStatus()}
                    disabled={isSavingStatus}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#1877F2] hover:bg-blue-600 active:scale-[0.98] text-white shadow-xs transition shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingStatus ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('Saving...', 'सहेजा जा रहा है...')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{t('Save Status', 'स्थिति सहेजें')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 5 Tabs Header */}
              <div className="grid grid-cols-5 border-b border-slate-200 text-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab('lab_results')}
                  className={cn(
                    'py-2.5 text-center font-bold transition flex items-center justify-center gap-1 border-b-2',
                    activeTab === 'lab_results'
                      ? 'border-[#1877F2] text-[#1877F2]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <FlaskConical className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('Lab Results', 'लैब परिणाम')}</span>
                  <span className="sm:hidden">{t('Results', 'परिणाम')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('lab_report')}
                  className={cn(
                    'py-2.5 text-center font-bold transition flex items-center justify-center gap-1 border-b-2',
                    activeTab === 'lab_report'
                      ? 'border-[#1877F2] text-[#1877F2]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('Lab Report', 'लैब रिपोर्ट')}</span>
                  <span className="sm:hidden">{t('Report', 'रिपोर्ट')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('prescription')}
                  className={cn(
                    'py-2.5 text-center font-bold transition flex items-center justify-center gap-1 border-b-2',
                    activeTab === 'prescription'
                      ? 'border-[#1877F2] text-[#1877F2]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <Pill className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('Prescription', 'पर्चे')}</span>
                  <span className="sm:hidden">{t('Rx', 'पर्चे')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('diet_care')}
                  className={cn(
                    'py-2.5 text-center font-bold transition flex items-center justify-center gap-1 border-b-2',
                    activeTab === 'diet_care'
                      ? 'border-[#1877F2] text-[#1877F2]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <HeartPulse className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('Diet & Care', 'आहार एवं देखभाल')}</span>
                  <span className="sm:hidden">{t('Diet', 'आहार')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('appointments')}
                  className={cn(
                    'py-2.5 text-center font-bold transition flex items-center justify-center gap-1 border-b-2 relative',
                    activeTab === 'appointments'
                      ? 'border-[#1877F2] text-[#1877F2]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('Appts', 'अपॉइंटमेंट')}</span>
                  <span className="sm:hidden">{t('Appt', 'अपॉइंट')}</span>
                  {patientAppointments.filter((a) => a.status === 'Pending').length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                </button>
              </div>

              {/* Tab 1: Lab Results Panel */}
              {activeTab === 'lab_results' && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {t('Liver Biomarkers Panel', 'लिवर बायोमार्कर पैनल')}
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">
                      {t('Standard Reference Ranges', 'मानक संदर्भ सीमाएं')}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30">
                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Total Bilirubin', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 0.2 - 1.2 mg/dL' : 'Normal: 0.2 - 1.2 mg/dL'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.bilirubin, 'mg/dL')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Direct Bilirubin', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 0.0 - 0.3 mg/dL' : 'Normal: 0.0 - 0.3 mg/dL'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.direct_bilirubin, 'mg/dL')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('SGOT (AST)', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 8 - 48 U/L' : 'Normal: 8 - 48 U/L'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.sgot, 'U/L')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('SGPT (ALT)', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 7 - 56 U/L' : 'Normal: 7 - 56 U/L'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.sgpt, 'U/L')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Albumin', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 3.5 - 5.5 g/dL' : 'Normal: 3.5 - 5.5 g/dL'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.albumin, 'g/dL')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Platelets', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 150 - 450 ×10³/µL' : 'Normal: 150 - 450 ×10³/µL'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.platelets, '×10³/µL')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Prothrombin Time', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 11.0 - 13.5 s' : 'Normal: 11.0 - 13.5 s'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.prothrombin, 's')}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{getBiomarkerName('Alkaline Phosphatase', isHindi)}</p>
                        <p className="text-xs text-slate-500 font-medium">{isHindi ? 'सामान्य: 44 - 147 U/L' : 'Normal: 44 - 147 U/L'}</p>
                      </div>
                      <div className="text-right">
                        {renderBiomarkerValue(activePatient.alk_phos, 'U/L')}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5 text-sm text-blue-900">
                    <Sparkles className="w-4 h-4 text-[#1877F2] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{t('Clinical Guidance', 'नैदानिक मार्गदर्शन')}</p>
                      <p className="text-xs md:text-sm text-blue-800 leading-relaxed mt-0.5">
                        {t(
                          'Biomarker values recorded by the laboratory technician inform diagnosis and therapeutic decisions. Prescribe medications or provide diet & care instructions using the tabs above.',
                          'प्रयोगशाला तकनीशियन द्वारा दर्ज किए गए बायोमार्कर मान निदान और उपचार निर्णयों को सूचित करते हैं। ऊपर दिए गए टैब का उपयोग करके दवाएं लिखें या आहार और देखभाल निर्देश प्रदान करें।'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Lab Report Panel */}
              {activeTab === 'lab_report' && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {t('Uploaded Diagnostic PDF Reports', 'अपलोड की गई डायग्नोस्टिक पीडीएफ रिपोर्ट')}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      {activePatient.reports?.length || 0} {t('available', 'उपलब्ध')}
                    </span>
                  </div>

                  {activePatient.reports && activePatient.reports.length > 0 ? (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                      {activePatient.reports.map((rep) => (
                        <div
                          key={rep.id}
                          className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition shadow-2xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {rep.filename || `LFT_Report_${activePatient.portal_id || activePatient.id}.pdf`}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{rep.uploaded_at ? formatDateLocalized(rep.uploaded_at, isHindi) : t('Recently uploaded', 'हाल ही में अपलोड किया गया')}</span>
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              {t('Official PDF', 'आधिकारिक पीडीएफ')}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewPdf(rep)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1877F2] text-white hover:bg-blue-600 transition shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('View PDF', 'पीडीएफ देखें')}</span>
                            </button>
                            <a
                              href={api.reports.getDownloadUrl(rep.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{t('Download', 'डाउनलोड')}</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">{t('No PDF reports uploaded yet', 'अभी तक कोई पीडीएफ रिपोर्ट अपलोड नहीं की गई है')}</p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                        {t(
                          'When the laboratory technician uploads an official diagnostic report for this patient, it will appear here for your clinical review.',
                          'जब प्रयोगशाला तकनीशियन इस रोगी के लिए आधिकारिक रिपोर्ट अपलोड करेगा, तो वह आपकी समीक्षा के लिए यहां दिखाई देगी।'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Prescription Panel */}
              {activeTab === 'prescription' && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  {/* Previous Prescriptions History */}
                  {patientPrescriptions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {t('Active Prescriptions', 'सक्रिय दवाइयां')} ({patientPrescriptions.length})
                        </h4>
                      </div>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                        {patientPrescriptions.map((rx) => (
                          <div
                            key={rx.id}
                            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{rx.medicine}</p>
                              <p className="text-[11px] text-slate-600 mt-0.5">{rx.dosage}</p>
                              {rx.clinical_notes && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5">{rx.clinical_notes}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {rx.created_at ? formatDateLocalized(rx.created_at, isHindi) : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Write Prescription Form */}
                  <form onSubmit={handleSavePrescription} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {t('Write Prescription', 'दवा का पर्चा लिखें')}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddMedicineRow}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:text-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('Add Another Medicine', 'एक और दवा जोड़ें')}</span>
                      </button>
                    </div>

                    {/* Multi-Medicine Rows */}
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {medicineRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600">
                              {t('Medicine #', 'दवा #')}{idx + 1}
                            </span>
                            {medicineRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicineRow(idx)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded cursor-pointer"
                                title={t('Remove medicine', 'दवा हटाएं')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                {t('Medicine Name *', 'दवा का नाम *')}
                              </label>
                              <input
                                type="text"
                                placeholder={isHindi ? 'उदा. उर्सोडेऑक्सीकोलिक एसिड' : 'e.g. Ursodeoxycholic Acid'}
                                value={row.name}
                                onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                {t('Dose', 'मात्रा / खुराक')}
                              </label>
                              <input
                                type="text"
                                placeholder={isHindi ? 'उदा. 300mg' : 'e.g. 300mg'}
                                value={row.dose}
                                onChange={(e) => handleMedicineChange(idx, 'dose', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                {t('Frequency', 'आवृत्ति')}
                              </label>
                              <input
                                type="text"
                                placeholder={isHindi ? 'उदा. दिन में दो बार' : 'e.g. Twice daily'}
                                value={row.frequency}
                                onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                {t('Duration', 'अवधि')}
                              </label>
                              <input
                                type="text"
                                placeholder={isHindi ? 'उदा. 30 दिन' : 'e.g. 30 days'}
                                value={row.duration}
                                onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                              {t('Instructions', 'निर्देश')}
                            </label>
                            <input
                              type="text"
                              placeholder={isHindi ? 'उदा. भोजन के बाद पानी के साथ लें' : 'e.g. Take with water after meals'}
                              value={row.instructions}
                              onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* General Clinical Note */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                        {t('Clinical Remarks / Notes (Optional)', 'नैदानिक टिप्पणियां / नोट्स (वैकल्पिक)')}
                      </label>
                      <textarea
                        rows={2}
                        placeholder={isHindi ? 'मरीज़ के चार्ट के लिए अतिरिक्त नोट्स...' : 'Additional notes for patient chart...'}
                        value={prescriptionNotes}
                        onChange={(e) => setPrescriptionNotes(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingRx}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingRx ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{t('Saving Prescription...', 'पर्चा सहेजा जा रहा है...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('Save Prescription', 'पर्चा सहेजें')}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Tab 4: Diet & Care Instructions Panel */}
              {activeTab === 'diet_care' && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <form onSubmit={handleSaveAdvice} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {t("Doctor's Diet Plan & Care Advice", 'डॉक्टर का आहार चार्ट एवं देखभाल सलाह')}
                      </h4>
                    </div>

                    {/* Section: Diet Plan */}
                    <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-2">
                      <p className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                        <span>🥗</span> {t('Diet Plan', 'आहार योजना (डाइट प्लान)')}
                      </p>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Foods Recommended', 'अनुशंसित खाद्य पदार्थ')}
                        </label>
                        <textarea
                          rows={2}
                          placeholder={isHindi ? 'उदा. उच्च फाइबर युक्त भोजन, हरी सब्जियां, दालें, भरपूर पानी...' : 'e.g. High fiber foods, green vegetables, lean protein, plenty of water...'}
                          value={recommendedFoods}
                          onChange={(e) => setRecommendedFoods(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Foods to Avoid or Limit', 'परहेज योग्य खाद्य पदार्थ')}
                        </label>
                        <textarea
                          rows={2}
                          placeholder={isHindi ? 'उदा. शराब का पूरी तरह से परहेज, कम नमक (<2 ग्राम/दिन), तला-भुना भोजन न करें...' : 'e.g. Strictly zero alcohol, low sodium diet (<2g/day), avoid fatty/oily fried items...'}
                          value={avoidFoods}
                          onChange={(e) => setAvoidFoods(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Meal-Related Instructions', 'भोजन संबंधी निर्देश')}
                        </label>
                        <input
                          type="text"
                          placeholder={isHindi ? 'उदा. दिन में 4-5 बार थोड़ा-थोड़ा खाएं। सुबह का नाश्ता न छोड़ें।' : 'e.g. Small, frequent meals (4-5 per day). Do not skip breakfast.'}
                          value={mealInstructions}
                          onChange={(e) => setMealInstructions(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Section: Rest & Care Instructions */}
                    <div className="p-3 rounded-xl border border-sky-200/80 bg-sky-50/30 space-y-2">
                      <p className="text-xs font-extrabold text-sky-900 flex items-center gap-1.5">
                        <span>🛌</span> {t('Rest & Care Instructions', 'विश्राम एवं देखभाल निर्देश')}
                      </p>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Rest & Physical Activity', 'विश्राम एवं शारीरिक गतिविधि')}
                        </label>
                        <textarea
                          rows={2}
                          placeholder={isHindi ? 'उदा. रोजाना 20 मिनट टहलें। भारी वजन उठाने और अत्यधिक थकान से बचें। 8 घंटे की पर्याप्त नींद लें।' : 'e.g. Moderate walking 20 minutes daily. Avoid heavy lifting and extreme fatigue. Adequate 8 hours sleep.'}
                          value={restActivity}
                          onChange={(e) => setRestActivity(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Additional Clinical Warning / Instructions', 'अतिरिक्त नैदानिक चेतावनियां / निर्देश')}
                        </label>
                        <input
                          type="text"
                          placeholder={isHindi ? 'उदा. पेट की सूजन पर नजर रखें। पीलिया या भ्रम की स्थिति में तुरंत डॉक्टर से संपर्क करें।' : 'e.g. Monitor abdominal swelling daily. Report jaundice or confusion immediately.'}
                          value={additionalCare}
                          onChange={(e) => setAdditionalCare(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          {t('Next Follow-up Consultation Date', 'अगली फॉलो-अप परामर्श तिथि')}
                        </label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingAdvice}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAdvice ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{t('Saving Care Advice...', 'सलाह सहेजी जा रही है...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('Save Advice', 'सलाह सहेजें')}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Tab 5: Patient Appointments Panel */}
              {activeTab === 'appointments' && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {t('Patient Consultations & Appointments', 'रोगी परामर्श एवं अपॉइंटमेंट')}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {t('Appointments requested by or scheduled for ', 'परामर्श अनुरोध एवं निर्धारित अपॉइंटमेंट: ')}{activePatient.full_name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => activePatient && loadAppointmentsForPatient(activePatient.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title={t('Refresh appointments', 'अपॉइंटमेंट रीफ़्रेश करें')}
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoadingAppointments && "animate-spin")} />
                    </button>
                  </div>

                  {isLoadingAppointments ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1877F2]" />
                      <p>{t('Loading patient appointments...', 'मरीज़ के अपॉइंटमेंट लोड हो रहे हैं...')}</p>
                    </div>
                  ) : patientAppointments.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-xs text-slate-700">{t('No appointments scheduled', 'कोई अपॉइंटमेंट निर्धारित नहीं है')}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t(
                          'When the patient books a consultation or follow-up, it will appear here for your review and confirmation.',
                          'जब रोगी परामर्श या फॉलो-अप बुक करेगा, तो वह समीक्षा और पुष्टि के लिए यहां दिखाई देगा।'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                      {patientAppointments.map((appnt) => {
                        const isPending = appnt.status === 'Pending';
                        const isConfirmed = appnt.status === 'Confirmed';
                        const isRescheduled = appnt.status === 'Rescheduled' || appnt.status === 'Reschedule Requested';
                        const isCompleted = appnt.status === 'Completed';
                        const isCancelled = appnt.status === 'Cancelled' || appnt.status === 'Rejected';

                        return (
                          <div
                            key={appnt.id}
                            className={cn(
                              'p-3.5 rounded-xl border transition shadow-2xs space-y-2.5',
                              isPending
                                ? 'bg-amber-50/40 border-amber-200/80'
                                : isConfirmed
                                ? 'bg-white border-blue-200/80'
                                : 'bg-slate-50/60 border-slate-200/80'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-[#1877F2]">
                                    {appnt.appointment_type === 'Follow-up'
                                      ? (isHindi ? 'फॉलो-अप' : 'Follow-up')
                                      : (isHindi ? 'परामर्श' : 'Consultation')}
                                  </span>
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                      isPending && 'bg-amber-100 text-amber-800 border-amber-200',
                                      isConfirmed && 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                      isRescheduled && 'bg-sky-100 text-sky-800 border-sky-200',
                                      isCompleted && 'bg-slate-100 text-slate-700 border-slate-200',
                                      isCancelled && 'bg-rose-100 text-rose-800 border-rose-200'
                                    )}
                                  >
                                    {getAppointmentStatusText(appnt.status, isHindi)}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>
                                    {appnt.scheduled_at
                                      ? formatDateLocalized(appnt.scheduled_at, isHindi)
                                      : t('Date TBD', 'तिथि अनिर्धारित')}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-200/60 space-y-1">
                              <p className="text-[11px]">
                                <strong className="text-slate-800">{t('Reason / Notes:', 'कारण / नोट्स:')}</strong>{' '}
                                {getAppointmentReasonText(appnt.reason, isHindi)}
                              </p>
                              {appnt.doctor_notes && (
                                <p className="text-[11px] text-blue-900">
                                  <strong className="text-blue-800">{t('Doctor Note:', 'डॉक्टर नोट:')}</strong> {appnt.doctor_notes}
                                </p>
                              )}
                            </div>

                            {/* Actions for Doctor */}
                            {!isCompleted && !isCancelled && (
                              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-1.5 flex-wrap">
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => openAppointmentAction(appnt, 'Confirm')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" /> {t('Confirm', 'पुष्टि करें')}
                                  </button>
                                )}
                                {(isPending || isConfirmed) && (
                                  <button
                                    type="button"
                                    onClick={() => openAppointmentAction(appnt, 'Rescheduled')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Calendar className="w-3 h-3" /> {t('Reschedule', 'पुनर्निर्धारित करें')}
                                  </button>
                                )}
                                {isConfirmed && (
                                  <button
                                    type="button"
                                    onClick={() => openAppointmentAction(appnt, 'Completed')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#1877F2] hover:bg-blue-600 text-white transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> {t('Mark Completed', 'पूर्ण चिह्नित करें')}
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => openAppointmentAction(appnt, 'Rejected')}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <XCircle className="w-3 h-3" /> {t('Reject', 'अस्वीकार करें')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">{t('No patient selected', 'कोई रोगी चयनित नहीं है')}</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                {t(
                  'Select any patient from the table on the left to review laboratory results, PDF reports, or prescribe treatment.',
                  'प्रयोगशाला परिणाम, पीडीएफ रिपोर्ट देखने या उपचार लिखने के लिए बाईं ओर की तालिका से किसी भी रोगी का चयन करें।'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {viewingReport && (
        <Modal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            setViewingReport(null);
          }}
          title={
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-slate-900">
                {t('Diagnostic PDF Report: ', 'डायग्नोस्टिक पीडीएफ रिपोर्ट: ')}{viewingReport.filename || `Report #${viewingReport.id}`}
              </span>
            </div>
          }
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500">
                {t('Uploaded: ', 'अपलोड किया गया: ')}{viewingReport.uploaded_at ? formatDateLocalized(viewingReport.uploaded_at, isHindi) : 'N/A'}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={api.reports.getDownloadUrl(viewingReport.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('Download File', 'फ़ाइल डाउनलोड करें')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPdfModalOpen(false);
                    setViewingReport(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {t('Close', 'बंद करें')}
                </button>
              </div>
            </div>
          }
        >
          <div className="w-full h-[65vh] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
            {isLoadingPdf ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin mb-3" />
                <p className="text-xs font-semibold text-slate-700">{t('Verifying and loading PDF document...', 'पीडीएफ दस्तावेज़ सत्यापित और लोड किया जा रहा है...')}</p>
                <p className="text-[11px] text-slate-400 mt-1">{t('Checking digital signature and structure integrity', 'डिजिटल हस्ताक्षर एवं संरचना की जांच की जा रही है')}</p>
              </div>
            ) : pdfProbeError ? (
              <div className="p-6 m-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 max-w-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">{t('Diagnostic PDF Preview Notice', 'डायग्नोस्टिक पीडीएफ पूर्वावलोकन सूचना')}</h5>
                    <p className="mt-1 text-slate-700 leading-relaxed font-medium">
                      {pdfProbeError}
                    </p>
                    <div className="mt-3.5 p-2.5 bg-white/80 rounded-lg border border-amber-200/60 text-[11px] text-slate-600 space-y-1">
                      <p>• <strong>{t('Patient Record Status:', 'रोगी रिकॉर्ड स्थिति:')}</strong> {t('Preserved intact in database.', 'डेटाबेस में सुरक्षित रूप से संरक्षित है।')}</p>
                      <p>• <strong>{t('Action Required:', 'आवश्यक कार्रवाई:')}</strong> {t('The file on disk was corrupted or incomplete. Please notify the Lab Technician to upload the replacement diagnostic PDF.', 'डिस्क पर फ़ाइल क्षतिग्रस्त या अधूरी थी। कृपया प्रयोगशाला तकनीशियन को नई पीडीएफ रिपोर्ट अपलोड करने के लिए सूचित करें।')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title="Diagnostic PDF Report Viewer"
                className="w-full h-full border-0"
              />
            ) : (
              <p className="text-xs text-slate-400">{t('No report file available to preview.', 'पूर्वावलोकन के लिए कोई रिपोर्ट फ़ाइल उपलब्ध नहीं है।')}</p>
            )}
          </div>
        </Modal>
      )}

      {/* Appointment Action Modal (Confirm / Reschedule / Reject / Complete) */}
      {actionModalOpen && selectedAppnt && actionType && (
        <Modal
          isOpen={actionModalOpen}
          onClose={() => {
            setActionModalOpen(false);
            setSelectedAppnt(null);
            setActionType(null);
          }}
          title={
            actionType === 'Confirm'
              ? t('Confirm Patient Appointment', 'मरीज़ के अपॉइंटमेंट की पुष्टि करें')
              : actionType === 'Rescheduled'
              ? t('Reschedule Appointment Slot', 'अपॉइंटमेंट स्लॉट पुनर्निर्धारित करें')
              : actionType === 'Rejected'
              ? t('Reject Appointment Request', 'अपॉइंटमेंट अनुरोध अस्वीकार करें')
              : t('Complete Consultation', 'परामर्श पूर्ण करें')
          }
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setActionModalOpen(false);
                  setSelectedAppnt(null);
                  setActionType(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                {t('Cancel', 'रद्द करें')}
              </button>
              <button
                type="button"
                onClick={handleExecuteAppointmentAction}
                disabled={isSubmittingAction}
                className={cn(
                  'px-4 py-2 rounded-xl text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50',
                  actionType === 'Rejected'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : actionType === 'Confirm'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#1877F2] hover:bg-blue-600'
                )}
              >
                {isSubmittingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Saving...', 'सहेजा जा रहा है...')}</span>
                  </>
                ) : (
                  <span>
                    {actionType === 'Confirm'
                      ? t('Confirm Slot', 'स्लॉट की पुष्टि करें')
                      : actionType === 'Rescheduled'
                      ? t('Save Reschedule', 'पुनर्निर्धारण सहेजें')
                      : actionType === 'Rejected'
                      ? t('Confirm Rejection', 'अस्वीकृति की पुष्टि करें')
                      : t('Mark Completed', 'पूर्ण चिह्नित करें')}
                  </span>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <p>
                <strong className="text-slate-800">{t('Patient:', 'रोगी:')}</strong> {activePatient?.full_name} ({activePatient?.portal_id})
              </p>
              <p>
                <strong className="text-slate-800">{t('Type:', 'प्रकार:')}</strong> {selectedAppnt.appointment_type === 'Follow-up' ? (isHindi ? 'फॉलो-अप' : 'Follow-up') : (isHindi ? 'परामर्श' : 'Consultation')}
              </p>
              <p>
                <strong className="text-slate-800">{t('Current Slot:', 'वर्तमान समय:')}</strong>{' '}
                {selectedAppnt.scheduled_at
                  ? formatDateLocalized(selectedAppnt.scheduled_at, isHindi)
                  : t('Not set', 'निर्धारित नहीं')}
              </p>
              {selectedAppnt.reason && (
                <p>
                  <strong className="text-slate-800">{t('Patient Reason:', 'रोगी का कारण:')}</strong> {getAppointmentReasonText(selectedAppnt.reason, isHindi)}
                </p>
              )}
            </div>

            {actionType === 'Rescheduled' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Proposed New Date & Time', 'प्रस्तावित नई तिथि और समय')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {actionType === 'Rejected' ? (
                  <>
                    {t('Rejection Reason', 'अस्वीकृति का कारण')} <span className="text-rose-500">*</span>
                  </>
                ) : actionType === 'Rescheduled' ? (
                  t('Message / Note for Patient', 'मरीज़ के लिए संदेश / नोट')
                ) : (
                  t('Doctor Notes (Optional)', 'डॉक्टर नोट्स (वैकल्पिक)')
                )}
              </label>
              <textarea
                rows={3}
                placeholder={
                  actionType === 'Rejected'
                    ? (isHindi ? 'उदा. डॉक्टर इस स्लॉट में उपलब्ध नहीं हैं। कृपया दूसरी तारीख या समय चुनें।' : 'e.g. Clinician unavailable during this slot. Please choose another date or clinic hour.')
                    : actionType === 'Rescheduled'
                    ? (isHindi ? 'उदा. आपातकालीन मामले के कारण समय बदला गया। कृपया 10 मिनट पहले पहुंचें।' : 'e.g. Slot moved to accommodate urgent case. Please arrive 10 minutes early.')
                    : (isHindi ? 'उदा. परामर्श पूर्ण; रोगी निर्धारित दवाओं पर स्थिर है।' : 'e.g. Consultation complete; patient stable on prescribed medications.')
                }
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Treatment Completed */}
      {isCompletionConfirmOpen && activePatient && (
        <Modal
          isOpen={isCompletionConfirmOpen}
          onClose={() => {
            setIsCompletionConfirmOpen(false);
            setSelectedTreatmentStatus(activePatient.treatment_status || 'Awaiting Doctor Review');
          }}
          title={t('Confirm Treatment Completion', 'उपचार पूर्णता की पुष्टि करें')}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCompletionConfirmOpen(false);
                  setSelectedTreatmentStatus(activePatient.treatment_status || 'Awaiting Doctor Review');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {t('Cancel', 'रद्द करें')}
              </button>
              <button
                type="button"
                onClick={() => handleSaveTreatmentStatus('Treatment Completed', completionNotes)}
                disabled={isSavingStatus}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('Saving...', 'सहेजा जा रहा है...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('Confirm & Save Status', 'पुष्टि करें और स्थिति सहेजें')}</span>
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-950">
                  {t('Confirm Treatment Outcome for ', 'उपचार परिणाम की पुष्टि करें: ')}{activePatient.full_name} ({activePatient.portal_id || `CC-${activePatient.id}`})
                </p>
                <p className="text-emerald-800 mt-1">
                  {t(
                    "Marking the treatment as Treatment Completed indicates the patient's clinical regimen has finished and treatment goals were achieved. Please confirm before proceeding.",
                    'उपचार को "उपचार पूर्ण" के रूप में चिह्नित करना दर्शाता है कि रोगी का नैदानिक आहार समाप्त हो गया है और उपचार लक्ष्य हासिल कर लिए गए हैं। कृपया आगे बढ़ने से पहले पुष्टि करें।'
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {t('Completion Notes / Clinical Summary (Optional)', 'समाप्ति नोट्स / नैदानिक सारांश (वैकल्पिक)')}
              </label>
              <textarea
                rows={3}
                placeholder={isHindi ? 'उदा. बायोमार्कर सामान्य हो गए हैं; मरीज़ को स्वस्थ जीवनशैली सलाह के साथ छुट्टी दी गई।' : 'e.g. Biomarkers normalized; patient discharged with lifestyle maintenance advice.'}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
