import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileText,
  FlaskConical,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';
import type { BiomarkerFlag, Patient } from '@/types';

export const AIPredictionReviewPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(true);

  // Form inputs
  const [age, setAge] = useState<number>(50);
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [bilirubin, setBilirubin] = useState<number>(1.0);
  const [albumin, setAlbumin] = useState<number>(3.8);
  const [sgot, setSgot] = useState<number>(35.0);
  const [sgpt, setSgpt] = useState<number>(30.0);
  const [platelets, setPlatelets] = useState<number>(220.0);
  const [cholesterol, setCholesterol] = useState<number>(190.0);
  const [prothrombin, setProthrombin] = useState<number>(11.5);
  const [copper, setCopper] = useState<number>(75.0);
  const [alkPhos, setAlkPhos] = useState<number>(700.0);
  const [triglycerides, setTriglycerides] = useState<number>(120.0);
  const [ascites, setAscites] = useState<boolean>(false);
  const [hepatomegaly, setHepatomegaly] = useState<boolean>(false);
  const [spiders, setSpiders] = useState<boolean>(false);
  const [edema, setEdema] = useState<boolean>(false);

  // Prediction State
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<{
    probability: number;
    risk_label: string;
    confidence: number;
    model_accuracy?: number;
    biomarker_flags?: BiomarkerFlag[];
    clinical_signs?: string[];
  } | null>(null);

  // Patient Prediction History
  const [predictionHistory, setPredictionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoadingPatients(true);
      try {
        const res = await api.patients.list({ per_page: 50 });
        if (res.success) {
          setPatients(res.patients);
        }
      } catch (err: any) {
        error(err.message || 'Failed to load patients list');
      } finally {
        setIsLoadingPatients(false);
      }
    };
    fetchPatients();
  }, []);

  const handlePatientSelect = async (patientIdStr: string) => {
    setSelectedPatientId(patientIdStr);
    if (!patientIdStr) {
      setPredictionHistory([]);
      return;
    }

    const patient = patients.find((p) => p.id === parseInt(patientIdStr, 10));
    if (patient) {
      setAge(patient.age);
      setGender((patient.gender === 'Female' ? 'Female' : 'Male'));
      setBilirubin(patient.bilirubin || 0);
      setAlbumin(patient.albumin || 0);
      setSgot(patient.sgot || 0);
      setSgpt(patient.sgpt || 0);
      setPlatelets(patient.platelets || 0);
      setCholesterol(patient.cholesterol || 0);
      setProthrombin(patient.prothrombin || 0);
      setCopper(patient.copper || 0);
      setAlkPhos(patient.alk_phos || 0);
      setTriglycerides(patient.triglycerides || 0);
      setAscites(Boolean(patient.ascites));
      setHepatomegaly(Boolean(patient.hepatomegaly));
      setSpiders(Boolean(patient.spiders));
      setEdema(Boolean(patient.edema));
    }

    // Fetch previous predictions for this patient
    setIsLoadingHistory(true);
    try {
      const res = await api.predict.history(parseInt(patientIdStr, 10));
      if (res.success) {
        setPredictionHistory(res.predictions || []);
      }
    } catch {
      setPredictionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRunPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPredicting(true);

    const payload = {
      age,
      gender: gender.toLowerCase(),
      bilirubin,
      albumin,
      sgot,
      sgpt,
      platelets,
      cholesterol,
      prothrombin,
      copper,
      alk_phos: alkPhos,
      triglycerides,
      ascites,
      hepatomegaly,
      spiders,
      edema,
    };

    try {
      const res = await api.predict.direct(payload);
      if (res.success) {
        setPredictionResult(res);
        success('AI Risk Prediction computed successfully.');
      }
    } catch (err: any) {
      error(err.message || 'Prediction failed. Check input boundaries.');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-600" />
            AI Cirrhosis Risk Engine & Clinical Decision Support
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Simulate cirrhosis progression risk, review diagnostic thresholds, and inspect historical AI predictions.
          </p>
        </div>
      </div>

      {/* Prominent Clinical Disclaimer & Dataset Limitations Alert */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-950 space-y-2 shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
            Mandatory Clinical Decision-Support Disclaimer & Model Limitations
          </h3>
        </div>
        <div className="text-xs space-y-1.5 text-amber-900 leading-relaxed pl-7">
          <p>
            <strong>Decision Support Only:</strong> CirrhoCare AI prediction outputs represent statistical inference calculated by a scikit-learn Random Forest model. These results are decision-support aids and do <strong>not</strong> establish a definitive clinical diagnosis. Final clinical diagnosis and staging require qualified hepatologist examination.
          </p>
          <p className="text-amber-800">
            <strong>Training Dataset Limitation:</strong> The underlying machine learning model was trained on an experimental benchmark dataset containing 17 observations. Its outputs must be treated as experimental and corroborated with certified diagnostic laboratory tests, clinical imaging, and biopsy results.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Input Parameters & Patient Selection */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Biomarker Parameter Inputs
                </h3>
                <p className="text-xs text-slate-500">
                  Select an authorized patient or input custom values to run live model inference.
                </p>
              </div>

              {/* Patient Selector */}
              <div className="w-full sm:w-60">
                <select
                  value={selectedPatientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-800 font-medium"
                >
                  <option value="">Prefill from Patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.portal_id})
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <form onSubmit={handleRunPrediction} className="space-y-4">
                {/* Demographics */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Patient Age (Years)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Biological Sex</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'Male' | 'Female')}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                {/* 10 Numerical Biomarkers Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Serum Chemistry & Liver Function Tests
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Bilirubin <span className="text-[10px] text-slate-400">(0.2 - 1.2 mg/dL)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={bilirubin}
                        onChange={(e) => setBilirubin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Albumin <span className="text-[10px] text-slate-400">(3.5 - 5.0 g/dL)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={albumin}
                        onChange={(e) => setAlbumin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Platelets <span className="text-[10px] text-slate-400">(150 - 450 x10³/µL)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={platelets}
                        onChange={(e) => setPlatelets(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        SGOT / AST <span className="text-[10px] text-slate-400">(8 - 48 U/L)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={sgot}
                        onChange={(e) => setSgot(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        SGPT / ALT <span className="text-[10px] text-slate-400">(7 - 56 U/L)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={sgpt}
                        onChange={(e) => setSgpt(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Prothrombin <span className="text-[10px] text-slate-400">(11.0 - 13.5 s)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={prothrombin}
                        onChange={(e) => setProthrombin(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Cholesterol <span className="text-[10px] text-slate-400">(mg/dL)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={cholesterol}
                        onChange={(e) => setCholesterol(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Copper <span className="text-[10px] text-slate-400">(µg/dL)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={copper}
                        onChange={(e) => setCopper(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Alk Phos <span className="text-[10px] text-slate-400">(U/L)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={alkPhos}
                        onChange={(e) => setAlkPhos(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Triglycerides <span className="text-[10px] text-slate-400">(mg/dL)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={triglycerides}
                        onChange={(e) => setTriglycerides(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 4 Physical Signs Checkboxes */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Physical Stigmata & Clinical Signs
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={ascites}
                        onChange={(e) => setAscites(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Ascites</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={hepatomegaly}
                        onChange={(e) => setHepatomegaly(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Hepatomegaly</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={spiders}
                        onChange={(e) => setSpiders(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Spider Angiomas</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={edema}
                        onChange={(e) => setEdema(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Edema</span>
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isPredicting}
                    className="bg-purple-600 hover:bg-purple-700 text-xs"
                    leftIcon={<Sparkles className="w-4 h-4" />}
                  >
                    {isPredicting ? 'Executing Random Forest Inference...' : 'Run Cirrhosis Risk Prediction'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Live Prediction Gauge & Historical Logs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Result Gauge Card */}
          <Card className="border-purple-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-t-2xl p-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-300" />
                Live Model Inference Output
              </h3>
              <p className="text-[11px] text-purple-200/80">
                Random Forest Classifier · Cirrhosis Probability
              </p>
            </CardHeader>

            <CardContent className="p-5">
              {!predictionResult ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
                  <p>Execute the model simulation to evaluate cirrhosis risk.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Probability Gauge & Label */}
                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Badge risk={predictionResult.risk_label as any} size="md" />
                    </div>
                    <div className="text-4xl font-black text-purple-950 tracking-tight">
                      {predictionResult.probability}%
                    </div>
                    <p className="text-xs text-slate-600">
                      Estimated Cirrhosis Risk Probability
                    </p>
                    <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>Confidence: <strong>{predictionResult.confidence}%</strong></span>
                      <span>Model: <strong>Random Forest</strong></span>
                    </div>
                  </div>

                  {/* Abnormal Flags */}
                  {(predictionResult.biomarker_flags || []).length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Biomarker Flags Detected
                      </h4>
                      {predictionResult.biomarker_flags?.map((f, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                            f.severity === 'critical'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            <strong>{f.marker}:</strong> {f.message} ({f.value} {f.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Present Signs */}
                  {(predictionResult.clinical_signs || []).length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Present Physical Signs
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {predictionResult.clinical_signs?.map((s, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200"
                          >
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Patient Historical Predictions Log */}
          {selectedPatientId && (
            <Card>
              <CardHeader className="p-4 border-b border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Historical Predictions for Selected Patient
                </h4>
              </CardHeader>
              <CardContent className="p-3">
                {isLoadingHistory ? (
                  <div className="py-4">
                    <LoadingSpinner fullScreen={false} label="Loading history..." />
                  </div>
                ) : predictionHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No past predictions stored for this patient.</p>
                ) : (
                  <div className="space-y-2">
                    {predictionHistory.map((h) => (
                      <div
                        key={h.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Badge risk={h.risk_label} size="sm" />
                            <strong className="text-slate-800">{h.probability}%</strong>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {h.created_at ? new Date(h.created_at).toLocaleString() : 'Past'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Conf: {h.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
