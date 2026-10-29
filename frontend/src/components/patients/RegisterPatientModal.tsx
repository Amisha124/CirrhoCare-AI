import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  FlaskConical,
  HeartPulse,
  KeyRound,
  Lock,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Select } from '@/components/common/Select';
import { api } from '@/services/api';
import type { Patient } from '@/types';

export interface RegisterPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (patient: Patient) => void;
}

export const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form State
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number | ''>(45);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Attending Doctor State
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [assignedDoctorId, setAssignedDoctorId] = useState<number | ''>('');
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Baseline Laboratory Biomarkers (Optional)
  const [includeBiomarkers, setIncludeBiomarkers] = useState(false);
  const [bilirubin, setBilirubin] = useState<number>(1.1);
  const [directBilirubin, setDirectBilirubin] = useState<number>(0.3);
  const [albumin, setAlbumin] = useState<number>(3.8);
  const [platelets, setPlatelets] = useState<number>(220);
  const [sgot, setSgot] = useState<number>(32);
  const [sgpt, setSgpt] = useState<number>(30);
  const [prothrombin, setProthrombin] = useState<number>(11.5);

  // Status & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Issued Credentials State
  const [registeredAccess, setRegisteredAccess] = useState<{
    patient: Patient;
    portalId: string;
    pin: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'pin' | 'all' | null>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full legal patient name is required.';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Patient name must be at least 2 characters.';
    }

    if (age === '' || isNaN(Number(age))) {
      errs.age = 'Age is required.';
    } else if (Number(age) < 1 || Number(age) > 125) {
      errs.age = 'Age must be between 1 and 125 years.';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (includeBiomarkers) {
      if (bilirubin < 0 || bilirubin > 50) errs.bilirubin = 'Bilirubin must be between 0 and 50 mg/dL.';
      if (albumin < 0 || albumin > 10) errs.albumin = 'Albumin must be between 0 and 10 g/dL.';
      if (platelets < 0 || platelets > 2000) errs.platelets = 'Platelets must be between 0 and 2000 k/µL.';
      if (sgot < 0 || sgot > 2000) errs.sgot = 'AST / SGOT must be positive.';
      if (sgpt < 0 || sgpt > 2000) errs.sgpt = 'ALT / SGPT must be positive.';
      if (prothrombin < 0 || prothrombin > 60) errs.prothrombin = 'Prothrombin time must be between 0 and 60 sec.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  React.useEffect(() => {
    if (isOpen) {
      setIsLoadingDoctors(true);
      api.doctors
        .list()
        .then((res) => {
          if (res.success && res.doctors) {
            setDoctors(res.doctors);
            setAssignedDoctorId((prev) => (prev === '' && res.doctors.length > 0 ? res.doctors[0].id : prev));
          }
        })
        .catch(() => {
          // Doctors list graceful fallback
        })
        .finally(() => {
          setIsLoadingDoctors(false);
        });
    }
  }, [isOpen]);

  const resetForm = () => {
    setFullName('');
    setAge(45);
    setGender('Male');
    setPhone('');
    setEmail('');
    setAssignedDoctorId(doctors.length > 0 ? doctors[0].id : '');
    setIncludeBiomarkers(false);
    setBilirubin(1.1);
    setAlbumin(3.8);
    setPlatelets(220);
    setSgot(32);
    setSgpt(30);
    setProthrombin(11.5);
    setErrors({});
    setApiError(null);
  };

  const copyToClipboard = (text: string, field: 'id' | 'pin' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      if (registeredAccess) {
        onSuccess(registeredAccess.patient);
      }
      setRegisteredAccess(null);
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<Patient> & { assigned_doctor_id?: number } = {
        full_name: fullName.trim(),
        age: Number(age),
        gender,
        phone: phone.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        assigned_doctor_id: assignedDoctorId !== '' ? Number(assignedDoctorId) : undefined,
        treatment_status: 'Awaiting Doctor Review',
        lab_workflow_status: 'Registered',
        bilirubin: includeBiomarkers ? Number(bilirubin) : 1.1,
        direct_bilirubin: includeBiomarkers ? Number(directBilirubin) : 0.3,
        albumin: includeBiomarkers ? Number(albumin) : 3.8,
        platelets: includeBiomarkers ? Number(platelets) : 220,
        sgot: includeBiomarkers ? Number(sgot) : 32,
        sgpt: includeBiomarkers ? Number(sgpt) : 30,
        prothrombin: includeBiomarkers ? Number(prothrombin) : 11.5,
      };

      const res = await api.patients.create(payload);

      if (res.success && res.patient) {
        if (res.initial_pin) {
          setRegisteredAccess({
            patient: res.patient,
            portalId: res.portal_id || res.patient.portal_id,
            pin: res.initial_pin,
          });
        } else {
          resetForm();
          onSuccess(res.patient);
          onClose();
        }
      } else {
        throw new Error(res.message || 'Failed to register patient in clinical registry.');
      }
    } catch (err: any) {
      setApiError(err.message || 'Server rejected patient registration. Please verify details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            {registeredAccess ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {registeredAccess ? 'Patient Access Credentials' : 'Register New Clinical Patient'}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              {registeredAccess
                ? 'Issue these credentials to the patient for secure portal access.'
                : 'Admit a new patient into the CirrhoCare AI surveillance database.'}
            </p>
          </div>
        </div>
      }
      size="lg"
      closeOnBackdrop={!isSubmitting}
    >
      {registeredAccess ? (
        <div className="space-y-5 p-6 pt-2">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Patient Registered Successfully!
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Initial login credentials have been securely provisioned. Record or provide these credentials directly to the patient now.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Patient Full Name
                </span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  {registeredAccess.patient.full_name}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned Attending Doctor
                </span>
                <p className="text-sm font-bold text-blue-800 mt-0.5">
                  {registeredAccess.patient.assigned_doctor_name ||
                    doctors.find((d) => d.id === Number(assignedDoctorId))?.name ||
                    'Attending Hepatologist'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/60">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" /> Patient ID
                  </span>
                  <p className="text-base font-extrabold text-blue-700 tracking-wide mt-0.5 font-mono">
                    {registeredAccess.portalId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(registeredAccess.portalId, 'id')}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                  title="Copy Patient ID"
                >
                  {copiedField === 'id' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-purple-600" /> Secret PIN
                  </span>
                  <p className="text-base font-extrabold text-purple-700 tracking-widest mt-0.5 font-mono">
                    {registeredAccess.pin}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(registeredAccess.pin, 'pin')}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                  title="Copy PIN"
                >
                  {copiedField === 'pin' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Confidentiality Notice:</strong> The patient will sign in using their Name, Patient ID, and this Secret PIN. They will be prompted to set a personal PIN upon first login.
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={() =>
                copyToClipboard(
                  `CirrhoCare AI - Patient Portal Access\nPatient Name: ${registeredAccess.patient.full_name}\nPatient ID: ${registeredAccess.portalId}\nSecret PIN: ${registeredAccess.pin}`,
                  'all',
                )
              }
              leftIcon={copiedField === 'all' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            >
              {copiedField === 'all' ? 'Copied to Clipboard!' : 'Copy Access Credentials'}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={handleClose}
            >
              Done & Close
            </Button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-2">
        {apiError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Section 1: Demographics & Identity */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <User className="w-3.5 h-3.5 text-blue-600" /> Patient Demographics
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Full Legal Name *"
                placeholder="e.g. Robert Smith"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                error={errors.fullName}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div>
              <Input
                label="Age (Years) *"
                type="number"
                min={1}
                max={125}
                value={age}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setAge(val);
                  if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                }}
                error={errors.age}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Select
                label="Biological Sex *"
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Input
                label="Phone Number (Optional)"
                placeholder="e.g. +1-555-0145"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Input
                label="Email Address (Optional)"
                type="email"
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                error={errors.email}
                disabled={isSubmitting}
              />
            </div>

            <div className="sm:col-span-2">
              <Select
                label="Assigned Attending Doctor / Hepatologist *"
                value={assignedDoctorId}
                onChange={(e) => setAssignedDoctorId(e.target.value === '' ? '' : Number(e.target.value))}
                options={[
                  ...(doctors.length === 0
                    ? [{ value: '', label: isLoadingDoctors ? 'Loading attending physicians...' : 'No active doctors found' }]
                    : doctors.map((d) => ({
                        value: d.id,
                        label: `Dr. ${d.name} (${d.email})`,
                      }))),
                ]}
                disabled={isSubmitting || isLoadingDoctors}
                helperText="Select the physician responsible for this patient's diagnostic review, test orders, and prescriptions."
              />
            </div>
          </div>
        </div>

        {/* Section 2: Optional Baseline Biomarkers */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-teal-600" /> Initial Laboratory Biomarkers
            </h4>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-teal-700 select-none">
              <input
                type="checkbox"
                checked={includeBiomarkers}
                onChange={(e) => setIncludeBiomarkers(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                disabled={isSubmitting}
              />
              Record Biomarkers at Intake
            </label>
          </div>

          {includeBiomarkers ? (
            <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100 space-y-3 animate-in fade-in duration-200">
              <p className="text-[11px] text-teal-700">
                Baseline laboratory values will trigger automated Random Forest AI cirrhosis risk evaluation upon registration.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input
                  label="Bilirubin (mg/dL)"
                  type="number"
                  step="0.1"
                  min={0}
                  value={bilirubin}
                  onChange={(e) => setBilirubin(Number(e.target.value))}
                  error={errors.bilirubin}
                  disabled={isSubmitting}
                />
                <Input
                  label="Albumin (g/dL)"
                  type="number"
                  step="0.1"
                  min={0}
                  value={albumin}
                  onChange={(e) => setAlbumin(Number(e.target.value))}
                  error={errors.albumin}
                  disabled={isSubmitting}
                />
                <Input
                  label="Platelets (k/µL)"
                  type="number"
                  step="1"
                  min={0}
                  value={platelets}
                  onChange={(e) => setPlatelets(Number(e.target.value))}
                  error={errors.platelets}
                  disabled={isSubmitting}
                />
                <Input
                  label="AST / SGOT (U/L)"
                  type="number"
                  step="1"
                  min={0}
                  value={sgot}
                  onChange={(e) => setSgot(Number(e.target.value))}
                  error={errors.sgot}
                  disabled={isSubmitting}
                />
                <Input
                  label="ALT / SGPT (U/L)"
                  type="number"
                  step="1"
                  min={0}
                  value={sgpt}
                  onChange={(e) => setSgpt(Number(e.target.value))}
                  error={errors.sgpt}
                  disabled={isSubmitting}
                />
                <Input
                  label="Prothrombin (sec)"
                  type="number"
                  step="0.1"
                  min={0}
                  value={prothrombin}
                  onChange={(e) => setProthrombin(Number(e.target.value))}
                  error={errors.prothrombin}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Standard physiological baseline values will be initialized. Complete biomarker panels can be updated anytime in the Lab Technician workspace.</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            {isSubmitting ? 'Registering Patient...' : 'Register Patient'}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
};
