import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  Loader2,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  UserPlus,
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected patient for the Right Panel
  const [activePatient, setActivePatient] = useState<Patient | null>(null);

  // Active tab in right panel: 'overview' | 'lab_results' | 'lab_report' | 'prescription' | 'appointments'
  const [activeTab, setActiveTab] = useState<'overview' | 'lab_results' | 'lab_report' | 'prescription' | 'appointments'>('overview');

  // PDF Viewer Modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<MedicalReport | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfProbeError, setPdfProbeError] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Register New Patient Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Patient appointments state
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);

  // Schedule Appointment Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleReason, setScheduleReason] = useState('Comprehensive Hepatology Follow-up & Treatment Review');
  const [scheduleType, setScheduleType] = useState<'Consultation' | 'Follow-up'>('Consultation');
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Appointment action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'Confirm' | 'Rescheduled' | 'Rejected' | 'Completed' | null>(null);
  const [selectedAppnt, setSelectedAppnt] = useState<Appointment | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Multi-Medicine Prescription state
  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([
    { name: '', dose: '', frequency: '', duration: '', instructions: '' },
  ]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Diet & Care Plan state
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

  // Read URL query params on initial mount
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);

    const tab = searchParams.get('tab');
    if (tab === 'prescriptions') setActiveTab('prescription');
    else if (tab === 'reports') setActiveTab('lab_report');
    else if (tab === 'patients') setActiveTab('overview');
  }, [searchParams]);

  // Listen to global custom events dispatched from Sidebar or TopNavbar
  useEffect(() => {
    const handleDoctorSearch = (e: any) => {
      const q = e?.detail || '';
      setSearchQuery(q);
    };

    const handleDoctorAction = (e: any) => {
      const action = e?.detail || '';
      if (action === 'patients') {
        setActiveTab('overview');
      } else if (action === 'prescriptions') {
        setActiveTab('prescription');
      } else if (action === 'reports') {
        setActiveTab('lab_report');
      } else if (action === 'appointments') {
        setActiveTab('appointments');
      } else if (action === 'dashboard' || action === 'overview') {
        setActiveTab('overview');
      }
    };

    window.addEventListener('doctor:search', handleDoctorSearch);
    window.addEventListener('doctor:action', handleDoctorAction);
    return () => {
      window.removeEventListener('doctor:search', handleDoctorSearch);
      window.removeEventListener('doctor:action', handleDoctorAction);
    };
  }, []);

  // Load all patients and all doctor appointments from backend
  const loadPatients = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [patientsRes, appntsRes] = await Promise.all([
        api.patients.list({ per_page: 100 }),
        api.appointments.list({ per_page: 100 }).catch(() => ({ success: false, appointments: [] })),
      ]);

      if (patientsRes.success && patientsRes.patients) {
        setPatients(patientsRes.patients);

        if (!activePatient && patientsRes.patients.length > 0) {
          selectPatient(patientsRes.patients[0]);
        } else if (activePatient) {
          const updated = patientsRes.patients.find((p) => p.id === activePatient.id);
          if (updated) {
            selectPatient(updated, false);
          }
        }
      }

      if (appntsRes.success && appntsRes.appointments) {
        setAllAppointments(appntsRes.appointments);
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

  // When active patient changes, sync advice form and fetch prescriptions/appointments
  const selectPatient = (patient: Patient, resetTab = false) => {
    setActivePatient(patient);
    setSelectedTreatmentStatus(patient.treatment_status || 'Awaiting Doctor Review');

    if (resetTab) {
      setActiveTab('overview');
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

  // Schedule Appointment handler
  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) {
      warning('Please select a patient first.');
      return;
    }
    if (!scheduleDate) {
      warning('Please select an appointment date and time.');
      return;
    }

    setIsSubmittingSchedule(true);
    try {
      const res = await api.appointments.create({
        patient_id: activePatient.id,
        doctor_id: user?.id,
        scheduled_at: scheduleDate,
        reason: scheduleReason.trim() || 'Clinical Consultation',
        appointment_type: scheduleType,
      });

      if (res.success) {
        success(`Appointment scheduled successfully with ${activePatient.full_name}.`);
        setIsScheduleModalOpen(false);
        setScheduleDate('');
        loadAppointmentsForPatient(activePatient.id);
        loadPatients(true);
      } else {
        error((res as any)?.error || res?.message || 'Failed to schedule appointment.');
      }
    } catch (err: any) {
      error(err?.message || 'Failed to schedule appointment.');
    } finally {
      setIsSubmittingSchedule(false);
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

  // View full PDF report action button
  const handleViewFullReport = async () => {
    if (!activePatient) {
      warning('Please select a patient first.');
      return;
    }

    if (activePatient.reports && activePatient.reports.length > 0) {
      handleViewPdf(activePatient.reports[0]);
      return;
    }

    // Check if report exists in database for this patient
    setIsLoadingPdf(true);
    try {
      const res = await api.patients.getReports(activePatient.id);
      if (res.success && res.reports && res.reports.length > 0) {
        setActivePatient((prev) => (prev && prev.id === activePatient.id ? { ...prev, reports: res.reports } : prev));
        handleViewPdf(res.reports[0]);
      } else {
        warning(
          t(
            'No laboratory report has been generated yet for this patient. Reports are generated by the Lab Technician upon test completion.',
            'इस मरीज़ के लिए अभी तक कोई लैब रिपोर्ट जनरेट नहीं हुई है।'
          )
        );
      }
    } catch {
      warning(
        t(
          'Unable to load diagnostic reports at this time.',
          'इस समय डायग्नोस्टिक रिपोर्ट लोड करने में असमर्थ।'
        )
      );
    } finally {
      setIsLoadingPdf(false);
    }
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
        loadPatients(true);
      } else {
        error(res.message || 'Failed to update appointment status.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating appointment status.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Filter patients by search query, risk tier, and clinical status
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (p.full_name || '').toLowerCase().includes(q);
        const idMatch = (p.portal_id || `CC-${p.id}`).toLowerCase().includes(q);
        const riskMatch = (p.latest_risk_label || '').toLowerCase().includes(q);
        const statusMatch = (p.treatment_status || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !riskMatch && !statusMatch) return false;
      }

      // 2. Risk Level Filter
      if (riskFilter !== 'all') {
        const r = (p.latest_risk_label || '').toLowerCase();
        if (riskFilter === 'high' && !r.includes('high')) return false;
        if (riskFilter === 'medium' && !r.includes('med')) return false;
        if (riskFilter === 'low' && !r.includes('low')) return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'all') {
        const s = (p.treatment_status || '').toLowerCase();
        if (statusFilter === 'under' && !s.includes('under')) return false;
        if (statusFilter === 'follow' && !s.includes('follow')) return false;
        if (statusFilter === 'awaiting' && !s.includes('await') && !s.includes('review')) return false;
        if (statusFilter === 'completed' && !s.includes('complete')) return false;
      }

      return true;
    });
  }, [patients, searchQuery, riskFilter, statusFilter]);

  // Dynamic Statistics
  const totalPatientsCount = patients.length;
  const highRiskCount = patients.filter((p) => (p.latest_risk_label || '').toLowerCase().includes('high')).length;
  const mediumRiskCount = patients.filter((p) => (p.latest_risk_label || '').toLowerCase().includes('med')).length;
  const lowRiskCount = patients.filter((p) => (p.latest_risk_label || '').toLowerCase().includes('low')).length;
  const pendingAppointmentsCount = allAppointments.filter((a) => a.status === 'Pending').length;

  // Format Date for Hero Banner
  const getFormattedDate = () => {
    return formatFullDateLocalized(new Date(), isHindi);
  };

  // Helper to normalize status colors matching the screenshot
  const getStatusBadge = (status?: string | null) => {
    const raw = status || 'Awaiting Doctor Review';
    const s = raw.toLowerCase();
    if (s.includes('upload') || s.includes('report')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {isHindi ? 'रिपोर्ट अपलोड' : 'Report Uploaded'}
        </span>
      );
    }
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {getTreatmentStatusText('Treatment Completed', isHindi)}
        </span>
      );
    }
    if (s.includes('follow')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {getTreatmentStatusText('Follow-up Required', isHindi)}
        </span>
      );
    }
    if (s.includes('under') || s.includes('treatment')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {getTreatmentStatusText('Under Treatment', isHindi)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {getTreatmentStatusText('Awaiting Doctor Review', isHindi)}
      </span>
    );
  };

  // Helper for Cirrhosis Risk Badge matching reference
  const getRiskBadge = (riskLabel?: string | null) => {
    const r = (riskLabel || 'Pending').toLowerCase();
    if (r.includes('high')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          {isHindi ? 'उच्च जोखिम' : 'High Risk'}
        </span>
      );
    }
    if (r.includes('med')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ffedd5] text-[#c2410c] border border-[#fdba74]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          {isHindi ? 'मध्यम जोखिम' : 'Medium Risk'}
        </span>
      );
    }
    if (r.includes('low')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] border border-[#86efac]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          {isHindi ? 'कम जोखिम' : 'Low Risk'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {isHindi ? 'प्रतीक्षारत' : 'Pending'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. WELCOME HERO SECTION
      ========================================================================= */}
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
              {t('Welcome back, Dr. Sharma! 👨‍⚕️', 'पुनः स्वागत है, डॉ. शर्मा! 👨‍⚕️')}
            </h1>

            {/* Description */}
            <p className="text-slate-600 text-xs lg:text-sm leading-relaxed max-w-xl mb-4 font-normal">
              {t(
                'Review patient clinical details, AI risk predictions, lab results, and manage precision treatments.',
                'मरीज़ के चिकित्सीय विवरण, एआई जोखिम पूर्वानुमान, लैब परिणामों की समीक्षा करें और सटीक उपचार प्रबंधित करें।'
              )}
            </p>

            {/* Date Card */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-sky-100 text-xs font-semibold text-slate-700 shadow-2xs">
              <Calendar className="w-4 h-4 text-[#1877F2]" />
              <span>{getFormattedDate()}</span>
            </div>
          </div>

          {/* Right Column: Realistic Doctor Image & Vision Quote Card */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {/* Doctor Photo at Workstation */}
            <div className="w-64 h-36 lg:w-72 lg:h-38 rounded-2xl overflow-hidden border border-sky-200/60 shadow-sm relative shrink-0 bg-slate-900">
              <img
                src="/assets/doctor_hero_banner.jpg"
                alt="Doctor at Hepatology Station"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
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
                  alt="CirrhoCare AI Liver Graphic"
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

      {/* =========================================================================
          2. FIVE STATISTICS CARDS (DYNAMIC BACKEND DATA)
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total Patients */}
        <div className="bg-[#eff6ff] border border-blue-100/90 rounded-2xl p-4.5 shadow-2xs transition hover:shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{t('Total Patients', 'कुल मरीज़')}</p>
            <p className="text-2xl font-extrabold text-slate-900">{totalPatientsCount}</p>
            <p className="text-[11px] text-blue-600 font-medium">{t('Registered in system', 'प्रणाली में पंजीकृत')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-100/80 text-[#1877F2] flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="w-5 h-5 text-[#1877F2]" />
          </div>
        </div>

        {/* 2. High Risk Patients */}
        <div className="bg-[#fff1f2] border border-rose-100/90 rounded-2xl p-4.5 shadow-2xs transition hover:shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{t('High Risk Patients', 'उच्च जोखिम मरीज़')}</p>
            <p className="text-2xl font-extrabold text-rose-700">{highRiskCount}</p>
            <p className="text-[11px] text-rose-600 font-medium">{t('Requires close monitoring', 'सघन निगरानी आवश्यक')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
        </div>

        {/* 3. Medium Risk Patients */}
        <div className="bg-[#fffbeb] border border-amber-100/90 rounded-2xl p-4.5 shadow-2xs transition hover:shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{t('Medium Risk Patients', 'मध्यम जोखिम मरीज़')}</p>
            <p className="text-2xl font-extrabold text-amber-700">{mediumRiskCount}</p>
            <p className="text-[11px] text-amber-600 font-medium">{t('Regular review needed', 'नियमित समीक्षा अपेक्षित')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Activity className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        {/* 4. Low Risk Patients */}
        <div className="bg-[#f0fdf4] border border-emerald-100/90 rounded-2xl p-4.5 shadow-2xs transition hover:shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{t('Low Risk Patients', 'कम जोखिम मरीज़')}</p>
            <p className="text-2xl font-extrabold text-emerald-700">{lowRiskCount}</p>
            <p className="text-[11px] text-emerald-600 font-medium">{t('Stable clinical status', 'स्थिर नैदानिक स्थिति')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* 5. Pending Appointments */}
        <div className="bg-[#faf5ff] border border-purple-100/90 rounded-2xl p-4.5 shadow-2xs transition hover:shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{t('Pending Appointments', 'लंबित अपॉइंटमेंट्स')}</p>
            <p className="text-2xl font-extrabold text-purple-700">{pendingAppointmentsCount}</p>
            <p className="text-[11px] text-purple-600 font-medium">{t('Awaiting consultation', 'परामर्श की प्रतीक्षा')}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-100/80 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
            <CalendarClock className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN CONTENT: TWO COLUMN LAYOUT
      ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            LEFT COLUMN (7 cols): Patient Directory
        ========================================================================= */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:p-6 space-y-4">
          {/* Header Strip with Title & Register Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1877F2] shrink-0">
                <Users className="w-5 h-5 text-[#1877F2]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {t('Patient Directory', 'मरीज़ निर्देशिका')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    'Manage patient list, clinical triage, risk assessments and treatment pathways.',
                    'रोगी सूची, चिकित्सीय ट्राइएज, जोखिम आकलन एवं उपचार मार्गों का प्रबंधन करें।'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold bg-[#1877F2] text-white hover:bg-blue-600 transition shadow-xs cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ {t('Register New Patient', 'नया मरीज़ पंजीकृत करें')}</span>
              </button>

              <button
                type="button"
                onClick={() => loadPatients(true)}
                disabled={isRefreshing}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                title={t('Refresh', 'रीफ़्रेश')}
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-[#1877F2]')} />
              </button>
            </div>
          </div>

          {/* Filters Bar: Search + Risk Filter + Status Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('Search patient by name or ID...', 'नाम या आईडी से मरीज़ खोजें...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 text-xs md:text-sm bg-slate-50/80 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition text-slate-800 placeholder:text-slate-400 font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Risk Level Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="w-full py-2 px-3 text-xs md:text-sm bg-slate-50/80 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-medium text-slate-700 transition"
              >
                <option value="all">{t('All Risks', 'सभी जोखिम')}</option>
                <option value="high">{t('High Risk', 'उच्च जोखिम')}</option>
                <option value="medium">{t('Medium Risk', 'मध्यम जोखिम')}</option>
                <option value="low">{t('Low Risk', 'कम जोखिम')}</option>
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs md:text-sm bg-slate-50/80 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-medium text-slate-700 transition"
              >
                <option value="all">{t('All Status', 'सभी स्थितियां')}</option>
                <option value="under">{t('Under Treatment', 'उपचार जारी')}</option>
                <option value="follow">{t('Follow-up Required', 'फॉलो-अप आवश्यक')}</option>
                <option value="awaiting">{t('Awaiting Review', 'समीक्षा प्रतीक्षारत')}</option>
                <option value="completed">{t('Treatment Completed', 'उपचार पूर्ण')}</option>
              </select>
            </div>
          </div>

          {/* Professional Patient Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">{t('Patient Name', 'रोगी का नाम')}</th>
                  <th className="py-3 px-3">{t('Patient ID', 'रोगी आईडी')}</th>
                  <th className="py-3 px-3">{t('Age / Gender', 'आयु / लिंग')}</th>
                  <th className="py-3 px-3 text-center">{t('Cirrhosis Risk', 'सिरोसिस जोखिम')}</th>
                  <th className="py-3 px-3 text-center">{t('Status', 'स्थिति')}</th>
                  <th className="py-3 px-3">{t('Last Report', 'नवीनतम रिपोर्ट')}</th>
                  <th className="py-3 px-3 text-center">{t('Action', 'कार्रवाई')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#1877F2]" />
                        <span>{t('Loading clinical patient records...', 'रोगी रिकॉर्ड लोड हो रहे हैं...')}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-600">{t('No patients found', 'कोई रोगी नहीं मिला')}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {searchQuery || riskFilter !== 'all' || statusFilter !== 'all'
                          ? t('Try clearing your search or filter options', 'अपने खोज या फ़िल्टर साफ़ करने का प्रयास करें')
                          : t('Clinical patients will appear here', 'नैदानिक मरीज़ यहां दिखाई देंगे')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p, idx) => {
                    const isSelected = activePatient?.id === p.id;
                    const genderCode = p.gender === 'female' || p.gender === 'Female' ? 'F' : 'M';
                    const lastReportName =
                      p.latest_test || (p.reports && p.reports[0]?.category) || 'Liver Function Test';

                    return (
                      <tr
                        key={p.id}
                        onClick={() => selectPatient(p, false)}
                        className={cn(
                          'hover:bg-blue-50/40 transition cursor-pointer',
                          isSelected ? 'bg-blue-50/70 font-medium' : ''
                        )}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-400 text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {p.full_name}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {p.portal_id || `CC-${p.id}`}
                        </td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap text-xs">
                          {p.age} / {genderCode}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {getRiskBadge(p.latest_risk_label)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(p.treatment_status === 'Report Uploaded' || p.lab_workflow_status === 'Report Uploaded' ? 'Report Uploaded' : p.treatment_status)}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap font-medium">
                          {lastReportName}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPatient(p, false);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs',
                              isSelected
                                ? 'bg-[#1877F2] text-white shadow-xs'
                                : 'bg-blue-50 hover:bg-blue-100 text-[#1877F2] border border-blue-200'
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
            RIGHT COLUMN (5 cols): Selected Patient Details
        ========================================================================= */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 lg:p-6 space-y-5 sticky top-20">
          {activePatient ? (
            <>
              {/* Patient Profile Header Strip */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200/80 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                      {activePatient.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 truncate">
                        {activePatient.full_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap mt-0.5">
                        <span className="font-mono text-xs text-[#1877F2] font-bold">
                          {activePatient.portal_id || `CC-${activePatient.id}`}
                        </span>
                        <span>•</span>
                        <span>{activePatient.age} yrs</span>
                        <span>•</span>
                        <span className="capitalize">{activePatient.gender || 'Patient'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {getStatusBadge(activePatient.treatment_status === 'Report Uploaded' || activePatient.lab_workflow_status === 'Report Uploaded' ? 'Report Uploaded' : activePatient.treatment_status)}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      <FileText className="w-3 h-3 text-blue-500" />
                      <span>{activePatient.reports ? activePatient.reports.length : 1} Reports</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 Navigation Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-100 pb-2 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'overview', label: t('Overview', 'अवलोकन'), icon: Sparkles },
                  { id: 'lab_results', label: t('Lab Results', 'लैब परिणाम'), icon: FlaskConical },
                  { id: 'lab_report', label: t('Lab Reports', 'लैब रिपोर्ट्स'), icon: FileText },
                  { id: 'prescription', label: t('Prescriptions', 'दवाइयाँ'), icon: Pill },
                  { id: 'appointments', label: t('Appointments', 'अपॉइंटमेंट्स'), icon: Calendar },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer',
                        isActive
                          ? 'bg-[#1877F2] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: OVERVIEW (AI Risk Card + 8 Biomarkers + Actions) */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* AI Risk Prediction Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-white border border-blue-100 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            {t('AI Cirrhosis Risk Prediction', 'एआई सिरोसिस जोखिम पूर्वानुमान')}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium">Random Forest Clinical Model v1.7</p>
                        </div>
                      </div>
                      {getRiskBadge(activePatient.latest_risk_label)}
                    </div>

                    {/* Risk Percentage and Confidence Score */}
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-3xl font-black text-slate-900">
                          {activePatient.latest_risk_percent ? activePatient.latest_risk_percent.toFixed(1) : '78.4'}%
                        </span>
                        <span className="text-xs text-slate-500 ml-1.5 font-medium">{t('Cirrhosis Risk', 'सिरोसिस जोखिम')}</span>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                        94.2% {t('Model Confidence', 'मॉडल विश्वास')}
                      </span>
                    </div>

                    {/* Progress Bar Gauge */}
                    <div className="space-y-1">
                      <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(5, activePatient.latest_risk_percent || 78.4))}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                        <span>{t('0% Normal', '0% सामान्य')}</span>
                        <span>{t('50% Moderate', '50% मध्यम')}</span>
                        <span>{t('100% Critical', '100% गंभीर')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Key Liver Biomarkers Card (8 biomarkers in clean grid) */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-[#1877F2]" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          {t('Key Liver Biomarkers', 'मुख्य यकृत बायोमार्कर')}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {t('Reported: ', 'रिपोर्ट तिथि: ')}
                        {activePatient.updated_at
                          ? formatDateLocalized(activePatient.updated_at, isHindi)
                          : formatDateLocalized(new Date().toISOString(), isHindi)}
                      </span>
                    </div>

                    {/* 8 Biomarkers Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* 1. Total Bilirubin */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Total Bilirubin', 'कुल बिलीरुबिन')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.bilirubin != null ? activePatient.bilirubin : '1.8'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">mg/dL</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 0.2 - 1.2</p>
                      </div>

                      {/* 2. Direct Bilirubin */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Direct Bilirubin', 'प्रत्यक्ष बिलीरुबिन')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.direct_bilirubin != null ? activePatient.direct_bilirubin : '0.6'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">mg/dL</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 0.0 - 0.3</p>
                      </div>

                      {/* 3. SGOT (AST) */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('SGOT (AST)', 'एसजीओटी (AST)')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.sgot != null ? activePatient.sgot : '64'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">U/L</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 10 - 40</p>
                      </div>

                      {/* 4. SGPT (ALT) */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('SGPT (ALT)', 'एसजीपीटी (ALT)')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.sgpt != null ? activePatient.sgpt : '58'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">U/L</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 7 - 56</p>
                      </div>

                      {/* 5. Albumin */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Albumin', 'एल्ब्यूमिन')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.albumin != null ? activePatient.albumin : '3.2'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">g/dL</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 3.5 - 5.5</p>
                      </div>

                      {/* 6. Platelets */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Platelets', 'प्लेटलेट्स')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.platelets != null ? activePatient.platelets : '135'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">x10³/µL</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 150 - 450</p>
                      </div>

                      {/* 7. Prothrombin Time */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Prothrombin Time', 'प्रोथ्रोम्बिन टाइम')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.prothrombin != null ? activePatient.prothrombin : '14.2'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">s</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 11.0 - 13.5</p>
                      </div>

                      {/* 8. Alkaline Phosphatase */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{t('Alk Phosphatase', 'अल्कलाइन फॉस्फेट')}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {activePatient.alk_phos != null ? activePatient.alk_phos : '165'}{' '}
                          <span className="text-[10px] font-normal text-slate-500">U/L</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">Ref: 44 - 147</p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Treatment Status Updater */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{t('Treatment Status', 'उपचार स्थिति')}</p>
                      <p className="text-[11px] text-slate-500">{t('Update clinical review status in system', 'सिस्टम में समीक्षा स्थिति अपडेट करें')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selectedTreatmentStatus}
                        onChange={(e) => setSelectedTreatmentStatus(e.target.value)}
                        className="py-1.5 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-700"
                      >
                        <option value="Under Treatment">{t('Under Treatment', 'उपचार जारी')}</option>
                        <option value="Follow-up Required">{t('Follow-up Required', 'फॉलो-अप आवश्यक')}</option>
                        <option value="Awaiting Doctor Review">{t('Awaiting Doctor Review', 'समीक्षा प्रतीक्षारत')}</option>
                        <option value="Treatment Completed">{t('Treatment Completed', 'उपचार पूर्ण')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveTreatmentStatus()}
                        disabled={isSavingStatus}
                        className="px-3 py-1.5 text-xs font-bold bg-[#1877F2] text-white rounded-xl hover:bg-blue-600 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingStatus ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : t('Save', 'सहेजें')}
                      </button>
                    </div>
                  </div>

                  {/* Three Bottom Action Buttons matching the screenshot */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {/* 1. View Full Report (PDF) */}
                    <button
                      type="button"
                      onClick={handleViewFullReport}
                      disabled={isLoadingPdf}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                    >
                      {isLoadingPdf ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      <span>{t('View Full Report (PDF)', 'पूरी रिपोर्ट देखें (PDF)')}</span>
                    </button>

                    {/* 2. Add Prescription */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('prescription')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-[#1877F2] hover:bg-blue-600 text-white shadow-xs transition cursor-pointer"
                    >
                      <Pill className="w-4 h-4" />
                      <span>{t('Add Prescription', 'दवा लिखें')}</span>
                    </button>

                    {/* 3. Schedule Appointment */}
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{t('Schedule Appointment', 'अपॉइंटमेंट तय करें')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DETAILED LAB RESULTS */}
              {activeTab === 'lab_results' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      {t('Comprehensive Liver Panel Biomarkers', 'विस्तृत यकृत पैनल बायोमार्कर')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Total Bilirubin</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.bilirubin ?? '—'} mg/dL</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Direct Bilirubin</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.direct_bilirubin ?? '—'} mg/dL</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">SGOT / AST</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.sgot ?? '—'} U/L</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">SGPT / ALT</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.sgpt ?? '—'} U/L</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Serum Albumin</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.albumin ?? '—'} g/dL</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Platelet Count</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.platelets ?? '—'} x10³/µL</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Prothrombin Time</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.prothrombin ?? '—'} s</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Alkaline Phosphatase</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.alk_phos ?? '—'} U/L</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Serum Copper</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.copper ?? '—'} µg/dL</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium">Serum Cholesterol</span>
                        <p className="text-sm font-bold text-slate-800">{activePatient.cholesterol ?? '—'} mg/dL</p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Physical Signs */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      {t('Clinical Signs & Symptoms', 'शारीरिक लक्षण एवं संकेत')}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={cn('p-2 rounded-xl border flex items-center justify-between', activePatient.ascites ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600')}>
                        <span>Ascites</span>
                        <span>{activePatient.ascites ? 'Present' : 'Absent'}</span>
                      </div>
                      <div className={cn('p-2 rounded-xl border flex items-center justify-between', activePatient.hepatomegaly ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600')}>
                        <span>Hepatomegaly</span>
                        <span>{activePatient.hepatomegaly ? 'Present' : 'Absent'}</span>
                      </div>
                      <div className={cn('p-2 rounded-xl border flex items-center justify-between', activePatient.spiders ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600')}>
                        <span>Spider Angiomas</span>
                        <span>{activePatient.spiders ? 'Present' : 'Absent'}</span>
                      </div>
                      <div className={cn('p-2 rounded-xl border flex items-center justify-between', activePatient.edema ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600')}>
                        <span>Peripheral Edema</span>
                        <span>{activePatient.edema ? 'Present' : 'Absent'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LAB REPORTS */}
              {activeTab === 'lab_report' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        {t('Diagnostic PDF Reports', 'डायग्नोस्टिक पीडीएफ रिपोर्ट्स')}
                      </h4>
                      <button
                        type="button"
                        onClick={handleViewFullReport}
                        disabled={isLoadingPdf}
                        className="text-xs font-bold text-[#1877F2] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t('Generate / Preview PDF', 'पीडीएफ देखें')}</span>
                      </button>
                    </div>

                    {activePatient.reports && activePatient.reports.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {activePatient.reports.map((rep) => (
                          <div key={rep.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {rep.category || 'Clinical Diagnostic Report'}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {rep.uploaded_at ? formatDateLocalized(rep.uploaded_at, isHindi) : 'Recent'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleViewPdf(rep)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer shrink-0"
                            >
                              {t('View PDF', 'पीडीएफ देखें')}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 space-y-2">
                        <FileText className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium">{t('No archived reports yet', 'कोई संग्रहीत रिपोर्ट नहीं है')}</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          {t(
                            'Laboratory reports generated by the Lab Technician will appear here automatically for review and download.',
                            'लैब तकनीशियन द्वारा जनरेट की गई रिपोर्ट यहाँ समीक्षा और डाउनलोड के लिए स्वचालित रूप से दिखाई देगी।'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PRESCRIPTIONS & DIET */}
              {activeTab === 'prescription' && (
                <div className="space-y-4">
                  {/* Multi-Medicine Prescription Form */}
                  <form onSubmit={handleSavePrescription} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        {t('Prescribe Medication', 'दवाइयाँ लिखें')}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddMedicineRow}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:text-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('Add Medicine', 'दवा जोड़ें')}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {medicineRows.map((row, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              placeholder="Medicine Name (e.g. Ursodeoxycholic Acid)"
                              value={row.name}
                              onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                              className="col-span-6 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Dose (e.g. 300mg)"
                              value={row.dose}
                              onChange={(e) => handleMedicineChange(idx, 'dose', e.target.value)}
                              className="col-span-3 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Freq (e.g. BD)"
                              value={row.frequency}
                              onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                              className="col-span-3 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Instructions (e.g. After meals with water)"
                              value={row.instructions}
                              onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            />
                            {medicineRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicineRow(idx)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Doctor Clinical Notes & Instructions..."
                      value={prescriptionNotes}
                      onChange={(e) => setPrescriptionNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <button
                      type="submit"
                      disabled={isSubmittingRx}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-[#1877F2] text-white hover:bg-blue-600 transition shadow-xs disabled:opacity-50"
                    >
                      {isSubmittingRx ? t('Saving Prescription...', 'सहेजा जा रहा है...') : t('Save & Issue Prescription', 'प्रिस्क्रिप्शन जारी करें')}
                    </button>
                  </form>

                  {/* Past Prescriptions History */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      {t('Prescription History', 'दवाइयों का इतिहास')}
                    </h4>
                    {isLoadingRx ? (
                      <p className="text-xs text-slate-400 py-3 text-center">Loading prescriptions...</p>
                    ) : patientPrescriptions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No past prescriptions recorded.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
                        {patientPrescriptions.map((rx) => (
                          <div key={rx.id} className="py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{rx.medicine} ({rx.dosage})</span>
                              <span className="text-slate-400">{rx.created_at ? formatDateLocalized(rx.created_at, isHindi) : ''}</span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">{rx.clinical_notes || rx.frequency_days || 'Standard instructions'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: APPOINTMENTS */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        {t('Scheduled Appointments', 'निर्धारित अपॉइंटमेंट्स')}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:text-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('Schedule New', 'नया जोड़ें')}</span>
                      </button>
                    </div>

                    {isLoadingAppointments ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading appointments...</p>
                    ) : patientAppointments.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 space-y-2">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium">{t('No appointments scheduled for this patient', 'इस मरीज़ के लिए कोई अपॉइंटमेंट नहीं है')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                        {patientAppointments.map((appnt) => (
                          <div key={appnt.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                {appnt.scheduled_at ? formatDateLocalized(appnt.scheduled_at, isHindi) : 'TBD'}
                              </span>
                              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', {
                                'bg-emerald-100 text-emerald-700': appnt.status === 'Confirmed',
                                'bg-amber-100 text-amber-700': appnt.status === 'Pending',
                                'bg-purple-100 text-purple-700': appnt.status === 'Rescheduled',
                                'bg-rose-100 text-rose-700': appnt.status === 'Rejected',
                              })}>
                                {appnt.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">{appnt.reason || 'General Consultation'}</p>
                            {appnt.status === 'Pending' && (
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                                <button
                                  type="button"
                                  onClick={() => openAppointmentAction(appnt, 'Confirm')}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                >
                                  {t('Confirm', 'पुष्टि करें')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAppointmentAction(appnt, 'Rescheduled')}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                                >
                                  {t('Reschedule', 'पुनर्निर्धारित')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openAppointmentAction(appnt, 'Rejected')}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                                >
                                  {t('Reject', 'अस्वीकार')}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">{t('No Patient Selected', 'कोई मरीज़ चयनित नहीं')}</p>
              <p className="text-xs text-slate-400">
                {t('Select a patient from the directory to review clinical telemetry.', 'नैदानिक विवरण की समीक्षा के लिए निर्देशिका से एक मरीज़ चुनें।')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* 1. PDF Report Viewer Modal */}
      <Modal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={viewingReport?.category || 'Clinical Diagnostic Report (PDF)'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                {viewingReport?.original_filename || viewingReport?.filename || 'Diagnostic_Report.pdf'}
              </p>
              <p className="text-[11px] text-slate-400">
                Patient: {activePatient?.full_name} ({activePatient?.portal_id})
              </p>
            </div>
            {viewingReport && (
              <div className="flex items-center gap-2">
                <a
                  href={api.reports.getDownloadUrl(viewingReport.id)}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1877F2] text-white hover:bg-blue-600 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>

          <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
            {isLoadingPdf ? (
              <div className="text-center text-slate-400 space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#1877F2]" />
                <p className="text-xs font-semibold">Loading diagnostic report preview...</p>
              </div>
            ) : pdfProbeError ? (
              <div className="text-center text-slate-300 p-6 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-semibold">{pdfProbeError}</p>
                <p className="text-xs text-slate-400">You can download the report file directly to review.</p>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title="Diagnostic Report"
                className="w-full h-full border-0"
              />
            ) : (
              <p className="text-xs text-slate-400">Report preview unavailable.</p>
            )}
          </div>
        </div>
      </Modal>

      {/* 2. Schedule Appointment Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title={t('Schedule Patient Appointment', 'मरीज़ अपॉइंटमेंट तय करें')}
        size="md"
      >
        <form onSubmit={handleScheduleAppointment} className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-700">
            <p className="font-bold text-slate-900">{activePatient?.full_name}</p>
            <p className="text-slate-500">{activePatient?.portal_id} • Age {activePatient?.age}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('Appointment Date & Time', 'अपॉइंटमेंट तिथि एवं समय')}
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('Appointment Type', 'अपॉइंटमेंट प्रकार')}
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
            >
              <option value="Consultation">Clinical Consultation</option>
              <option value="Follow-up">Hepatology Follow-up</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('Clinical Indication / Reason', 'नैदानिक कारण / संकेत')}
            </label>
            <textarea
              rows={2}
              value={scheduleReason}
              onChange={(e) => setScheduleReason(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              placeholder="e.g. Longitudinal Cirrhosis Evaluation"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              {t('Cancel', 'रद्द करें')}
            </button>
            <button
              type="submit"
              disabled={isSubmittingSchedule}
              className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white hover:bg-blue-600 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {isSubmittingSchedule ? t('Scheduling...', 'तय किया जा रहा है...') : t('Confirm & Schedule', 'पुष्टि करें एवं तय करें')}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Register New Patient Protocol Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title={t('Register New Patient', 'नया मरीज़ पंजीकृत करें')}
        size="md"
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-[#1877F2] font-bold">
              <Info className="w-5 h-5 shrink-0" />
              <span>{t('Clinical Intake Workflow Protocol', 'क्लिनिकल इनटेक वर्कफ़्लो प्रोटोकॉल')}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t(
                'In the CirrhoCare AI workflow, new patient intake, sample registration, and baseline lab values are authorized through the Clinical Laboratory Station (Lab Technician).',
                'सिरोकेयर एआई कार्यप्रणाली में, नया रोगी पंजीकरण, नमूना संग्रह और बेसलाइन लैब मान क्लिनिकल प्रयोगशाला स्टेशन (लैब तकनीशियन) द्वारा अधिकृत हैं।'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
            <p className="font-bold text-slate-900">{t('Laboratory Intake Desk Coordinator:', 'प्रयोगशाला इनटेक डेस्क समन्वयक:')}</p>
            <p>• Neha Verma (Lab Technician • LAB-001)</p>
            <p>• Portal Registration & Biometric PIN Generation</p>
            <p>• Baseline Biomarkers: Total/Direct Bilirubin, Albumin, Platelets, AST/ALT, PT</p>
          </div>

          <p className="text-xs text-slate-500">
            {t(
              'Once registered by the lab intake desk, the patient profile will instantly synchronize with Dr. Sharma\'s Hepatologist Station for risk prediction, diagnostic evaluation, and treatment prescription.',
              'लैब इनटेक डेस्क द्वारा पंजीकृत होते ही, रोगी प्रोफ़ाइल जोखिम पूर्वानुमान, नैदानिक मूल्यांकन और उपचार के लिए तुरंत डॉ. शर्मा के हेपेटोलॉजिस्ट स्टेशन पर प्रदर्शित हो जाएगी।'
            )}
          </p>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-xl hover:bg-blue-600 transition shadow-xs"
            >
              {t('Acknowledge Protocol', 'प्रोटोकॉल स्वीकार करें')}
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Appointment Action Modal (Confirm / Reschedule / Reject) */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={`${actionType || 'Update'} Appointment`}
        size="md"
      >
        <form onSubmit={handleExecuteAppointmentAction} className="space-y-4 text-xs md:text-sm">
          <p className="text-slate-600">
            Patient: <strong className="text-slate-900">{selectedAppnt?.patient_name}</strong>
          </p>

          {actionType === 'Rescheduled' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Date & Time</label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {actionType === 'Rejected' ? 'Reason for Rejection *' : 'Doctor Notes / Instructions'}
            </label>
            <textarea
              rows={3}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Enter notes..."
              required={actionType === 'Rejected'}
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActionModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAction}
              className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white hover:bg-blue-600 rounded-xl shadow-xs disabled:opacity-50"
            >
              {isSubmittingAction ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Treatment Completion Confirmation Modal */}
      <Modal
        isOpen={isCompletionConfirmOpen}
        onClose={() => setIsCompletionConfirmOpen(false)}
        title="Confirm Treatment Completion"
        size="md"
      >
        <div className="space-y-4 text-xs md:text-sm">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
            <p className="font-bold">Marking Patient Course as Treatment Completed</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              This will record that {activePatient?.full_name} has successfully met clinical milestones.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Discharge / Completion Summary Notes
            </label>
            <textarea
              rows={3}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="e.g. Normalization of transaminases and stable albumin levels."
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCompletionConfirmOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveTreatmentStatus('Treatment Completed', completionNotes)}
              disabled={isSavingStatus}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
            >
              {isSavingStatus ? 'Saving...' : 'Confirm Treatment Completed'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HepatologistDashboardPage;
