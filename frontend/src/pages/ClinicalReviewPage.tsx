import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { LabOrder, Patient, Prescription } from '@/types';

const STANDARD_TEST_TYPES = [
  'Liver Function Test (LFT)',
  'Complete Blood Count (CBC)',
  'Coagulation Profile (PT/INR)',
  'Viral Markers (HBsAg / HCV)',
  'Ultrasound Abdomen',
  'Serum Ferritin & Iron Studies',
  'Alpha-Fetoprotein (AFP)',
  'Liver Biopsy Pathology',
  'Renal Function Test (RFT)',
];

export const ClinicalReviewPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patient_id');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    queryPatientId ? parseInt(queryPatientId, 10) : null
  );
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingPatient, setIsLoadingPatient] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Prescription Form State
  const [medicine, setMedicine] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [frequencyDays, setFrequencyDays] = useState<number>(14);
  const [treatmentStatus, setTreatmentStatus] = useState<string>('Under treatment');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [dietSuggestion, setDietSuggestion] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUpdatingStatusOnly, setIsUpdatingStatusOnly] = useState<boolean>(false);

  // Treatment Completed explicit confirmation state
  const [confirmCompleted, setConfirmCompleted] = useState<boolean>(false);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  // Diagnostic Lab Orders State & Decision Modal
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [orderTestType, setOrderTestType] = useState<string>(STANDARD_TEST_TYPES[0]);
  const [orderPriority, setOrderPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');
  const [orderIndication, setOrderIndication] = useState<string>('');
  const [isOrderingLab, setIsOrderingLab] = useState<boolean>(false);
  const [showOrderForm, setShowOrderForm] = useState<boolean>(false);

  // Doctor Decision on Lab Order State
  const [selectedOrderForDecision, setSelectedOrderForDecision] = useState<LabOrder | null>(null);
  const [orderDecisionType, setOrderDecisionType] = useState<'No Test Needed' | 'Cancelled' | 'Proceed'>('No Test Needed');
  const [orderDecisionNotes, setOrderDecisionNotes] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState<boolean>(false);

  // Load patients list
  const loadPatients = async () => {
    setIsLoadingList(true);
    try {
      const res = await api.patients.list({
        q: searchQuery,
        status: statusFilter,
        per_page: 50,
      });
      if (res.success) {
        setPatients(res.patients);
        // If there's an initial patient requested via query param or select first
        if (!selectedPatientId && res.patients.length > 0) {
          setSelectedPatientId(res.patients[0].id);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load patients for clinical review');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [statusFilter]);

  const loadLabOrders = async (patientId: number) => {
    try {
      const res = await api.labOrders.list({ patient_id: patientId });
      if (res.success) {
        setLabOrders(res.orders);
      }
    } catch {
      // lab orders gracefully handled
    }
  };

  // Load full details for selected patient
  const loadPatientDetails = async (id: number) => {
    setIsLoadingPatient(true);
    try {
      const res = await api.patients.get(id);
      if (res.success) {
        setSelectedPatient(res.patient);
        const initialStatus = (res.patient.treatment_status && res.patient.treatment_status !== 'Awaiting review')
          ? res.patient.treatment_status
          : 'Under treatment';
        setTreatmentStatus(initialStatus);
        if (res.patient.lab_orders) {
          setLabOrders(res.patient.lab_orders);
        } else {
          loadLabOrders(id);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load patient clinical profile');
    } finally {
      setIsLoadingPatient(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientDetails(selectedPatientId);
      loadLabOrders(selectedPatientId);
    }
  }, [selectedPatientId]);

  const handleCreateLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!orderTestType.trim()) {
      error('Please select a diagnostic test type.');
      return;
    }

    setIsOrderingLab(true);
    try {
      const res = await api.labOrders.create(selectedPatient.id, {
        test_type: orderTestType.trim(),
        priority: orderPriority,
        clinical_indication: orderIndication.trim() || undefined,
      });
      if (res.success) {
        success(`Diagnostic test order for ${orderTestType} placed successfully.`);
        setOrderIndication('');
        setShowOrderForm(false);
        loadLabOrders(selectedPatient.id);
        loadPatientDetails(selectedPatient.id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to place laboratory order.');
    } finally {
      setIsOrderingLab(false);
    }
  };

  const handlePatientSelect = (p: Patient) => {
    setSelectedPatientId(p.id);
    setSearchParams({ patient_id: p.id.toString() });
  };

  const handlePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!medicine.trim() || !dosage.trim()) {
      error('Medicine name and dosage instructions are required.');
      return;
    }

    if (frequencyDays <= 0) {
      error('Frequency in days must be a positive integer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.prescriptions.create(selectedPatient.id, {
        medicine: medicine.trim(),
        dosage: dosage.trim(),
        frequency_days: frequencyDays,
        treatment_status: treatmentStatus,
        clinical_notes: clinicalNotes.trim(),
        diet_suggestion: dietSuggestion.trim(),
        follow_up_date: followUpDate || undefined,
      });

      if (res.success) {
        success(`Prescription for ${medicine} successfully recorded.`);
        // Reset form
        setMedicine('');
        setDosage('');
        setClinicalNotes('');
        setDietSuggestion('');
        setFollowUpDate('');
        // Reload patient details to update history and status
        loadPatientDetails(selectedPatient.id);
        loadPatients();
      }
    } catch (err: any) {
      error(err.message || 'Failed to issue prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusOnlyUpdate = async () => {
    if (!selectedPatient) return;
    if (treatmentStatus === 'Treatment Completed' && !confirmCompleted) {
      error('Please check the confirmation box to complete patient treatment.');
      return;
    }
    setIsUpdatingStatusOnly(true);
    try {
      const res = await api.patients.updateReviewStatus(selectedPatient.id, treatmentStatus, {
        confirm: confirmCompleted,
        treatment_notes: completionNotes,
      });
      if (res.success) {
        success(`Patient status updated to "${treatmentStatus}".`);
        setConfirmCompleted(false);
        setCompletionNotes('');
        loadPatientDetails(selectedPatient.id);
        loadPatients();
      }
    } catch (err: any) {
      error(err.message || 'Failed to update clinical review status');
    } finally {
      setIsUpdatingStatusOnly(false);
    }
  };

  const handleOpenDecisionModal = (
    order: LabOrder,
    defaultDecision: 'No Test Needed' | 'Cancelled' | 'Proceed'
  ) => {
    setSelectedOrderForDecision(order);
    setOrderDecisionType(defaultDecision);
    setOrderDecisionNotes('');
    setIsDecisionModalOpen(true);
  };

  const handleSubmitDecision = async () => {
    if (!selectedOrderForDecision || !selectedPatient) return;
    setIsSubmittingDecision(true);
    try {
      const res = await api.labOrders.submitDoctorDecision(
        selectedOrderForDecision.id,
        orderDecisionType,
        orderDecisionNotes.trim()
      );
      if (res.success) {
        success(`Lab order #${selectedOrderForDecision.id} decision "${orderDecisionType}" recorded.`);
        setIsDecisionModalOpen(false);
        setSelectedOrderForDecision(null);
        setOrderDecisionNotes('');
        loadLabOrders(selectedPatient.id);
        loadPatientDetails(selectedPatient.id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to submit clinical decision on lab order');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleReviewReport = async (reportId: number) => {
    try {
      const res = await api.reports.markReviewed(reportId);
      if (res.success) {
        success('Diagnostic report marked as reviewed.');
        if (selectedPatientId) {
          loadPatientDetails(selectedPatientId);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to mark report as reviewed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-indigo-600" />
            Clinical Review Workspace
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Evaluate diagnostic biomarkers, review medical reports, issue verified prescriptions, and update clinical status.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadPatients();
              if (selectedPatientId) loadPatientDetails(selectedPatientId);
            }}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Patient Selector Queue */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="h-full">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Patient Review Queue
                </h3>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {patients.length} patients
                </span>
              </div>

              {/* Search & Filter */}
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patient name, ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadPatients()}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="Needs urgent review">Needs urgent review</option>
                    <option value="Awaiting review">Awaiting review</option>
                    <option value="Under treatment">Under treatment</option>
                    <option value="Stable">Stable</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-2 max-h-[600px] overflow-y-auto divide-y divide-slate-100">
              {isLoadingList ? (
                <div className="py-8">
                  <LoadingSpinner fullScreen={false} label="Loading queue..." />
                </div>
              ) : patients.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No patients match criteria.
                </div>
              ) : (
                patients.map((p) => {
                  const isSelected = p.id === selectedPatientId;
                  const isUrgent = p.treatment_status === 'Needs urgent review';
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePatientSelect(p)}
                      className={`w-full p-3 text-left rounded-xl transition flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-50/90 border border-indigo-200 shadow-2xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {p.full_name}
                        </span>
                        <Badge risk={p.latest_risk_label} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono">{p.portal_id}</span>
                        <span>{p.age}y · {p.gender}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                            isUrgent
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 font-bold'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.treatment_status}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700">
                          {p.latest_risk_percent}% Risk
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (8 cols): Deep Patient Review & Prescription Builder */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedPatient ? (
            <Card>
              <CardContent className="py-20 text-center">
                <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No Patient Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Select a patient from the left queue to inspect clinical parameters, review previous prescriptions, and issue medical directives.
                </p>
              </CardContent>
            </Card>
          ) : isLoadingPatient ? (
            <div className="py-20">
              <LoadingSpinner fullScreen={false} label="Retrieving comprehensive clinical records..." />
            </div>
          ) : (
            <>
              {/* Patient Profile Card */}
              <Card className="border-indigo-100 shadow-md">
                <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-t-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/30 text-white flex items-center justify-center font-black text-lg border border-indigo-400/40">
                        {selectedPatient.full_name ? selectedPatient.full_name.charAt(0) : 'P'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-white">{selectedPatient.full_name}</h2>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                            {selectedPatient.portal_id}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                          {selectedPatient.age} years old · {selectedPatient.gender} · Phone: {selectedPatient.phone || 'N/A'} · Email: {selectedPatient.email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-indigo-300 uppercase tracking-wider block">Cirrhosis Risk</span>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <Badge risk={selectedPatient.latest_risk_label} size="sm" />
                          <span className="text-sm font-black text-white">{selectedPatient.latest_risk_percent}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* Biomarkers Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                      <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                      Laboratory Biomarker Panel
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {[
                        { label: 'Bilirubin', val: selectedPatient.bilirubin, unit: 'mg/dL', warn: selectedPatient.bilirubin != null && selectedPatient.bilirubin > 1.2, crit: selectedPatient.bilirubin != null && selectedPatient.bilirubin > 3.0 },
                        { label: 'Albumin', val: selectedPatient.albumin, unit: 'g/dL', warn: selectedPatient.albumin != null && selectedPatient.albumin < 3.5, crit: selectedPatient.albumin != null && selectedPatient.albumin < 2.8 },
                        { label: 'Platelets', val: selectedPatient.platelets, unit: 'x10³/µL', warn: selectedPatient.platelets != null && selectedPatient.platelets < 150, crit: selectedPatient.platelets != null && selectedPatient.platelets < 100 },
                        { label: 'SGOT (AST)', val: selectedPatient.sgot, unit: 'U/L', warn: selectedPatient.sgot != null && selectedPatient.sgot > 48, crit: selectedPatient.sgot != null && selectedPatient.sgot > 120 },
                        { label: 'SGPT (ALT)', val: selectedPatient.sgpt, unit: 'U/L', warn: selectedPatient.sgpt != null && selectedPatient.sgpt > 56, crit: selectedPatient.sgpt != null && selectedPatient.sgpt > 120 },
                        { label: 'Prothrombin', val: selectedPatient.prothrombin, unit: 'sec', warn: selectedPatient.prothrombin != null && selectedPatient.prothrombin > 13.5, crit: selectedPatient.prothrombin != null && selectedPatient.prothrombin > 15.0 },
                        { label: 'Cholesterol', val: selectedPatient.cholesterol, unit: 'mg/dL', warn: false, crit: false },
                        { label: 'Copper', val: selectedPatient.copper, unit: 'µg/dL', warn: false, crit: false },
                        { label: 'Alk Phos', val: selectedPatient.alk_phos, unit: 'U/L', warn: false, crit: false },
                        { label: 'Triglycerides', val: selectedPatient.triglycerides, unit: 'mg/dL', warn: false, crit: false },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className={`p-2.5 rounded-xl border text-xs flex flex-col ${
                            m.crit
                              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                              : m.warn
                              ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <span className="text-[10px] text-slate-500 font-semibold truncate">{m.label}</span>
                          <span className="text-sm font-black mt-0.5">
                            {m.val != null ? (
                              <>
                                {m.val} <span className="text-[10px] font-normal opacity-70">{m.unit}</span>
                              </>
                            ) : (
                              <span className="text-xs font-normal text-slate-400">Not available</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Abnormal Flags Alerts */}
                    {(selectedPatient.evaluation?.flags || []).length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {selectedPatient.evaluation?.flags.map((f, i) => (
                          <div
                            key={i}
                            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 ${
                              f.severity === 'critical'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              <strong>{f.marker} ({f.value} {f.unit}):</strong> {f.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Physical Clinical Signs */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Physical Signs & Findings
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {[
                        { name: 'Ascites', present: selectedPatient.ascites },
                        { name: 'Hepatomegaly', present: selectedPatient.hepatomegaly },
                        { name: 'Spider Angiomas', present: selectedPatient.spiders },
                        { name: 'Peripheral Edema', present: selectedPatient.edema },
                      ].map((s) => (
                        <span
                          key={s.name}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                            s.present
                              ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {s.present ? `✓ ${s.name} Present` : `✕ No ${s.name}`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Medical Reports Section */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        Attached Diagnostic Reports ({(selectedPatient.reports || []).length})
                      </span>
                    </h4>

                    {(selectedPatient.reports || []).length === 0 ? (
                      <p className="text-xs text-slate-400">No laboratory or imaging reports uploaded for this patient.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(selectedPatient.reports || []).map((rep) => (
                          <div
                            key={rep.id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-slate-800 truncate">{rep.original_filename}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400">{rep.category} · {new Date(rep.uploaded_at).toLocaleDateString()}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                  rep.is_reviewed
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {rep.is_reviewed ? 'Reviewed' : 'Awaiting Review'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!rep.is_reviewed && (
                                <button
                                  type="button"
                                  onClick={() => handleReviewReport(rep.id)}
                                  className="px-2 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Mark this diagnostic report as clinically reviewed"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Mark Reviewed
                                </button>
                              )}
                              <a
                                href={api.reports.getDownloadUrl(rep.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition shrink-0 inline-flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> View
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Lab Orders Section */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-cyan-600" />
                        Diagnostic Lab Test Orders ({labOrders.length})
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs py-1 h-7 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                        leftIcon={<Plus className="w-3 h-3" />}
                        onClick={() => setShowOrderForm(!showOrderForm)}
                      >
                        {showOrderForm ? 'Close Form' : 'Order Diagnostic Test'}
                      </Button>
                    </div>

                    {/* Order Diagnostic Test Form */}
                    {showOrderForm && (
                      <form onSubmit={handleCreateLabOrder} className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-200 mb-3 space-y-3">
                        <div className="font-semibold text-xs text-cyan-900 flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-cyan-700" />
                          New Diagnostic Requisition for {selectedPatient.full_name}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Test Type <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={orderTestType}
                              onChange={(e) => setOrderTestType(e.target.value)}
                              className="w-full text-xs rounded-lg border border-slate-300 bg-white p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              required
                            >
                              {STANDARD_TEST_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Clinical Priority <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={orderPriority}
                              onChange={(e) => setOrderPriority(e.target.value as 'Routine' | 'Urgent' | 'STAT')}
                              className="w-full text-xs rounded-lg border border-slate-300 bg-white p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            >
                              <option value="Routine">Routine (Standard Turnaround)</option>
                              <option value="Urgent">Urgent (Priority Processing)</option>
                              <option value="STAT">STAT (Immediate Clinical Action)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Clinical Indication / Objective
                          </label>
                          <input
                            type="text"
                            value={orderIndication}
                            onChange={(e) => setOrderIndication(e.target.value)}
                            placeholder="e.g. Follow-up liver enzyme elevation, acute decompensation check..."
                            className="w-full text-xs rounded-lg border border-slate-300 bg-white p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setShowOrderForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="text-xs bg-cyan-600 hover:bg-cyan-700 border-cyan-600"
                            isLoading={isOrderingLab}
                          >
                            Place Lab Order
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Existing Orders List */}
                    {labOrders.length === 0 ? (
                      <p className="text-xs text-slate-400">No laboratory test orders placed yet for this patient.</p>
                    ) : (
                      <div className="space-y-2">
                        {labOrders.map((order) => (
                          <div
                            key={order.id}
                            className="p-3 rounded-xl bg-cyan-50/40 border border-cyan-200/70 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                {order.test_type}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  order.priority === 'STAT'
                                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                                    : order.priority === 'Urgent'
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {order.priority}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  order.order_status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : order.order_status === 'In Progress'
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : order.order_status === 'Sample Collected'
                                    ? 'bg-purple-50 text-purple-700 border-purple-300'
                                    : order.order_status === 'Clarification Required'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : order.order_status === 'Test Not Performed'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : order.order_status === 'No Test Needed'
                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                    : order.order_status === 'Cancelled'
                                    ? 'bg-slate-100 text-slate-500 border-slate-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-300'
                                }`}>
                                  {order.order_status}
                                </span>
                              </div>
                            </div>
                            {order.clinical_indication && (
                              <p className="text-slate-600 text-[11px]">
                                <strong>Indication:</strong> {order.clinical_indication}
                              </p>
                            )}
                            {/* Attending Physician Decision / Notes Banner */}
                            {order.doctor_decision && (
                              <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[10px]">
                                <strong>Doctor Decision:</strong> {order.doctor_decision} {order.doctor_notes ? `— "${order.doctor_notes}"` : ''}
                              </div>
                            )}

                            {/* Alert Banner & Decision Actions when Lab Technician requests clarification or reports test not performed */}
                            {['Clarification Required', 'Test Not Performed'].includes(order.order_status) && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2 mt-1">
                                <div className="flex items-start gap-1.5">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-bold text-[11px]">
                                      {order.order_status === 'Clarification Required'
                                        ? 'Laboratory Clarification Requested'
                                        : 'Laboratory: Specimen Not Performed'}
                                    </p>
                                    <p className="text-[11px] text-amber-900 mt-0.5">
                                      <strong>Technician Note:</strong> {order.status_reason || 'Specimen accession question logged.'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-amber-200/80">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDecisionModal(order, 'No Test Needed')}
                                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs"
                                  >
                                    Approve &ldquo;No Test Needed&rdquo;
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDecisionModal(order, 'Proceed')}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs"
                                  >
                                    Instruct Lab to Proceed
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDecisionModal(order, 'Cancelled')}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition cursor-pointer shadow-2xs"
                                  >
                                    Cancel Order
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span>Ordered: {new Date(order.created_at).toLocaleDateString()} {order.doctor_name ? `by Dr. ${order.doctor_name}` : ''}</span>
                              {order.completed_at && (
                                <span className="text-emerald-600 font-semibold">Completed: {new Date(order.completed_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            {order.reports && order.reports.length > 0 && (
                              <div className="pt-1 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-600">Attached Report:</span>
                                {order.reports.map((rep) => (
                                  <a
                                    key={rep.id}
                                    href={api.reports.getDownloadUrl(rep.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-white border border-cyan-200 text-cyan-700 font-bold text-[10px] hover:bg-cyan-50 inline-flex items-center gap-1"
                                  >
                                    <Download className="w-2.5 h-2.5" /> {rep.original_filename}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Historical Prescriptions */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                      <Pill className="w-3.5 h-3.5 text-purple-600" />
                      Prescription History ({(selectedPatient.prescriptions || []).length})
                    </h4>

                    {(selectedPatient.prescriptions || []).length === 0 ? (
                      <p className="text-xs text-slate-400">No prescriptions recorded yet for this patient.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedPatient.prescriptions || []).map((rx) => (
                          <div
                            key={rx.id}
                            className="p-3 rounded-xl bg-purple-50/50 border border-purple-200/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-purple-950 text-sm">{rx.medicine}</span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : 'Recorded'}
                              </span>
                            </div>
                            <p className="text-slate-700">
                              <strong>Dosage:</strong> {rx.dosage} · Duration: {rx.frequency_days} days
                              {rx.doctor_name && <span> · Prescribed by Dr. {rx.doctor_name}</span>}
                            </p>
                            {rx.clinical_notes && (
                              <p className="text-slate-600 bg-white/70 p-2 rounded-lg border border-purple-100 text-[11px]">
                                <strong>Notes:</strong> {rx.clinical_notes}
                              </p>
                            )}
                            {rx.diet_suggestion && (
                              <p className="text-slate-600 text-[11px]">
                                <strong>Diet:</strong> {rx.diet_suggestion}
                              </p>
                            )}
                            {rx.follow_up_date && (
                              <p className="text-[11px] font-semibold text-indigo-700">
                                Follow-up: {rx.follow_up_date}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Prescription Builder & Status Update Form */}
              <Card className="border-indigo-200 shadow-md">
                <CardHeader className="bg-slate-50 border-b border-slate-200/80 p-4">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-indigo-600" />
                    Clinical Review & Prescription Builder
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formulate targeted pharmacotherapy, dietary restrictions, and advance the patient's treatment lifecycle.
                  </p>
                </CardHeader>

                <CardContent className="p-5">
                  <form onSubmit={handlePrescriptionSubmit} className="space-y-4">
                    {/* Status Update Dropdown */}
                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-bold text-indigo-950 block">
                          Patient Treatment Lifecycle Status
                        </label>
                        <p className="text-[11px] text-indigo-800/80">
                          Current status: <strong className="text-indigo-950">{selectedPatient.treatment_status}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={treatmentStatus}
                          onChange={(e) => setTreatmentStatus(e.target.value)}
                          className="py-1.5 px-3 text-xs font-semibold bg-white border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Under treatment">Under treatment</option>
                          <option value="Needs urgent review">Needs urgent review</option>
                          <option value="Awaiting review">Awaiting review</option>
                          <option value="Stable">Stable</option>
                          <option value="Treatment Completed">Treatment Completed</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUpdatingStatusOnly}
                          onClick={handleStatusOnlyUpdate}
                          className="text-xs"
                        >
                          {isUpdatingStatusOnly ? 'Saving...' : 'Update Status Only'}
                        </Button>
                      </div>
                    </div>

                    {/* Explicit Confirmation Block for Treatment Completed */}
                    {treatmentStatus === 'Treatment Completed' && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2.5 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-xs">Conclude Patient Clinical Treatment Program</span>
                        </div>
                        <label className="flex items-start gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmCompleted}
                            onChange={(e) => setConfirmCompleted(e.target.checked)}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>I confirm that this patient&apos;s treatment regimen has been completed.</span>
                        </label>
                        <div>
                          <label className="text-[11px] font-bold block mb-1 text-slate-700">
                            Completion Rationale / Clinical Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            placeholder="e.g. Biochemical remission achieved, transaminases normalized, outpatient monitoring established..."
                            className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          />
                        </div>
                      </div>
                    )}

                    {/* Medication & Dosage Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Medication Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Spironolactone, Propranolol, Lactulose..."
                          value={medicine}
                          onChange={(e) => setMedicine(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Dosage & Instructions *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 20mg twice daily with meals"
                          value={dosage}
                          onChange={(e) => setDosage(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    {/* Frequency & Follow-up Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Course Duration (Days) *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          max={365}
                          value={frequencyDays}
                          onChange={(e) => setFrequencyDays(parseInt(e.target.value, 10) || 7)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Next Clinical Follow-up Date
                        </label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    {/* Clinical Review Notes */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Clinical Review Notes & Observations
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detail diagnostic reasoning, ultrasound/biopsy findings, and therapeutic goals..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>

                    {/* Diet & Lifestyle Guidance */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Dietary & Lifestyle Directives
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Strict sodium restriction (<2g/day), abstention from alcohol, daily weight tracking..."
                        value={dietSuggestion}
                        onChange={(e) => setDietSuggestion(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>

                    {/* Disclaimer & Submit */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400">
                        Prescription will be recorded in patient's profile and notified to administrative logs.
                      </p>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs shrink-0"
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        {isSubmitting ? 'Issuing Prescription...' : 'Issue Prescription & Update Status'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Doctor Decision Modal for Diagnostic Lab Order */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => {
          setIsDecisionModalOpen(false);
          setSelectedOrderForDecision(null);
          setOrderDecisionNotes('');
        }}
        title="Physician Diagnostic Order Evaluation"
        description="Review laboratory feedback and record your clinical decision for this test order."
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDecisionModalOpen(false);
                setSelectedOrderForDecision(null);
                setOrderDecisionNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSubmittingDecision}
              onClick={handleSubmitDecision}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Confirm Clinical Decision
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {selectedOrderForDecision && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Order #{selectedOrderForDecision.id}: {selectedOrderForDecision.test_type}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {selectedOrderForDecision.order_status}
                </span>
              </div>
              {selectedOrderForDecision.status_reason && (
                <p className="text-slate-600 text-[11px] pt-1 border-t border-slate-200 mt-1">
                  <strong>Laboratory Technician Feedback:</strong> {selectedOrderForDecision.status_reason}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Physician Determination *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrderDecisionType('No Test Needed')}
                className={`p-2 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                  orderDecisionType === 'No Test Needed'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                No Test Needed
              </button>
              <button
                type="button"
                onClick={() => setOrderDecisionType('Proceed')}
                className={`p-2 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                  orderDecisionType === 'Proceed'
                    ? 'border-cyan-600 bg-cyan-50 text-cyan-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Proceed / Re-draw
              </button>
              <button
                type="button"
                onClick={() => setOrderDecisionType('Cancelled')}
                className={`p-2 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                  orderDecisionType === 'Cancelled'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancel Order
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Physician Notes & Clinical Instructions (Optional)
            </label>
            <textarea
              rows={3}
              value={orderDecisionNotes}
              onChange={(e) => setOrderDecisionNotes(e.target.value)}
              placeholder="e.g. Evaluated clinical stability. Test order cancelled as symptoms resolved, or request sample redrawn after fasting..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
