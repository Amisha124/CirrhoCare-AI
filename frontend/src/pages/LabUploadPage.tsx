import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileText,
  FileUp,
  FolderUp,
  Info,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { useToast } from '@/app/ToastContext';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';
import type { LabOrder, Patient } from '@/types';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

const REPORT_CATEGORIES = [
  'Lab report',
  'Liver Function Test (LFT)',
  'Ultrasound Abdomen',
  'Biopsy Pathology',
  'CT Scan / MRI',
  'Complete Blood Count (CBC)',
  'Coagulation Profile (PT/INR)',
  'Follow-up Clinical Notes',
];

export const LabUploadPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error, info } = useToast();

  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    searchParams.get('patient_id') || ''
  );
  const [selectedLabOrderId, setSelectedLabOrderId] = useState<string>(
    searchParams.get('lab_order_id') || ''
  );
  const [patientLabOrders, setPatientLabOrders] = useState<LabOrder[]>([]);
  const [category, setCategory] = useState<string>('Liver Function Test (LFT)');

  // File Upload Modes
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    files: string[];
  } | null>(null);

  useEffect(() => {
    if (selectedPatientId) {
      api.labOrders
        .list({ patient_id: Number(selectedPatientId) })
        .then((res) => {
          if (res.success && res.orders) {
            setPatientLabOrders(res.orders);
            if (selectedLabOrderId) {
              const matched = res.orders.find((o) => o.id.toString() === selectedLabOrderId);
              if (matched) {
                setCategory(matched.test_type);
              }
            }
          }
        })
        .catch(() => setPatientLabOrders([]));
    } else {
      setPatientLabOrders([]);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const res = await api.patients.list({ per_page: 100 });
        if (res.success) {
          setPatients(res.patients || []);
          if (!selectedPatientId && res.patients.length > 0) {
            setSelectedPatientId(res.patients[0].id.toString());
          }
        }
      } catch (err: any) {
        error(err.message || 'Failed to load patient records for upload.');
      } finally {
        setIsLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `File '${file.name}' has an unsupported extension (.${ext}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File '${file.name}' exceeds the maximum allowed size of 8MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
    }
    return null;
  };

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      error(validationError);
      e.target.value = '';
      setSingleFile(null);
      return;
    }

    setSingleFile(file);
    setUploadResult(null);
  };

  const handleBatchFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        error(validationError);
      } else {
        validFiles.push(file);
      }
    }

    setBatchFiles(validFiles);
    setUploadResult(null);
  };

  const handleRemoveBatchFile = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      error('Please select an authorized patient record.');
      return;
    }

    const patientId = Number(selectedPatientId);
    if (!patientId || isNaN(patientId)) {
      error('Invalid patient selection.');
      return;
    }

    if (!isBatchMode && !singleFile) {
      error('Please select a diagnostic report file to upload.');
      return;
    }

    if (isBatchMode && batchFiles.length === 0) {
      error('Please select one or more files for batch upload.');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const labOrderIdNum = selectedLabOrderId ? Number(selectedLabOrderId) : undefined;
      if (!isBatchMode && singleFile) {
        const res = await api.reports.upload(patientId, singleFile, category, labOrderIdNum);
        if (res.success) {
          success(`Report '${singleFile.name}' uploaded successfully.`);
          setUploadResult({
            success: true,
            message: `Report successfully uploaded and attached to Patient #${patientId}.`,
            files: [singleFile.name],
          });
          setSingleFile(null);
        }
      } else if (isBatchMode && batchFiles.length > 0) {
        const res = await api.reports.batchUpload(patientId, batchFiles, category, labOrderIdNum);
        if (res.success) {
          success(`Uploaded ${res.uploaded_count} reports successfully.`);
          setUploadResult({
            success: true,
            message: res.message,
            files: res.uploaded_files,
          });
          setBatchFiles([]);
        }
      }
    } catch (err: any) {
      error(err.message || 'Upload failed. Please verify the file meets security policies.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoadingPatients) {
    return <LoadingSpinner label="Loading authorized patient registries..." className="py-24" />;
  }

  const selectedPatient = patients.find((p) => p.id.toString() === selectedPatientId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Breadcrumb Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/lab"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-teal-600 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Laboratory Hub
        </Link>
        <span className="text-xs text-slate-400 font-medium">Secure Clinical Upload Protocol</span>
      </div>

      {/* Main Upload Card */}
      <Card className="shadow-lg border-teal-100 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Upload Patient Laboratory Report</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Protected storage with authenticated access controls and SHA-verified file storage.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Success Banner */}
          {uploadResult && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2.5 text-teal-800">
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                <h4 className="font-bold text-sm">{uploadResult.message}</h4>
              </div>
              <ul className="text-xs text-teal-700 pl-7 list-disc space-y-1">
                {uploadResult.files.map((file, idx) => (
                  <li key={idx} className="font-mono">
                    {file}
                  </li>
                ))}
              </ul>
              <div className="pt-2 pl-7 flex items-center gap-3">
                <Link to="/reports">
                  <Button variant="outline" size="sm" className="text-xs text-teal-700 border-teal-300">
                    View in Reports Archive
                  </Button>
                </Link>
                <Link to="/lab">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-600">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Select Patient */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                1. Select Patient Record *
              </label>

              {patients.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    No patients currently registered. Please use{' '}
                    <Link to="/lab" className="underline font-bold">
                      New Biomarker Intake
                    </Link>{' '}
                    on the Laboratory Hub first.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                    className="w-full text-sm font-medium px-4 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      -- Choose Authorized Patient --
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.portal_id}) — Risk: {p.latest_risk_label || 'Pending'} — Status:{' '}
                        {p.treatment_status || 'Under treatment'}
                      </option>
                    ))}
                  </select>

                  {selectedPatient && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center gap-4">
                      <span>
                        <strong>Age:</strong> {selectedPatient.age}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Gender:</strong> {selectedPatient.gender}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Portal ID:</strong> {selectedPatient.portal_id}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Current Risk:</strong> {selectedPatient.latest_risk_label || 'Pending'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Diagnostic Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                2. Report Classification Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full text-sm font-medium px-4 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {REPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional: Link to Diagnostic Lab Order */}
            {patientLabOrders.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Fulfill Diagnostic Test Order (Optional)
                </label>
                <select
                  value={selectedLabOrderId}
                  onChange={(e) => {
                    setSelectedLabOrderId(e.target.value);
                    const matched = patientLabOrders.find((o) => o.id.toString() === e.target.value);
                    if (matched) {
                      setCategory(matched.test_type);
                    }
                  }}
                  className="w-full text-sm font-medium px-4 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">-- None (Standalone Clinical Report) --</option>
                  {patientLabOrders
                    .filter((o) => o.order_status !== 'Completed')
                    .map((o) => (
                      <option key={o.id} value={o.id.toString()}>
                        Order #{o.id}: {o.test_type} ({o.priority}) [{o.order_status}]
                      </option>
                    ))}
                </select>
                {selectedLabOrderId && (
                  <p className="text-xs text-teal-700 mt-1 font-semibold">
                    Uploading will automatically link this report to Order #{selectedLabOrderId} and mark it Completed.
                  </p>
                )}
              </div>
            )}

            {/* Mode Toggle: Single vs Batch */}
            <div className="flex items-center justify-between border-y border-slate-200 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Upload Workflow:
                </span>
                <span className="text-xs text-slate-500">
                  {isBatchMode ? 'Multi-file batch submission' : 'Single clinical report'}
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(false);
                    setBatchFiles([]);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    !isBatchMode ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5 inline mr-1" />
                  Single File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchMode(true);
                    setSingleFile(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    isBatchMode ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderUp className="w-3.5 h-3.5 inline mr-1" />
                  Batch Upload
                </button>
              </div>
            </div>

            {/* Step 3: File Input / Dropzone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                3. Choose Medical Files *
              </label>

              {!isBatchMode ? (
                // Single File Mode
                <div className="border-2 border-dashed border-teal-200 rounded-2xl p-6 text-center hover:border-teal-400 transition bg-teal-50/20">
                  <input
                    type="file"
                    id="single-file-input"
                    onChange={handleSingleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    className="hidden"
                  />
                  <label htmlFor="single-file-input" className="cursor-pointer space-y-2 block">
                    <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 mx-auto flex items-center justify-center">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-teal-700 hover:underline">
                        Click to select document
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">PDF, PNG, JPG, WEBP, DOC, or DOCX (Max: 8MB)</p>
                    </div>
                  </label>

                  {singleFile && (
                    <div className="mt-4 p-3 bg-white rounded-xl border border-teal-200 inline-flex items-center gap-3 shadow-sm">
                      <FileCheck2 className="w-5 h-5 text-teal-600" />
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-xs">
                          {singleFile.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {(singleFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSingleFile(null)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Batch Files Mode
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-teal-200 rounded-2xl p-6 text-center hover:border-teal-400 transition bg-teal-50/20">
                    <input
                      type="file"
                      id="batch-file-input"
                      multiple
                      onChange={handleBatchFilesChange}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      className="hidden"
                    />
                    <label htmlFor="batch-file-input" className="cursor-pointer space-y-2 block">
                      <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 mx-auto flex items-center justify-center">
                        <FolderUp className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-teal-700 hover:underline">
                          Select multiple files for batch upload
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Hold Ctrl/Cmd to select multiple laboratory files (Max 8MB each)
                        </p>
                      </div>
                    </label>
                  </div>

                  {batchFiles.length > 0 && (
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center justify-between">
                        <span>Selected Batch Files ({batchFiles.length})</span>
                        <button
                          type="button"
                          onClick={() => setBatchFiles([])}
                          className="text-rose-600 hover:underline text-[11px]"
                        >
                          Clear All
                        </button>
                      </div>
                      {batchFiles.map((f, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                          <div className="flex items-center gap-2 truncate max-w-sm">
                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">{f.name}</span>
                            <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchFile(idx)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Remove from batch"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800">HIPAA Compliant Document Isolation</span>
                <p>
                  Files are stored in the server's isolated document vault outside public web roots. Reports are
                  accessible only by authorized clinicians, lab technicians, and the verified patient.
                </p>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Link to="/lab">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                isLoading={isUploading}
                disabled={patients.length === 0 || (!isBatchMode && !singleFile) || (isBatchMode && batchFiles.length === 0)}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[160px]"
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : isBatchMode ? `Upload Batch (${batchFiles.length})` : 'Upload Report'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
