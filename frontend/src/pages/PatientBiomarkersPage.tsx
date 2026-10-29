import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';
import type { Patient, PatientDashboardData } from '@/types';

interface BiomarkerSpec {
  key: keyof Patient;
  name: string;
  shortName: string;
  unit: string;
  refRange: string;
  lowNormal: number;
  highNormal: number;
  color: string;
  gradientId: string;
  description: string;
}

const BIOMARKER_SPECS: BiomarkerSpec[] = [
  {
    key: 'bilirubin',
    name: 'Total Serum Bilirubin',
    shortName: 'Bilirubin',
    unit: 'mg/dL',
    refRange: '0.2 - 1.2 mg/dL',
    lowNormal: 0.2,
    highNormal: 1.2,
    color: '#F59E0B',
    gradientId: 'biliGrad',
    description: 'Measures bile pigment metabolism; elevation can indicate hepatocellular dysfunction or biliary obstruction.',
  },
  {
    key: 'albumin',
    name: 'Serum Albumin',
    shortName: 'Albumin',
    unit: 'g/dL',
    refRange: '3.5 - 5.0 g/dL',
    lowNormal: 3.5,
    highNormal: 5.0,
    color: '#0D9488',
    gradientId: 'albGrad',
    description: 'Primary protein synthesized by the liver reflecting hepatic protein synthesis capacity.',
  },
  {
    key: 'platelets',
    name: 'Platelet Count',
    shortName: 'Platelets',
    unit: '10³/µL',
    refRange: '150 - 450 10³/µL',
    lowNormal: 150,
    highNormal: 450,
    color: '#6366F1',
    gradientId: 'pltGrad',
    description: 'Thrombocyte count; thrombocytopenia often correlates with portal hypertension and splenic sequestration.',
  },
  {
    key: 'sgot',
    name: 'SGOT (AST)',
    shortName: 'SGOT / AST',
    unit: 'U/L',
    refRange: '10 - 40 U/L',
    lowNormal: 10,
    highNormal: 40,
    color: '#EC4899',
    gradientId: 'astGrad',
    description: 'Aspartate aminotransferase; intracellular enzyme released during acute or chronic hepatocellular injury.',
  },
  {
    key: 'sgpt',
    name: 'SGPT (ALT)',
    shortName: 'SGPT / ALT',
    unit: 'U/L',
    refRange: '7 - 56 U/L',
    lowNormal: 7,
    highNormal: 56,
    color: '#8B5CF6',
    gradientId: 'altGrad',
    description: 'Alanine aminotransferase; highly specific marker of active liver cellular inflammation.',
  },
  {
    key: 'prothrombin',
    name: 'Prothrombin Time',
    shortName: 'PT / INR',
    unit: 'seconds',
    refRange: '11.0 - 13.5 s',
    lowNormal: 11.0,
    highNormal: 13.5,
    color: '#EF4444',
    gradientId: 'ptGrad',
    description: 'Coagulation assessment measuring hepatic synthesis of vitamin-K-dependent clotting factors.',
  },
  {
    key: 'alk_phos',
    name: 'Alkaline Phosphatase',
    shortName: 'Alk. Phos.',
    unit: 'U/L',
    refRange: '44 - 147 U/L',
    lowNormal: 44,
    highNormal: 147,
    color: '#14B8A6',
    gradientId: 'alpGrad',
    description: 'Biliary enzyme sensitive to bile duct inflammation, cholestasis, and bone turnover.',
  },
];

export const PatientBiomarkersPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [latestPatient, setLatestPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<Patient[]>([]);
  const [selectedBiomarkerKey, setSelectedBiomarkerKey] = useState<keyof Patient>('bilirubin');

  const fetchData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const res = await api.dashboard.getStats<PatientDashboardData>();
      if (res && res.success) {
        setLatestPatient(res.latest_record || null);
        setRecords(res.records || (res.latest_record ? [res.latest_record] : []));
      } else {
        setErrorMessage('Failed to load personalized biomarker history.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve clinical biomarkers from server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const activeSpec = useMemo(
    () => BIOMARKER_SPECS.find((s) => s.key === selectedBiomarkerKey) || BIOMARKER_SPECS[0],
    [selectedBiomarkerKey]
  );

  // Build chronological chart data strictly from actual database records
  const chartData = useMemo(() => {
    if (!records || records.length === 0) return [];

    // Sort ascending by created_at
    const sorted = [...records].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    return sorted
      .map((r, index) => {
        const rawVal = r[activeSpec.key];
        const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
        const dateStr = r.created_at
          ? new Date(r.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : `Evaluation #${index + 1}`;

        return {
          id: r.id,
          date: dateStr,
          timestamp: r.created_at ? new Date(r.created_at).getTime() : index,
          value: !isNaN(numVal) ? Number(numVal.toFixed(1)) : null,
          portalId: r.portal_id,
          treatmentStatus: r.treatment_status,
          riskLabel: r.latest_risk_label,
        };
      })
      .filter((pt) => pt.value !== null);
  }, [records, activeSpec]);

  if (isLoading && !latestPatient) {
    return (
      <div className="py-24">
        <LoadingSpinner fullScreen={false} label="Retrieving your certified laboratory biomarker history..." />
      </div>
    );
  }

  if (errorMessage && !latestPatient) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 mx-auto bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-rose-900">Biomarker History Access Alert</h3>
        <p className="text-xs text-rose-700 leading-relaxed max-w-md mx-auto">{errorMessage}</p>
        <Button
          variant="primary"
          onClick={fetchData}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl shadow-teal-950/20 relative overflow-hidden border border-teal-800/40">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Activity className="w-80 h-80 text-teal-300" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 backdrop-blur-md border border-teal-400/30">
                <HeartPulse className="w-3.5 h-3.5 text-teal-300" />
                Laboratory Diagnostics & Longitudinal Tracking
              </span>
              <span className="text-teal-400/80 text-xs font-medium">• Certified Blood Chemistry</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Biomarker Profile & Trends
            </h1>
            <p className="text-teal-100/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              Track clinical liver function biomarkers over time. All data is backed directly by authorized laboratory panels recorded by your healthcare team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/patient/appointments">
              <Button
                variant="primary"
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20 text-xs"
                leftIcon={<Calendar className="w-4 h-4 text-slate-950" />}
              >
                Schedule Follow-up
              </Button>
            </Link>
            <Link to="/patient/reports">
              <Button
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md shadow-sm text-xs"
                leftIcon={<FileText className="w-4 h-4 text-teal-300" />}
              >
                Diagnostic Reports
              </Button>
            </Link>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition disabled:opacity-50"
              title="Refresh biomarker data"
              aria-label="Refresh biomarker data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Longitudinal Biomarker History Chart */}
      <Card className="border-slate-200/80 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Longitudinal Biomarker History Chart
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any biomarker below to inspect historical measurements and physiological reference bounds.
            </p>
          </div>

          {/* Biomarker Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
            {BIOMARKER_SPECS.map((spec) => (
              <button
                key={spec.key}
                type="button"
                onClick={() => setSelectedBiomarkerKey(spec.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  selectedBiomarkerKey === spec.key
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {spec.shortName}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Active Biomarker Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-slate-900">{activeSpec.name}</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                  {activeSpec.unit}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">{activeSpec.description}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Standard Clinical Reference Range
              </span>
              <span className="text-xs font-black text-slate-800">{activeSpec.refRange}</span>
            </div>
          </div>

          {/* Chart Rendering */}
          <div className="min-h-72 w-full flex items-center justify-center">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id={activeSpec.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeSpec.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={activeSpec.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    unit={` ${activeSpec.unit.split('/')[0]}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      const isOutOfRange =
                        pt.value < activeSpec.lowNormal || pt.value > activeSpec.highNormal;
                      return (
                        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
                          <p className="font-bold text-slate-200">{pt.date}</p>
                          <p className="text-sm font-black text-teal-300">
                            {pt.value} {activeSpec.unit}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Reference: {activeSpec.refRange}
                          </p>
                          {isOutOfRange && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                              ⚠️ Outside Standard Range
                            </span>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={activeSpec.highNormal}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{ value: 'Upper Normal', fill: '#D97706', fontSize: 10, position: 'right' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={activeSpec.shortName}
                    stroke={activeSpec.color}
                    strokeWidth={2.5}
                    fill={`url(#${activeSpec.gradientId})`}
                    dot={{ fill: activeSpec.color, r: 4, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: activeSpec.color }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : chartData.length === 1 ? (
              <div className="w-full p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mb-1">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Current Available Assessment: {chartData[0].value} {activeSpec.unit}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assessment Date: {chartData[0].date}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/80 max-w-lg mx-auto text-xs text-slate-600 flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>A longitudinal trend will be available after another laboratory assessment is recorded.</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Activity className="w-8 h-8 text-slate-400" />}
                title="No Historical Measurements Recorded"
                description={`No laboratory panel records are available for ${activeSpec.name}. Once lab results are entered, longitudinal trends will appear here automatically.`}
                className="py-12"
              />
            )}
          </div>

          {chartData.length >= 2 && (
            <p className="text-[11px] text-slate-500 text-center italic mt-2">
              Note: Recorded sequential measurements are displayed in chronological order. Two measurements alone do not establish clinical progression.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Comprehensive Latest Lab Panel Summary */}
      <Card className="border-slate-200/80 shadow-md">
        <CardHeader className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Latest Laboratory Panel Values & Reference Ranges
              </h3>
              <p className="text-xs text-slate-500">
                Current physiological values recorded by certified clinical lab specialists
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
            Subject: {latestPatient?.portal_id || user?.portal_id || 'PENDING'}
          </span>
        </CardHeader>

        <CardContent className="p-6">
          {latestPatient ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {BIOMARKER_SPECS.map((spec) => {
                const val = latestPatient[spec.key];
                const num = typeof val === 'number' ? val : Number(val);
                const hasValue = !isNaN(num) && val !== null && val !== undefined;
                const isHigh = hasValue && num > spec.highNormal;
                const isLow = hasValue && num < spec.lowNormal;
                const isNormal = hasValue && !isHigh && !isLow;

                return (
                  <div
                    key={spec.key}
                    onClick={() => setSelectedBiomarkerKey(spec.key)}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-left ${
                      selectedBiomarkerKey === spec.key
                        ? 'ring-2 ring-teal-500 border-teal-300 bg-teal-50/30'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        {spec.shortName}
                      </span>
                      {hasValue && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isNormal
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isNormal ? 'Normal' : isHigh ? 'High' : 'Low'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-slate-900">
                        {hasValue ? num : 'N/A'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{spec.unit}</span>
                    </div>

                    <span className="text-[10px] text-slate-400 block mt-1">
                      Ref: {spec.refRange}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FlaskConical className="w-8 h-8 text-slate-400" />}
              title="No Biomarker Records on File"
              description="Your primary health record does not have quantitative blood chemistry measurements recorded yet."
              actionLabel="Schedule Clinical Intake"
              onAction={() => window.location.assign('/patient/appointments')}
              className="py-12"
            />
          )}
        </CardContent>
      </Card>

      {/* 4. Advisory AI Model Disclaimer Notice */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-3.5 shadow-2xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-amber-950">
            Clinical AI Decision-Support Notice & Medical Guidance
          </h4>
          <p className="text-amber-800 leading-relaxed">
            Biomarker trend analysis and risk stratifications in CirrhoCare AI are assistive decision-support calculations generated by an experimental Random Forest model (trained on a benchmark 17-observation clinical dataset) for investigational triage assistance only.
            <strong> It does not constitute a definitive medical diagnosis or replace personalized medical counsel from your attending hepatologist.</strong>
          </p>
          <p className="text-amber-800 pt-0.5">
            Never discontinue or adjust prescribed treatments based solely on laboratory values or portal risk calculations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientBiomarkersPage;
