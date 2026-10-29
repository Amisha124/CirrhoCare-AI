import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { BiomarkerFlag, Patient, Prediction, RiskLevel } from '@/types';

// Reference intervals for clinical biomarkers
export interface BiomarkerConfig {
  key: 'bilirubin' | 'albumin' | 'platelets' | 'sgot' | 'sgpt' | 'prothrombin';
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin?: number;
  criticalMax?: number;
  description: string;
}

const BIOMARKER_METRICS: BiomarkerConfig[] = [
  {
    key: 'bilirubin',
    name: 'Total Bilirubin',
    unit: 'mg/dL',
    normalMin: 0.2,
    normalMax: 1.2,
    criticalMax: 3.0,
    description: 'Elevated bilirubin suggests impaired hepatic clearance or cholestasis.',
  },
  {
    key: 'albumin',
    name: 'Serum Albumin',
    unit: 'g/dL',
    normalMin: 3.5,
    normalMax: 5.0,
    criticalMin: 2.8,
    description: 'Depressed albumin reflects compromised synthetic capacity of hepatocytes.',
  },
  {
    key: 'platelets',
    name: 'Platelet Count',
    unit: 'x10³/µL',
    normalMin: 150.0,
    normalMax: 450.0,
    criticalMin: 100.0,
    description: 'Thrombocytopenia is a reliable non-invasive indicator of portal hypertension.',
  },
  {
    key: 'sgot',
    name: 'SGOT (AST)',
    unit: 'U/L',
    normalMin: 8.0,
    normalMax: 48.0,
    criticalMax: 120.0,
    description: 'Aspartate transaminase released into circulation during hepatocellular injury.',
  },
  {
    key: 'sgpt',
    name: 'SGPT (ALT)',
    unit: 'U/L',
    normalMin: 7.0,
    normalMax: 56.0,
    criticalMax: 120.0,
    description: 'Alanine transaminase specific to acute and chronic hepatocellular damage.',
  },
  {
    key: 'prothrombin',
    name: 'Prothrombin Time',
    unit: 'seconds',
    normalMin: 11.0,
    normalMax: 13.5,
    criticalMax: 15.0,
    description: 'Prolongation signifies impaired clotting factor synthesis in advanced disease.',
  },
];

type BiomarkerKey = BiomarkerConfig['key'];

export const AILiverMonitoringDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  // Primary Data State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedBiomarker, setSelectedBiomarker] = useState<BiomarkerKey>('bilirubin');

  // Patient Inspection Modal
  const [inspectedPatient, setInspectedPatient] = useState<Patient | null>(null);
  const [inspectedPatientDetails, setInspectedPatientDetails] = useState<Patient | null>(null);
  const [isLoadingInspection, setIsLoadingInspection] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Load primary data
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [patientsRes, predictionsRes] = await Promise.all([
        api.patients.list({ per_page: 100 }),
        api.predictions.list({ per_page: 100 }),
      ]);

      if (patientsRes.success) {
        setPatients(patientsRes.patients);
      }
      if (predictionsRes.success) {
        setAllPredictions(predictionsRes.predictions);
      }
    } catch (err: any) {
      error(err.message || 'Failed to retrieve liver health monitoring records');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [error]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Open Detailed Patient Inspection
  const handleInspectPatient = async (patient: Patient) => {
    setInspectedPatient(patient);
    setIsModalOpen(true);
    setIsLoadingInspection(true);

    try {
      const res = await api.patients.get(patient.id);
      if (res.success && res.patient) {
        setInspectedPatientDetails(res.patient);
      } else {
        setInspectedPatientDetails(patient);
      }
    } catch (err: any) {
      // Fallback to currently available patient data
      setInspectedPatientDetails(patient);
    } finally {
      setIsLoadingInspection(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setInspectedPatient(null);
    setInspectedPatientDetails(null);
  };

  // Helper to distinguish missing vs genuine zero
  const renderBiomarkerDisplay = (
    val: number | null | undefined,
    unit: string,
    normalMin?: number,
    normalMax?: number,
    criticalMin?: number,
    criticalMax?: number
  ) => {
    if (val === null || val === undefined) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Unmeasured
        </span>
      );
    }

    // It is a genuine measured number (including 0.0)
    let statusClass = 'text-slate-800 font-bold';
    let badgeClass = 'bg-slate-50 border-slate-200';

    if (criticalMax !== undefined && val >= criticalMax) {
      statusClass = 'text-rose-700 font-bold';
      badgeClass = 'bg-rose-50 border-rose-200';
    } else if (criticalMin !== undefined && val <= criticalMin) {
      statusClass = 'text-rose-700 font-bold';
      badgeClass = 'bg-rose-50 border-rose-200';
    } else if (normalMax !== undefined && val > normalMax) {
      statusClass = 'text-amber-700 font-semibold';
      badgeClass = 'bg-amber-50 border-amber-200';
    } else if (normalMin !== undefined && val < normalMin) {
      statusClass = 'text-amber-700 font-semibold';
      badgeClass = 'bg-amber-50 border-amber-200';
    } else {
      statusClass = 'text-emerald-700 font-semibold';
      badgeClass = 'bg-emerald-50 border-emerald-200';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${badgeClass} ${statusClass}`}>
        <span>{val.toFixed(1)}</span>
        <span className="text-[10px] font-normal text-slate-500">{unit}</span>
      </span>
    );
  };

  // 1. Liver Risk Overview Counts (strictly from actual data)
  const cohortStats = useMemo(() => {
    const total = patients.length;
    const highRisk = patients.filter((p) => p.latest_risk_label === 'High Risk').length;
    const mediumRisk = patients.filter((p) => p.latest_risk_label === 'Medium Risk').length;
    const lowRisk = patients.filter((p) => p.latest_risk_label === 'Low Risk').length;
    const pendingRisk = patients.filter(
      (p) => !p.latest_risk_label || p.latest_risk_label === 'Pending'
    ).length;

    const awaitingReview = patients.filter(
      (p) =>
        p.treatment_status === 'Needs urgent review' ||
        p.treatment_status === 'Awaiting review'
    ).length;

    const highRiskPct = total > 0 ? ((highRisk / total) * 100).toFixed(1) : '0';
    const medRiskPct = total > 0 ? ((mediumRisk / total) * 100).toFixed(1) : '0';
    const lowRiskPct = total > 0 ? ((lowRisk / total) * 100).toFixed(1) : '0';

    return {
      total,
      highRisk,
      mediumRisk,
      lowRisk,
      pendingRisk,
      awaitingReview,
      highRiskPct,
      medRiskPct,
      lowRiskPct,
    };
  }, [patients]);

  // Risk Distribution Chart Data
  const riskChartData = useMemo(() => {
    return [
      { name: 'High Risk', count: cohortStats.highRisk, color: '#F43F5E' },
      { name: 'Medium Risk', count: cohortStats.mediumRisk, color: '#F59E0B' },
      { name: 'Low Risk', count: cohortStats.lowRisk, color: '#10B981' },
      ...(cohortStats.pendingRisk > 0
        ? [{ name: 'Pending', count: cohortStats.pendingRisk, color: '#94A3B8' }]
        : []),
    ];
  }, [cohortStats]);

  // 2. Biomarker Visualization Data for Selected Metric
  const currentBiomarkerConfig = useMemo(() => {
    return (
      BIOMARKER_METRICS.find((m) => m.key === selectedBiomarker) ||
      BIOMARKER_METRICS[0]
    );
  }, [selectedBiomarker]);

  const biomarkerChartData = useMemo(() => {
    return patients
      .map((p) => {
        const val = p[selectedBiomarker] as number | null | undefined;
        return {
          id: p.id,
          name: p.full_name.replace(' [DEMO]', ''),
          portalId: p.portal_id,
          value: typeof val === 'number' ? val : null,
          isMeasured: typeof val === 'number',
          risk: p.latest_risk_label,
        };
      })
      .filter((item) => item.isMeasured);
  }, [patients, selectedBiomarker]);

  // 3. Patient Risk Explorer Filtering
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        (p.portal_id && p.portal_id.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q));

      const matchesRisk =
        riskFilter === 'All' || p.latest_risk_label === riskFilter;

      const matchesStatus =
        statusFilter === 'All' || p.treatment_status === statusFilter;

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [patients, searchQuery, riskFilter, statusFilter]);

  // 4. Clinical Review Alerts (strictly actual data)
  const patientsNeedingReview = useMemo(() => {
    return patients.filter(
      (p) =>
        p.treatment_status === 'Needs urgent review' ||
        p.treatment_status === 'Awaiting review'
    );
  }, [patients]);

  // Historical predictions for inspected patient
  const inspectedPredictions = useMemo(() => {
    if (!inspectedPatientDetails) return [];
    if (
      inspectedPatientDetails.predictions &&
      inspectedPatientDetails.predictions.length > 0
    ) {
      return [...inspectedPatientDetails.predictions].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    // Check fallback from allPredictions
    return allPredictions
      .filter((pred) => pred.patient_id === inspectedPatientDetails.id)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [inspectedPatientDetails, allPredictions]);

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <LoadingSpinner
          label="Loading CirrhoCare AI Liver Health Monitoring Dashboard..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* =========================================================================
          PAGE HEADER & CONTROLS
      ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Advanced AI Liver Health Monitoring
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200/80">
                  Decision Support
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Cohort risk stratification, longitudinal biomarker surveillance, and clinical triage tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh Data
          </Button>

          <Link to="/doctor/reviews">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Stethoscope className="w-4 h-4" />}
            >
              Clinical Reviews ({patientsNeedingReview.length})
            </Button>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          FEATURE 5: MANDATORY AI NON-DIAGNOSTIC DISCLAIMER BANNER
      ========================================================================= */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 shadow-xs flex items-start gap-3.5">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-950 flex items-center gap-2">
            <span>Experimental AI Decision-Support Estimates</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-semibold text-[10px]">
              17 Observations Benchmark
            </span>
          </p>
          <p className="text-amber-800 leading-relaxed">
            The CirrhoCare AI liver risk estimation engine uses a supervised Random Forest model trained on an experimental dataset of 17 observations.
            All AI predictions and risk categorizations are <strong>experimental decision-support estimates</strong> designed to aid clinical prioritization.
            AI results are <strong>not a definitive diagnosis and require clinician confirmation</strong> before any medical decisions or interventions are made.
            CirrhoCare AI does not claim FDA/CE approval or clinical validation without evidence.
          </p>
        </div>
      </div>

      {/* =========================================================================
          FEATURE 1: LIVER RISK OVERVIEW (ACTUAL DATA COUNTS & RECHARTS)
      ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Cohort Risk Overview</span>
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            Active Registry: <b>{cohortStats.total} Patients</b>
          </span>
        </div>

        {/* 4 Responsive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="High Risk Cirrhosis"
            value={cohortStats.highRisk}
            subtitle={`${cohortStats.highRiskPct}% of monitored cohort`}
            icon={<AlertTriangle className="w-5 h-5" />}
            accent="pink"
            trend={{
              value: `${cohortStats.highRisk} critical`,
              isPositive: false,
              label: 'Immediate review',
            }}
          />

          <KpiCard
            title="Moderate Risk (Fibrosis)"
            value={cohortStats.mediumRisk}
            subtitle={`${cohortStats.medRiskPct}% of monitored cohort`}
            icon={<Clock className="w-5 h-5" />}
            accent="orange"
            trend={{
              value: `${cohortStats.mediumRisk} monitored`,
              isPositive: true,
              label: 'Close surveillance',
            }}
          />

          <KpiCard
            title="Low Risk / Compensated"
            value={cohortStats.lowRisk}
            subtitle={`${cohortStats.lowRiskPct}% of monitored cohort`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="green"
            trend={{
              value: `${cohortStats.lowRisk} stable`,
              isPositive: true,
              label: 'Routine follow-up',
            }}
          />

          <KpiCard
            title="Awaiting Clinical Review"
            value={cohortStats.awaitingReview}
            subtitle="Requires clinician sign-off"
            icon={<Stethoscope className="w-5 h-5" />}
            accent="purple"
            trend={{
              value: `${cohortStats.awaitingReview} pending`,
              isPositive: cohortStats.awaitingReview === 0,
              label: cohortStats.awaitingReview > 0 ? 'Urgent triage' : 'Queue clear',
            }}
          />
        </div>

        {/* Risk Distribution Chart & Clinical Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-card border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Cirrhosis Risk Category Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Calculated from actual Random Forest assessment probabilities.
                  </p>
                </div>
                <Badge variant="outline" size="sm">
                  {cohortStats.total} Patients Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskChartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val} Patients`, 'Patient Count']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={48}>
                      {riskChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Triage Status Summary */}
          <Card className="shadow-card border-slate-200 flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Clinical Triage Proportions</h3>
              <p className="text-xs text-slate-500">Breakdown of patient risk tiers in active registry.</p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                {/* High Risk Tier */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-rose-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      High Risk (Tier 3)
                    </span>
                    <span className="font-semibold text-slate-700">
                      {cohortStats.highRisk} ({cohortStats.highRiskPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${cohortStats.highRiskPct}%` }}
                    />
                  </div>
                </div>

                {/* Moderate Risk Tier */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-amber-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Moderate Risk (Tier 2)
                    </span>
                    <span className="font-semibold text-slate-700">
                      {cohortStats.mediumRisk} ({cohortStats.medRiskPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${cohortStats.medRiskPct}%` }}
                    />
                  </div>
                </div>

                {/* Low Risk Tier */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Low Risk (Tier 1)
                    </span>
                    <span className="font-semibold text-slate-700">
                      {cohortStats.lowRisk} ({cohortStats.lowRiskPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${cohortStats.lowRiskPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Triage Threshold Guidelines:</p>
                <p>• <b>High Risk (&gt;65%):</b> Immediate hepatologist evaluation, ultrasound, and variceal screening.</p>
                <p>• <b>Medium Risk (35-65%):</b> Serial biomarker monitoring every 3 to 6 months.</p>
                <p>• <b>Low Risk (&lt;35%):</b> Routine lifestyle and annual liver function checks.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 4: CLINICAL REVIEW ALERTS (ACTUAL DATA ONLY)
      ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Clinical Review Alerts</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
              {patientsNeedingReview.length} Actionable
            </span>
          </div>
          <Link
            to="/doctor/reviews"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
          >
            <span>Open Clinical Workstation</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {patientsNeedingReview.length === 0 ? (
          <Card className="p-6 text-center border-emerald-200 bg-emerald-50/50">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-bold text-emerald-950 text-sm">All Clinical Reviews Up to Date</h4>
            <p className="text-xs text-emerald-700 mt-1">
              No patient records currently require urgent physician review or treatment sign-off.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {patientsNeedingReview.map((patient) => {
              const isUrgent = patient.treatment_status === 'Needs urgent review';
              return (
                <div
                  key={`alert-${patient.id}`}
                  className={`p-4 rounded-2xl border transition-all duration-200 hover:shadow-md bg-white ${
                    isUrgent
                      ? 'border-rose-200/90 shadow-rose-500/5'
                      : 'border-amber-200/90 shadow-amber-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{patient.full_name}</p>
                      <p className="text-xs font-mono text-slate-500">{patient.portal_id}</p>
                    </div>
                    <Badge risk={patient.latest_risk_label} size="sm" />
                  </div>

                  <div className="text-xs space-y-1.5 py-2 border-y border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          isUrgent
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {patient.treatment_status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Risk Score:</span>
                      <span className="font-bold text-slate-800">
                        {patient.latest_risk_percent}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Bilirubin:</span>
                      <span className="font-medium text-slate-700">
                        {patient.bilirubin != null ? `${patient.bilirubin} mg/dL` : 'Unmeasured'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleInspectPatient(patient)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Inspect
                    </button>

                    <Link
                      to={`/doctor/reviews?patient_id=${patient.id}`}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition inline-flex items-center gap-1"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          FEATURE 2: BIOMARKER VISUALIZATION & CLINICAL REFERENCE BOUNDARIES
      ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-teal-600" />
              <span>Biomarker Cohort Surveillance</span>
            </h2>
            <p className="text-xs text-slate-500">
              Comparative visualization distinguishing measured values from unmeasured markers.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {BIOMARKER_METRICS.map((metric) => (
              <button
                key={metric.key}
                onClick={() => setSelectedBiomarker(metric.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedBiomarker === metric.key
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {metric.name}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Biomarker Details & Reference BarChart */}
        <Card className="shadow-card border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {currentBiomarkerConfig.name} ({currentBiomarkerConfig.unit}) across Patients
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentBiomarkerConfig.description}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  Normal: {currentBiomarkerConfig.normalMin} - {currentBiomarkerConfig.normalMax} {currentBiomarkerConfig.unit}
                </span>
                {currentBiomarkerConfig.criticalMax && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    Critical: &gt; {currentBiomarkerConfig.criticalMax} {currentBiomarkerConfig.unit}
                  </span>
                )}
                {currentBiomarkerConfig.criticalMin && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    Critical: &lt; {currentBiomarkerConfig.criticalMin} {currentBiomarkerConfig.unit}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {biomarkerChartData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No measured values recorded for {currentBiomarkerConfig.name} in current patient records.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={biomarkerChartData}
                    margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: any, item: any) => [
                        `${val} ${currentBiomarkerConfig.unit}`,
                        currentBiomarkerConfig.name,
                      ]}
                      labelFormatter={(label: any) => `Patient: ${label}`}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                      {biomarkerChartData.map((entry, idx) => {
                        let fill = '#14B8A6'; // teal default normal
                        if (
                          currentBiomarkerConfig.criticalMax &&
                          entry.value! >= currentBiomarkerConfig.criticalMax
                        ) {
                          fill = '#F43F5E'; // rose critical
                        } else if (
                          currentBiomarkerConfig.criticalMin &&
                          entry.value! <= currentBiomarkerConfig.criticalMin
                        ) {
                          fill = '#F43F5E'; // rose critical
                        } else if (
                          entry.value! > currentBiomarkerConfig.normalMax ||
                          entry.value! < currentBiomarkerConfig.normalMin
                        ) {
                          fill = '#F59E0B'; // amber warning
                        }
                        return <Cell key={`biomarker-cell-${idx}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* =========================================================================
          FEATURE 3: PATIENT RISK EXPLORER WITH COMPREHENSIVE FILTERS
      ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Patient Risk Explorer</span>
            </h2>
            <p className="text-xs text-slate-500">
              Interactive patient surveillance table with live clinical markers and assessment inspection.
            </p>
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            Showing {filteredPatients.length} of {patients.length} patients
          </span>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4 shadow-card border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
              />
            </div>

            {/* Risk Category Filter */}
            <div>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50 font-medium text-slate-700"
              >
                <option value="All">All Risk Tiers</option>
                <option value="High Risk">High Risk</option>
                <option value="Medium Risk">Medium Risk</option>
                <option value="Low Risk">Low Risk</option>
                <option value="Pending">Pending Evaluation</option>
              </select>
            </div>

            {/* Clinical Treatment Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50 font-medium text-slate-700"
              >
                <option value="All">All Clinical Statuses</option>
                <option value="Needs urgent review">Needs urgent review</option>
                <option value="Awaiting review">Awaiting review</option>
                <option value="Under treatment">Under treatment</option>
                <option value="Stable">Stable</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setSearchQuery('');
                  setRiskFilter('All');
                  setStatusFilter('All');
                }}
                disabled={!searchQuery && riskFilter === 'All' && statusFilter === 'All'}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Patient Table */}
        <Card className="shadow-card border-slate-200 overflow-hidden">
          {filteredPatients.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No Matching Patients"
                description="No patient records match the applied search query or risk filters."
                actionLabel="Clear Filters"
                onAction={() => {
                  setSearchQuery('');
                  setRiskFilter('All');
                  setStatusFilter('All');
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Patient Profile</th>
                    <th className="py-3 px-4">Demographics</th>
                    <th className="py-3 px-4">CirrhoCare AI Risk</th>
                    <th className="py-3 px-4">Clinical Status</th>
                    <th className="py-3 px-4">Key Biomarkers</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPatients.map((p) => (
                    <tr
                      key={`patient-row-${p.id}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {p.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">
                              {p.full_name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              ID: {p.portal_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Demographics */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {p.age} yrs · {p.gender}
                      </td>

                      {/* CirrhoCare AI Risk */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Badge risk={p.latest_risk_label} size="sm" />
                          <span className="font-bold text-slate-800 text-xs">
                            {p.latest_risk_percent}%
                          </span>
                        </div>
                      </td>

                      {/* Clinical Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-md border text-[11px] ${
                            p.treatment_status === 'Needs urgent review'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : p.treatment_status === 'Awaiting review'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : p.treatment_status === 'Under treatment'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {p.treatment_status}
                        </span>
                      </td>

                      {/* Biomarker Chips (Accurately Distinguishing Unmeasured vs Zero) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div title="Total Bilirubin (Normal: 0.2 - 1.2 mg/dL)">
                            {renderBiomarkerDisplay(p.bilirubin, 'mg/dL', 0.2, 1.2, undefined, 3.0)}
                          </div>
                          <div title="Serum Albumin (Normal: 3.5 - 5.0 g/dL)">
                            {renderBiomarkerDisplay(p.albumin, 'g/dL', 3.5, 5.0, 2.8, undefined)}
                          </div>
                          <div title="Platelets (Normal: 150 - 450 x10³/µL)">
                            {renderBiomarkerDisplay(p.platelets, 'x10³', 150.0, 450.0, 100.0, undefined)}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleInspectPatient(p)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition inline-flex items-center gap-1"
                            title="Inspect AI Assessment and Biomarker Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          <Link
                            to={`/doctor/reviews?patient_id=${p.id}`}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition inline-flex items-center gap-1"
                            title="Open in Clinical Reviews Workspace"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* =========================================================================
          FEATURE 5: AI ASSESSMENT DETAILS & HISTORICAL TREND INSPECTION MODAL
      ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>AI Liver Assessment Details</span>
            {inspectedPatientDetails && (
              <span className="text-xs font-mono font-normal text-slate-500">
                ({inspectedPatientDetails.portal_id})
              </span>
            )}
          </div>
        }
        description="Comprehensive diagnostic model inputs, clinical biomarker flags, and longitudinal history."
      >
        {isLoadingInspection || !inspectedPatientDetails ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner label="Loading full clinical evaluation records..." />
          </div>
        ) : (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Patient Header Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {inspectedPatientDetails.full_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Age: <b>{inspectedPatientDetails.age}</b> · Gender: <b>{inspectedPatientDetails.gender}</b> · Portal ID: <b className="font-mono">{inspectedPatientDetails.portal_id}</b>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge risk={inspectedPatientDetails.latest_risk_label} size="md" />
                <span className="text-base font-extrabold text-slate-900">
                  {inspectedPatientDetails.latest_risk_percent}%
                </span>
              </div>
            </div>

            {/* Model Assessment Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/80">
                <p className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider">
                  Model Algorithm
                </p>
                <p className="text-sm font-bold text-purple-950 mt-1">
                  Random Forest Classifier
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Experimental model (17 observations)
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">
                  Evaluation Date
                </p>
                <p className="text-sm font-bold text-blue-950 mt-1">
                  {inspectedPatientDetails.updated_at
                    ? new Date(inspectedPatientDetails.updated_at).toLocaleDateString()
                    : inspectedPatientDetails.created_at
                    ? new Date(inspectedPatientDetails.created_at).toLocaleDateString()
                    : 'Recent'}
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Status: {inspectedPatientDetails.treatment_status}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Confidence Score
                </p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {inspectedPredictions.length > 0 && inspectedPredictions[0].confidence != null
                    ? `${inspectedPredictions[0].confidence.toFixed(1)}%`
                    : 'Unspecified'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Decision-support concordance
                </p>
              </div>
            </div>

            {/* Automated Biomarker Flags from Clinical Evaluator */}
            {inspectedPatientDetails.evaluation && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Clinical Rule-Based Reference Flags
                </h4>

                {inspectedPatientDetails.evaluation.flags.length === 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No critical or warning laboratory biomarker thresholds exceeded.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inspectedPatientDetails.evaluation.flags.map((flag: BiomarkerFlag, i: number) => (
                      <div
                        key={`flag-${i}`}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                          flag.severity === 'critical'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <AlertCircle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            flag.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        />
                        <div>
                          <p className="font-bold">
                            {flag.marker}: {flag.value} {flag.unit}
                          </p>
                          <p className="text-[11px] opacity-90">{flag.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Physical Clinical Signs */}
                {inspectedPatientDetails.evaluation.clinical_signs.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs font-semibold text-slate-600">Physical Signs:</span>
                    {inspectedPatientDetails.evaluation.clinical_signs.map((sign: string, idx: number) => (
                      <span
                        key={`sign-${idx}`}
                        className="px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200"
                      >
                        {sign}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All 17 Clinical Inputs Grid */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Model Clinical Inputs (17 Parameters)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Bilirubin</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.bilirubin != null ? `${inspectedPatientDetails.bilirubin} mg/dL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Albumin</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.albumin != null ? `${inspectedPatientDetails.albumin} g/dL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Platelets</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.platelets != null ? `${inspectedPatientDetails.platelets} x10³/µL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">SGOT (AST)</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.sgot != null ? `${inspectedPatientDetails.sgot} U/L` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">SGPT (ALT)</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.sgpt != null ? `${inspectedPatientDetails.sgpt} U/L` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Prothrombin</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.prothrombin != null ? `${inspectedPatientDetails.prothrombin} s` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cholesterol</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.cholesterol != null ? `${inspectedPatientDetails.cholesterol} mg/dL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Copper</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.copper != null ? `${inspectedPatientDetails.copper} µg/dL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Alk Phos</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.alk_phos != null ? `${inspectedPatientDetails.alk_phos} U/L` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Triglycerides</span>
                  <span className="font-bold text-slate-800">
                    {inspectedPatientDetails.triglycerides != null ? `${inspectedPatientDetails.triglycerides} mg/dL` : 'Unmeasured'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Ascites</span>
                  <span className={`font-bold ${inspectedPatientDetails.ascites ? 'text-rose-700' : 'text-slate-800'}`}>
                    {inspectedPatientDetails.ascites ? 'Present' : 'Absent'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Hepatomegaly</span>
                  <span className={`font-bold ${inspectedPatientDetails.hepatomegaly ? 'text-rose-700' : 'text-slate-800'}`}>
                    {inspectedPatientDetails.hepatomegaly ? 'Present' : 'Absent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Longitudinal Historical Trend (Feature 2 requirement: only when historical data exists) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Longitudinal Risk Progression</span>
              </h4>

              {inspectedPredictions.length > 1 ? (
                <div>
                  <div className="h-48 w-full p-2 bg-slate-50 rounded-2xl border border-slate-200">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...inspectedPredictions]
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((pred) => ({
                            date: new Date(pred.created_at).toLocaleDateString(),
                            probability: (pred.probability * 100).toFixed(1),
                            risk: pred.risk_label,
                          }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} />
                        <YAxis
                          unit="%"
                          domain={[0, 100]}
                          tick={{ fill: '#64748B', fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(val: any) => [`${val}%`, 'Cirrhosis Probability']}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '11px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="probability"
                          stroke="#8B5CF6"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#8B5CF6' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-slate-500 italic mt-1.5">
                    Note: Recorded sequential measurements are displayed in chronological order. Two measurements alone do not establish clinical progression.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-slate-200/70">
                    <div>
                      <span className="font-semibold text-slate-700">Current Available Assessment:</span>{' '}
                      <span className="font-bold text-purple-700">
                        {inspectedPatientDetails.latest_risk_percent}% ({inspectedPatientDetails.latest_risk_label})
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Assessment Date:{' '}
                      <span className="font-semibold text-slate-700">
                        {inspectedPatientDetails.updated_at
                          ? new Date(inspectedPatientDetails.updated_at).toLocaleDateString()
                          : inspectedPatientDetails.created_at
                          ? new Date(inspectedPatientDetails.created_at).toLocaleDateString()
                          : 'Baseline assessment'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>A longitudinal trend will be available after another laboratory assessment is recorded.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                CirrhoCare AI • Clinical Decision Support System v1.0
              </span>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCloseModal}>
                  Close
                </Button>
                <Link to={`/doctor/reviews?patient_id=${inspectedPatientDetails.id}`}>
                  <Button variant="primary" size="sm" leftIcon={<Stethoscope className="w-4 h-4" />}>
                    Review & Prescribe
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
