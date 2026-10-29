import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Database,
  Download,
  FileCheck2,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  RefreshCw,
  Sparkles,
  TrendingUp,
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
import { KpiCard } from '@/components/common/KpiCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';
import type { AnalyticsData, ReportAnalyticsData } from '@/types';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [reportData, setReportData] = useState<ReportAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<'all' | '7d' | '30d' | '90d'>('all');

  const handleExportCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const url = api.exports.getCsvUrl({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      await api.exports.downloadFile(url, 'cirrhocare_analytics_registry.csv');
      success('Filtered registry CSV exported successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to export registry CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const url = api.exports.getPdfUrl({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      await api.exports.downloadFile(url, 'cirrhocare_analytics_report.pdf');
      success('Filtered executive clinical summary PDF exported successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to export summary PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const fetchAllAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, reportsRes] = await Promise.all([
        api.analytics.get({ start_date: startDate, end_date: endDate }).catch(() => null),
        api.reports.analytics({ start_date: startDate, end_date: endDate }).catch(() => null),
      ]);

      if (analyticsRes && analyticsRes.success) {
        setAnalyticsData(analyticsRes);
      }
      if (reportsRes && reportsRes.success) {
        setReportData(reportsRes);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load clinical analytics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const handlePreset = (preset: 'all' | '7d' | '30d' | '90d') => {
    setActivePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30d') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '90d') {
      const past = new Date();
      past.setDate(today.getDate() - 90);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const handleClearFilters = () => {
    setActivePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = Boolean(startDate || endDate);

  // Chart Data Formatting
  const riskPieData = analyticsData?.risk_distribution
    ? [
        { name: 'High Risk', value: analyticsData.risk_distribution['High Risk'], color: '#EC4899' },
        { name: 'Medium Risk', value: analyticsData.risk_distribution['Medium Risk'], color: '#F59E0B' },
        { name: 'Low Risk', value: analyticsData.risk_distribution['Low Risk'], color: '#22C55E' },
        { name: 'Pending', value: analyticsData.risk_distribution['Pending'], color: '#94A3B8' },
      ].filter((d) => d.value > 0)
    : [];

  const categoryBarData = reportData?.reports_by_category
    ? Object.entries(reportData.reports_by_category).map(([cat, count]) => ({
        category: cat,
        count,
      }))
    : [];

  const statusPieData = reportData?.reports_by_status
    ? [
        { name: 'Needs Urgent Review', value: reportData.reports_by_status['Needs urgent review'] || 0, color: '#E11D48' },
        { name: 'Awaiting Review', value: reportData.reports_by_status['Awaiting review'] || 0, color: '#F59E0B' },
        { name: 'Under Treatment', value: reportData.reports_by_status['Under treatment'] || 0, color: '#8B5CF6' },
        { name: 'Routine / Stable', value: (reportData.reports_by_status['Routine'] || 0) + (reportData.reports_by_status['Stable'] || 0), color: '#10B981' },
      ].filter((d) => d.value > 0)
    : [];

  const uploadTrendsData = reportData?.upload_trends && reportData.upload_trends.length > 0
    ? reportData.upload_trends.map((t) => ({
        date: t.date,
        uploads: t.count,
      }))
    : [];

  const biomarkerData = analyticsData?.averages
    ? [
        { marker: 'Bilirubin (mg/dL)', avg: analyticsData.averages.bilirubin, normal: 1.2 },
        { marker: 'Albumin (g/dL)', avg: analyticsData.averages.albumin, normal: 4.0 },
        { marker: 'SGOT (AST) U/L', avg: analyticsData.averages.sgot, normal: 35 },
        { marker: 'SGPT (ALT) U/L', avg: analyticsData.averages.sgpt, normal: 40 },
      ]
    : [];

  if (isLoading && !analyticsData && !reportData) {
    return <LoadingSpinner label="Aggregating clinical reports, biomarker distributions, and audit trends..." className="py-24" />;
  }

  const totalPatients = analyticsData?.total_patients ?? 0;
  const totalReports = reportData?.total_reports ?? 0;
  const awaitingReview = reportData?.awaiting_review_count ?? 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Clinical Report Analytics & Insights
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time diagnostic report trends, clinical triage queues, biomarker cohort distributions, and review metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf || isExportingCsv}
                isLoading={isExportingPdf}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                title="Export executive clinical summary as PDF"
              >
                PDF Summary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExportingPdf || isExportingCsv}
                isLoading={isExportingCsv}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                title="Export filtered registry as CSV"
              >
                Registry CSV
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchAllAnalytics();
            }}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* 2. Date Range Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Period:
            </span>
            {[
              { id: 'all', label: 'All Records' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activePreset === p.id && !hasActiveFilters && p.id === 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : activePreset === p.id && hasActiveFilters && p.id !== 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Custom Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('all');
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('all');
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none"
            />

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition"
              >
                <X className="w-3 h-3 text-slate-400" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Clinical Reports"
          value={totalReports}
          accent="purple"
          icon={<FileText className="w-6 h-6" />}
          subtitle={`Covering ${reportData?.unique_patients ?? 0} unique patients`}
        />
        <KpiCard
          title="Awaiting Physician Review"
          value={awaitingReview}
          accent="pink"
          icon={<AlertTriangle className="w-6 h-6" />}
          subtitle="Reports tied to urgent/pending triage"
        />
        <KpiCard
          title="Admitted Clinical Patients"
          value={totalPatients}
          accent="blue"
          icon={<Users className="w-6 h-6" />}
          subtitle="Registered patient cohort"
        />
        <KpiCard
          title="Diagnostic Modalities"
          value={categoryBarData.length}
          accent="teal"
          icon={<FlaskConical className="w-6 h-6" />}
          subtitle="Active report categories"
        />
      </div>

      {/* 4. Primary Charts Row: Upload Trends & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Upload Trends Over Time */}
        <Card accentColor="purple">
          <CardHeader
            title="Report Upload Velocity & Timeline"
            subtitle="Volume of diagnostic reports uploaded over time"
            action={<Badge variant="info">Real Temporal Data</Badge>}
          />
          <CardContent className="h-80">
            {uploadTrendsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={uploadTrendsData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#0F172A',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="uploads"
                    name="Reports Uploaded"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#uploadGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <FileText className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">No report upload activity recorded in this period</p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Upload laboratory reports via the Lab Technician workspace to populate this temporal trend.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnostic Report Categories */}
        <Card accentColor="teal">
          <CardHeader
            title="Diagnostic Modalities & Report Categories"
            subtitle="Distribution of report categories uploaded"
            action={<Badge variant="default">All Categories</Badge>}
          />
          <CardContent className="h-80">
            {categoryBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="category" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#0F172A',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Reports" fill="#14B8A6" radius={[8, 8, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <FlaskConical className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">No category metrics available</p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Reports uploaded with categories like "Lab report", "Biopsy", or "Imaging" will be summarized here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Secondary Charts Row: Review Status & Cirrhosis Stratification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinical Review Status Distribution */}
        <Card accentColor="orange">
          <CardHeader
            title="Clinical Triage & Review Status"
            subtitle="Reports linked to patient care queue statuses"
          />
          <CardContent className="h-72">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label
                  >
                    {statusPieData.map((e, idx) => (
                      <Cell key={idx} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#0F172A',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <Activity className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">No clinical triage records on file</p>
                <p className="text-[11px] text-slate-400">Status distributions update when patient reviews are conducted.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cirrhosis Risk Stratification */}
        <Card accentColor="pink">
          <CardHeader
            title="Cirrhosis Population Stratification"
            subtitle="AI classification breakdown across admitted records"
          />
          <CardContent className="h-72">
            {riskPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label
                  >
                    {riskPieData.map((e, idx) => (
                      <Cell key={idx} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#0F172A',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                <AlertTriangle className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">No risk stratification observations</p>
                <p className="text-[11px] text-slate-400">Evaluations computed by the Random Forest model appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Biomarker Cohort Means vs Clinical Reference Limits */}
      <Card accentColor="teal">
        <CardHeader
          title="Serum Biomarker Cohort Averages vs Standard Reference Limits"
          subtitle="Observed population means compared against verified laboratory upper bounds"
          action={<Badge variant="default">Verified Lab Intervals</Badge>}
        />
        <CardContent className="h-80">
          {biomarkerData.some((b) => b.avg > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={biomarkerData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="marker" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    backgroundColor: '#0F172A',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="avg" name="Observed Patient Mean" fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="normal" name="Reference Upper Limit" fill="#14B8A6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
              <HeartPulse className="w-8 h-8 opacity-40" />
              <p className="text-xs font-semibold">No biomarker observations recorded in current scope</p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Clinical blood panels entered through intake or diagnostic laboratory reports will populate this comparison.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Recent Report Audit Activity (Admin & Labtech Oversight) */}
      {(user?.role === 'admin' || user?.role === 'labtech') && reportData?.recent_activity_trends && reportData.recent_activity_trends.length > 0 && (
        <Card accentColor="blue">
          <CardHeader
            title="Recent Report Activity & Audit Log"
            subtitle="Verified chronological trail of report uploads and modifications"
            action={<Badge variant="info">Audit Verified</Badge>}
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportData.recent_activity_trends.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{item.action}</p>
                      <p className="text-slate-500 text-[11px]">{item.details}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
export default AnalyticsPage;
