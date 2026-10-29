import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  HeartPulse,
  Info,
  Layers,
  LayoutDashboard,
  Pill,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
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
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type {
  ActivityLogItem,
  AdminStats,
  Appointment,
  MedicalReport,
  Patient,
  Prescription,
  User as UserType,
} from '@/types';
import {
  formatDateLocalized,
  formatFullDateLocalized,
  getTreatmentStatusText,
  getLabStatusText,
  getRiskLevelText,
  getAppointmentStatusText,
  getBiomarkerName,
} from '@/utils/translations';

type AdminTab = 'overview' | 'users' | 'patients' | 'treatments' | 'analytics' | 'audit';

const HINDI_MONTHS: Record<number, string> = {
  0: 'जनवरी',
  1: 'फ़रवरी',
  2: 'मार्च',
  3: 'अप्रैल',
  4: 'मई',
  5: 'जून',
  6: 'जुलाई',
  7: 'अगस्त',
  8: 'सितंबर',
  9: 'अक्टूबर',
  10: 'नवंबर',
  11: 'दिसंबर',
};

const HINDI_DAYS: Record<number, string> = {
  0: 'रविवार',
  1: 'सोमवार',
  2: 'मंगलवार',
  3: 'बुधवार',
  4: 'गुरुवार',
  5: 'शुक्रवार',
  6: 'शनिवार',
};

// Color palettes for Recharts
const STATUS_COLORS: Record<string, string> = {
  'Awaiting Doctor Review': '#3B82F6', // Blue
  'Under Treatment': '#6366F1', // Indigo
  'Follow-up Required': '#F59E0B', // Amber
  'Treatment Completed': '#10B981', // Emerald
};

const RISK_COLORS: Record<string, string> = {
  'High Risk': '#EF4444', // Red
  'Medium Risk': '#F59E0B', // Amber
  'Low Risk': '#10B981', // Green
  'Pending': '#94A3B8', // Slate
};

const LAB_STATUS_COLORS: Record<string, string> = {
  'Registered': '#60A5FA', // Light Blue
  'Test in Progress': '#FBBF24', // Amber
  'Report Uploaded': '#A855F7', // Purple
};

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isHindi, t } = useLanguage();
  const { error: toastError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Tab Routing & Synchronization
  // ---------------------------------------------------------------------------
  const getTabFromUrl = useCallback((): AdminTab => {
    if (location.pathname === '/logs') return 'audit';
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'users' || tab === 'patients' || tab === 'treatments' || tab === 'analytics' || tab === 'audit') {
      return tab;
    }
    return 'overview';
  }, [location.pathname, location.search]);

  const [activeTab, setActiveTab] = useState<AdminTab>(getTabFromUrl());

  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [getTabFromUrl]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin?tab=${tab}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Live Date / Time
  // ---------------------------------------------------------------------------
  const [currentDateTime, setCurrentDateTime] = useState({
    dateStrEn: 'Monday, 28 October 2026',
    dateStrHi: 'सोमवार, 28 अक्टूबर 2026',
  });

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
      const day = now.getDate();
      const month = now.toLocaleDateString('en-US', { month: 'long' });
      const year = now.getFullYear();
      const dateStrEn = `${weekday}, ${day} ${month} ${year}`;
      const dateStrHi = `${HINDI_DAYS[now.getDay()]}, ${day} ${HINDI_MONTHS[now.getMonth()]} ${year}`;
      setCurrentDateTime({ dateStrEn, dateStrHi });
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // ---------------------------------------------------------------------------
  // State for Live Data
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [logsList, setLogsList] = useState<ActivityLogItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Read-Only Patient Details Modal State
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<Patient | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsModalLoading, setDetailsModalLoading] = useState(false);

  // Filters: Users Tab
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // Filters: Patients Tab
  const [patientQuery, setPatientQuery] = useState('');
  const [patientLabFilter, setPatientLabFilter] = useState('all');
  const [patientClinicalFilter, setPatientClinicalFilter] = useState('all');
  const [patientRiskFilter, setPatientRiskFilter] = useState('all');
  const [patientSort, setPatientSort] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'risk-desc'>('date-desc');

  // Filters: Treatment Monitoring Tab
  const [treatmentStageFilter, setTreatmentStageFilter] = useState<string>('all');

  // Filters: Audit Logs Tab
  const [logQuery, setLogQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchAllData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setApiError(null);
    try {
      const [statsRes, usersRes, patientsRes, apptsRes, logsRes] = await Promise.allSettled([
        api.dashboard.getStats(),
        api.users.list({ per_page: 100 }),
        api.patients.list({ per_page: 100 }),
        api.appointments.list({ per_page: 100 }),
        api.logs.list({ per_page: 100 }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.stats);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value?.success) {
        setUsersList(usersRes.value.users || []);
      }
      if (patientsRes.status === 'fulfilled' && patientsRes.value?.success) {
        setPatientsList(patientsRes.value.patients || []);
      }
      if (apptsRes.status === 'fulfilled' && apptsRes.value?.success) {
        setAppointmentsList(apptsRes.value.appointments || []);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value?.success) {
        setLogsList(logsRes.value.logs || []);
      }
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load system administrative data');
      toastError('Error refreshing administrative monitoring data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchAllData(false);
  }, [fetchAllData]);

  // Handle opening patient read-only details modal
  const handleOpenPatientDetails = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setIsDetailsModalOpen(true);
    setDetailsModalLoading(true);
    // Find initial cached patient
    const cached = patientsList.find((p) => p.id === patientId) || null;
    setSelectedPatientData(cached);

    try {
      const res = await api.patients.get(patientId);
      if (res.success && res.patient) {
        setSelectedPatientData(res.patient);
      }
    } catch {
      // Fallback to cached patient
    } finally {
      setDetailsModalLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Dynamic Metrics & Calculations (Strictly from API/DB records)
  // ---------------------------------------------------------------------------
  const totalPatients = stats?.total_patients ?? patientsList.length;

  const newlyRegisteredCount = useMemo(() => {
    if (stats?.newly_registered_patients !== undefined) return stats.newly_registered_patients;
    return patientsList.filter(
      (p) => (!p.lab_workflow_status || p.lab_workflow_status === 'Registered') &&
             (!p.treatment_status || p.treatment_status === 'Awaiting Doctor Review' || p.treatment_status === 'Awaiting review')
    ).length;
  }, [stats, patientsList]);

  const awaitingDoctorReviewCount = useMemo(() => {
    if (stats?.awaiting_doctor_review !== undefined) return stats.awaiting_doctor_review;
    return patientsList.filter(
      (p) => p.treatment_status === 'Awaiting Doctor Review' || p.treatment_status === 'Awaiting review'
    ).length;
  }, [stats, patientsList]);

  const patientsUnderTreatmentCount = useMemo(() => {
    if (stats?.patients_under_treatment !== undefined) return stats.patients_under_treatment;
    return patientsList.filter(
      (p) => p.treatment_status === 'Under Treatment' || p.treatment_status === 'Under treatment'
    ).length;
  }, [stats, patientsList]);

  const treatmentCompletedCount = useMemo(() => {
    if (stats?.treatment_completed !== undefined) return stats.treatment_completed;
    return patientsList.filter((p) => p.treatment_status === 'Treatment Completed').length;
  }, [stats, patientsList]);

  const followUpRequiredCount = useMemo(() => {
    if (stats?.follow_up_required !== undefined) return stats.follow_up_required;
    return patientsList.filter(
      (p) => p.treatment_status === 'Follow-up Required' || p.treatment_status === 'Follow-up required'
    ).length;
  }, [stats, patientsList]);

  const highRiskPatientsCount = useMemo(() => {
    if (stats?.high_risk !== undefined) return stats.high_risk;
    return patientsList.filter((p) => p.latest_risk_label === 'High Risk').length;
  }, [stats, patientsList]);

  const pendingAppointmentsCount = useMemo(() => {
    if (stats?.pending_appointment_requests !== undefined) return stats.pending_appointment_requests;
    return appointmentsList.filter((a) => a.status === 'Pending').length;
  }, [stats, appointmentsList]);

  // High Risk Patients list for surveillance card
  const highRiskPatientsList = useMemo(() => {
    return patientsList.filter((p) => p.latest_risk_label === 'High Risk');
  }, [patientsList]);

  // User breakdown
  const adminUsersCount = useMemo(() => {
    if (stats?.staff_breakdown?.admins !== undefined) return stats.staff_breakdown.admins;
    return usersList.filter((u) => u.role === 'admin').length;
  }, [stats, usersList]);

  const doctorUsersCount = useMemo(() => {
    if (stats?.staff_breakdown?.doctors !== undefined) return stats.staff_breakdown.doctors;
    return usersList.filter((u) => u.role === 'hepatologist').length;
  }, [stats, usersList]);

  const labtechUsersCount = useMemo(() => {
    if (stats?.staff_breakdown?.labtechs !== undefined) return stats.staff_breakdown.labtechs;
    return usersList.filter((u) => u.role === 'labtech').length;
  }, [stats, usersList]);

  const patientPortalUsersCount = useMemo(() => {
    if (stats?.staff_breakdown?.patients !== undefined) return stats.staff_breakdown.patients;
    return usersList.filter((u) => u.role === 'patient').length;
  }, [stats, usersList]);

  const totalUsersCount = stats?.total_users ?? (usersList.length || adminUsersCount + doctorUsersCount + labtechUsersCount + patientPortalUsersCount);
  const activeUsersCount = stats?.active_accounts_count ?? usersList.filter((u) => u.active !== false).length;
  const inactiveUsersCount = stats?.inactive_accounts_count ?? usersList.filter((u) => u.active === false).length;

  // ---------------------------------------------------------------------------
  // Filtered Lists
  // ---------------------------------------------------------------------------

  // Users Filter
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchQuery =
        !userQuery ||
        u.name?.toLowerCase().includes(userQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(userQuery.toLowerCase()) ||
        (u.portal_id && u.portal_id.toLowerCase().includes(userQuery.toLowerCase()));

      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchStatus =
        userStatusFilter === 'all' ||
        (userStatusFilter === 'active' && u.active !== false) ||
        (userStatusFilter === 'inactive' && u.active === false);

      return matchQuery && matchRole && matchStatus;
    });
  }, [usersList, userQuery, userRoleFilter, userStatusFilter]);

  // Patients Filter
  const filteredPatients = useMemo(() => {
    const list = patientsList.filter((p) => {
      const matchQuery =
        !patientQuery ||
        p.full_name?.toLowerCase().includes(patientQuery.toLowerCase()) ||
        p.portal_id?.toLowerCase().includes(patientQuery.toLowerCase());

      const labStatus = p.lab_workflow_status || 'Registered';
      const matchLab = patientLabFilter === 'all' || labStatus.toLowerCase() === patientLabFilter.toLowerCase();

      const treatmentStatus = p.treatment_status || 'Awaiting Doctor Review';
      const matchTreatment =
        patientClinicalFilter === 'all' || treatmentStatus.toLowerCase() === patientClinicalFilter.toLowerCase();

      const riskLabel = p.latest_risk_label || 'Pending';
      const matchRisk = patientRiskFilter === 'all' || riskLabel.toLowerCase() === patientRiskFilter.toLowerCase();

      return matchQuery && matchLab && matchTreatment && matchRisk;
    });

    // Sorting
    return list.sort((a, b) => {
      if (patientSort === 'name-asc') {
        return a.full_name.localeCompare(b.full_name);
      }
      if (patientSort === 'date-asc') {
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
      }
      if (patientSort === 'risk-desc') {
        const pA = a.latest_risk_percent ?? 0;
        const pB = b.latest_risk_percent ?? 0;
        return pB - pA;
      }
      // default: date-desc
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  }, [patientsList, patientQuery, patientLabFilter, patientClinicalFilter, patientRiskFilter, patientSort]);

  // Lifecycle Pipeline Counts (for Treatment Monitoring tab)
  const lifecycleCounts = useMemo(() => {
    const newReg = patientsList.filter(
      (p) => (!p.lab_workflow_status || p.lab_workflow_status === 'Registered') && !p.bilirubin
    ).length;

    const inProgress = patientsList.filter(
      (p) => p.lab_workflow_status === 'Test in Progress' || (p.bilirubin && (!p.reports || p.reports.length === 0))
    ).length;

    const reportUploaded = patientsList.filter(
      (p) => p.lab_workflow_status === 'Report Uploaded' || (p.reports && p.reports.length > 0)
    ).length;

    const awaitingMD = patientsList.filter(
      (p) => p.treatment_status === 'Awaiting Doctor Review' || p.treatment_status === 'Awaiting review' || !p.treatment_status
    ).length;

    const underRx = patientsList.filter(
      (p) => p.treatment_status === 'Under Treatment' || p.treatment_status === 'Under treatment'
    ).length;

    const followUp = patientsList.filter(
      (p) => p.treatment_status === 'Follow-up Required' || p.treatment_status === 'Follow-up required'
    ).length;

    const completed = patientsList.filter(
      (p) => p.treatment_status === 'Treatment Completed'
    ).length;

    return {
      newReg,
      inProgress,
      reportUploaded,
      awaitingMD,
      underRx,
      followUp,
      completed,
    };
  }, [patientsList]);

  // Filtered treatment patients
  const treatmentFilteredPatients = useMemo(() => {
    if (treatmentStageFilter === 'all') return patientsList;
    if (treatmentStageFilter === 'new') {
      return patientsList.filter(
        (p) => (!p.lab_workflow_status || p.lab_workflow_status === 'Registered') && !p.bilirubin
      );
    }
    if (treatmentStageFilter === 'inprogress') {
      return patientsList.filter(
        (p) => p.lab_workflow_status === 'Test in Progress' || (p.bilirubin && (!p.reports || p.reports.length === 0))
      );
    }
    if (treatmentStageFilter === 'uploaded') {
      return patientsList.filter(
        (p) => p.lab_workflow_status === 'Report Uploaded' || (p.reports && p.reports.length > 0)
      );
    }
    if (treatmentStageFilter === 'awaiting') {
      return patientsList.filter(
        (p) => p.treatment_status === 'Awaiting Doctor Review' || p.treatment_status === 'Awaiting review' || !p.treatment_status
      );
    }
    if (treatmentStageFilter === 'under_rx') {
      return patientsList.filter(
        (p) => p.treatment_status === 'Under Treatment' || p.treatment_status === 'Under treatment'
      );
    }
    if (treatmentStageFilter === 'follow_up') {
      return patientsList.filter(
        (p) => p.treatment_status === 'Follow-up Required' || p.treatment_status === 'Follow-up required'
      );
    }
    if (treatmentStageFilter === 'completed') {
      return patientsList.filter((p) => p.treatment_status === 'Treatment Completed');
    }
    return patientsList;
  }, [patientsList, treatmentStageFilter]);

  // Audit Logs Filter
  const filteredLogs = useMemo(() => {
    return logsList.filter((l) => {
      const matchQuery =
        !logQuery ||
        l.action?.toLowerCase().includes(logQuery.toLowerCase()) ||
        l.details?.toLowerCase().includes(logQuery.toLowerCase()) ||
        l.user_email?.toLowerCase().includes(logQuery.toLowerCase()) ||
        (l.user_name && l.user_name.toLowerCase().includes(logQuery.toLowerCase()));

      const matchAction =
        logActionFilter === 'all' || l.action?.toLowerCase().includes(logActionFilter.toLowerCase());

      return matchQuery && matchAction;
    });
  }, [logsList, logQuery, logActionFilter]);

  // ---------------------------------------------------------------------------
  // Analytics Data for Recharts
  // ---------------------------------------------------------------------------
  const clinicalStatusChartData = useMemo(() => {
    return [
      { name: 'Awaiting Doctor Review', count: awaitingDoctorReviewCount, color: STATUS_COLORS['Awaiting Doctor Review'] },
      { name: 'Under Treatment', count: patientsUnderTreatmentCount, color: STATUS_COLORS['Under Treatment'] },
      { name: 'Follow-up Required', count: followUpRequiredCount, color: STATUS_COLORS['Follow-up Required'] },
      { name: 'Treatment Completed', count: treatmentCompletedCount, color: STATUS_COLORS['Treatment Completed'] },
    ].filter((item) => item.count > 0 || patientsList.length === 0);
  }, [awaitingDoctorReviewCount, patientsUnderTreatmentCount, followUpRequiredCount, treatmentCompletedCount, patientsList.length]);

  const labWorkflowChartData = useMemo(() => {
    const reg = patientsList.filter((p) => !p.lab_workflow_status || p.lab_workflow_status === 'Registered').length;
    const prog = patientsList.filter((p) => p.lab_workflow_status === 'Test in Progress').length;
    const uploaded = patientsList.filter((p) => p.lab_workflow_status === 'Report Uploaded' || (p.reports && p.reports.length > 0)).length;
    return [
      { stage: 'Registered', count: reg, fill: LAB_STATUS_COLORS['Registered'] },
      { stage: 'Test in Progress', count: prog, fill: LAB_STATUS_COLORS['Test in Progress'] },
      { stage: 'Report Uploaded', count: uploaded, fill: LAB_STATUS_COLORS['Report Uploaded'] },
    ];
  }, [patientsList]);

  const riskDistributionChartData = useMemo(() => {
    const high = highRiskPatientsCount;
    const med = stats?.medium_risk ?? patientsList.filter((p) => p.latest_risk_label === 'Medium Risk').length;
    const low = stats?.low_risk ?? patientsList.filter((p) => p.latest_risk_label === 'Low Risk').length;
    const pending = stats?.pending_risk ?? patientsList.filter((p) => !p.latest_risk_label || p.latest_risk_label === 'Pending').length;
    return [
      { name: 'High Risk', count: high, color: RISK_COLORS['High Risk'] },
      { name: 'Medium Risk', count: med, color: RISK_COLORS['Medium Risk'] },
      { name: 'Low Risk', count: low, color: RISK_COLORS['Low Risk'] },
      { name: 'Pending', count: pending, color: RISK_COLORS['Pending'] },
    ].filter((item) => item.count > 0 || patientsList.length === 0);
  }, [highRiskPatientsCount, stats, patientsList]);

  const appointmentsChartData = useMemo(() => {
    const pending = appointmentsList.filter((a) => a.status === 'Pending').length;
    const confirmed = appointmentsList.filter((a) => a.status === 'Confirmed').length;
    const rescheduled = appointmentsList.filter(
      (a) => a.status === 'Reschedule Requested' || a.status === 'Rescheduled'
    ).length;
    const rejected = appointmentsList.filter((a) => a.status === 'Rejected').length;
    const completed = appointmentsList.filter((a) => a.status === 'Completed').length;
    return [
      { status: 'Pending', count: pending, fill: '#F59E0B' },
      { status: 'Confirmed', count: confirmed, fill: '#10B981' },
      { status: 'Rescheduled', count: rescheduled, fill: '#8B5CF6' },
      { status: 'Rejected', count: rejected, fill: '#EF4444' },
      { status: 'Completed', count: completed, fill: '#3B82F6' },
    ];
  }, [appointmentsList]);

  const ageDemographicsChartData = useMemo(() => {
    const bracket1 = patientsList.filter((p) => p.age < 30).length;
    const bracket2 = patientsList.filter((p) => p.age >= 30 && p.age <= 45).length;
    const bracket3 = patientsList.filter((p) => p.age >= 46 && p.age <= 60).length;
    const bracket4 = patientsList.filter((p) => p.age > 60).length;
    return [
      { range: '< 30 yrs', count: bracket1 },
      { range: '30-45 yrs', count: bracket2 },
      { range: '46-60 yrs', count: bracket3 },
      { range: '> 60 yrs', count: bracket4 },
    ];
  }, [patientsList]);

  // ---------------------------------------------------------------------------
  // Helper Renderers
  // ---------------------------------------------------------------------------
  const renderRiskBadge = (riskLabel?: string | null, riskPercent?: number | null) => {
    const label = riskLabel || 'Pending';
    if (label === 'High Risk') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          {getRiskLevelText('High Risk', isHindi)} {riskPercent !== null && riskPercent !== undefined ? `(${riskPercent.toFixed(1)}%)` : ''}
        </span>
      );
    }
    if (label === 'Medium Risk') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getRiskLevelText('Medium Risk', isHindi)} {riskPercent !== null && riskPercent !== undefined ? `(${riskPercent.toFixed(1)}%)` : ''}
        </span>
      );
    }
    if (label === 'Low Risk') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {getRiskLevelText('Low Risk', isHindi)} {riskPercent !== null && riskPercent !== undefined ? `(${riskPercent.toFixed(1)}%)` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {t('Pending Lab', 'लैब लंबित')}
      </span>
    );
  };

  const renderClinicalStatusBadge = (status?: string | null) => {
    const norm = status || 'Awaiting Doctor Review';
    if (norm === 'Treatment Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#d1fae5] text-[#059669] border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {getTreatmentStatusText('Treatment Completed', isHindi)}
        </span>
      );
    }
    if (norm === 'Follow-up Required' || norm === 'Follow-up required') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fef3c7] text-[#b45309] border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getTreatmentStatusText('Follow-up Required', isHindi)}
        </span>
      );
    }
    if (norm === 'Under Treatment' || norm === 'Under treatment') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {getTreatmentStatusText('Under Treatment', isHindi)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#eaf3fe] text-[#1877F2] border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {getTreatmentStatusText('Awaiting Doctor Review', isHindi)}
      </span>
    );
  };

  const renderLabStatusBadge = (status?: string | null) => {
    const s = status || 'Registered';
    if (s === 'Report Uploaded') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {getLabStatusText('Report Uploaded', isHindi)}
        </span>
      );
    }
    if (s === 'Test in Progress' || s === 'In Progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {getLabStatusText('Test in Progress', isHindi)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {getLabStatusText('Registered', isHindi)}
      </span>
    );
  };

  const renderRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Shield className="w-3 h-3 text-purple-600" />
          {t('Administrator', 'प्रशासक')}
        </span>
      );
    }
    if (role === 'hepatologist') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Stethoscope className="w-3 h-3 text-blue-600" />
          {t('Hepatologist', 'हेपेटोलॉजिस्ट')}
        </span>
      );
    }
    if (role === 'labtech') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
          <Activity className="w-3 h-3 text-teal-600" />
          {t('Lab Technician', 'लैब तकनीशियन')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
        <Users className="w-3 h-3 text-orange-600" />
        {t('Patient', 'मरीज़')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* ----------------------------------------------------------------- */}
        {/* TOP WELCOME / GOVERNANCE BANNER                                    */}
        {/* ----------------------------------------------------------------- */}
        <div className="rounded-3xl bg-gradient-to-r from-[#eef7ff] via-[#e8f4fd] to-[#e3f0fc] p-6 lg:p-7 border border-[#d6eafb] relative overflow-hidden shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 border border-sky-200/60 text-xs font-semibold text-slate-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#1877F2] animate-pulse" />
                <span>{t('CirrhoCare AI • Centralized Clinical & Operational Oversight', 'सिरोकेयर एआई • केंद्रीकृत नैदानिक एवं परिचालन निगरानी')}</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                {t('Welcome back, ', 'वापसी पर स्वागत है, ')}{user?.name || t('System Administrator', 'सिस्टम प्रशासक')}! 👋
              </h1>
              <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
                {t('Real-time operational surveillance of patient admissions, laboratory pipelines, treatment statuses, appointments, and non-repudiation audit security.', 'मरीज़ प्रवेश, प्रयोगशाला प्रक्रिया, उपचार स्थिति, अपॉइंटमेंट्स और सुरक्षा ऑडिट की रीयल-टाइम परिचालन निगरानी।')}
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              {/* Date chip */}
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
                <Calendar className="w-4 h-4 text-[#1877F2]" />
                <span>{isHindi ? currentDateTime.dateStrHi : currentDateTime.dateStrEn}</span>
              </div>

              {/* Read-Only Scope pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>{t('Read-Only Clinical Governance', 'केवल-पठन नैदानिक प्रशासन')}</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => fetchAllData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                title={t('Refresh system telemetry', 'सिस्टम टेलीमेट्री रिफ्रेश करें')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? t('Updating...', 'अपडेट हो रहा है...') : t('Refresh', 'रिफ्रेश')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SEGMENTED TAB NAVIGATION BAR                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => handleTabChange('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('Overview', 'अवलोकन')}</span>
            </button>

            <button
              onClick={() => handleTabChange('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t('Users & Staff', 'उपयोगकर्ता और कर्मचारी')}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {totalUsersCount}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('patients')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'patients'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{t('Patient Monitoring', 'रोगी निगरानी')}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'patients' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {totalPatients}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('treatments')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'treatments'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{t('Treatment Monitoring', 'उपचार निगरानी')}</span>
            </button>

            <button
              onClick={() => handleTabChange('analytics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t('Reports & Analytics', 'रिपोर्ट और एनालिटिक्स')}</span>
            </button>

            <button
              onClick={() => handleTabChange('audit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#1877F2] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{t('Security & Audit Logs', 'सुरक्षा एवं ऑडिट लॉग')}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {logsList.length}
              </span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* ERROR STATE NOTIFICATION                                          */}
        {/* ----------------------------------------------------------------- */}
        {apiError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{t('System Telemetry Alert', 'सिस्टम टेलीमेट्री चेतावनी')}</p>
              <p>{apiError}</p>
            </div>
            <button
              onClick={() => fetchAllData(true)}
              className="px-3 py-1 bg-white border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-100 transition-colors"
            >
              {t('Retry', 'पुनः प्रयास करें')}
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW DASHBOARD                                         */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 8 DYNAMIC KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Patients */}
              <div
                onClick={() => handleTabChange('patients')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Total Patients', 'कुल मरीज़')}</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalPatients}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{patientPortalUsersCount} {t('active portal logins', 'सक्रिय पोर्टल लॉगिन')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1877F2] transition-colors" />
                </div>
              </div>

              {/* 2. Newly Registered */}
              <div
                onClick={() => {
                  setPatientLabFilter('Registered');
                  handleTabChange('patients');
                }}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Newly Registered', 'नये पंजीकृत')}</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-amber-600 tracking-tight">{newlyRegisteredCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Awaiting initial lab test', 'प्रारंभिक लैब परीक्षण की प्रतीक्षा')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
              </div>

              {/* 3. Awaiting Doctor Review */}
              <div
                onClick={() => handleTabChange('treatments')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Awaiting Review', 'समीक्षा प्रतीक्षारत')}</span>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-orange-600 tracking-tight">{awaitingDoctorReviewCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Lab results ready for MD', 'डॉक्टर समीक्षा हेतु परिणाम तैयार')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600 transition-colors" />
                </div>
              </div>

              {/* 4. Under Treatment */}
              <div
                onClick={() => handleTabChange('treatments')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Under Treatment', 'उपचाराधीन')}</span>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-indigo-600 tracking-tight">{patientsUnderTreatmentCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Active prescription therapy', 'सक्रिय दवा चिकित्सा जारी')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </div>

              {/* 5. Treatment Completed */}
              <div
                onClick={() => handleTabChange('treatments')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Treatment Done', 'उपचार संपन्न')}</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">{treatmentCompletedCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Discharged / stable clinical state', 'डिस्चार्ज / स्थिर नैदानिक स्थिति')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </div>
              </div>

              {/* 6. Follow-up Required */}
              <div
                onClick={() => handleTabChange('treatments')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Follow-up Needed', 'फॉलो-अप आवश्यक')}</span>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-purple-600 tracking-tight">{followUpRequiredCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Post-therapy surveillance', 'चिकित्सा उपरांत निगरानी')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
              </div>

              {/* 7. High-Risk Patients */}
              <div
                onClick={() => {
                  setPatientRiskFilter('High Risk');
                  handleTabChange('patients');
                }}
                className="bg-white rounded-2xl p-5 border border-rose-200/90 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">{t('High Risk', 'उच्च जोखिम')}</span>
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-rose-600 tracking-tight">{highRiskPatientsCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Cirrhosis risk probability ≥ 70%', 'सिरोसिस जोखिम प्रायिकता ≥ 70%')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 transition-colors" />
                </div>
              </div>

              {/* 8. Pending Appointments */}
              <div
                onClick={() => handleTabChange('patients')}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Pending Appts', 'लंबित अपॉइंटमेंट')}</span>
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-yellow-700 tracking-tight">{pendingAppointmentsCount}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Consultation requests in queue', 'परामर्श अनुरोध कतार में')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-yellow-700 transition-colors" />
                </div>
              </div>
            </div>

            {/* HIGH-RISK SURVEILLANCE & APPOINTMENT OVERSIGHT (2 COLUMNS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* HIGH-RISK SURVEILLANCE CARD */}
              <div className="bg-white rounded-2xl border border-rose-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{t('High-Risk Patient Surveillance', 'उच्च जोखिम रोगी निगरानी')}</h2>
                        <p className="text-xs text-slate-500">{t('Automated clinical risk score prioritization', 'स्वचालित नैदानिक जोखिम स्कोर प्राथमिकता')}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      {highRiskPatientsList.length} {t('Flagged', 'चिह्नित')}
                    </span>
                  </div>

                  {/* Clinical Decision Support Disclaimer */}
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 mb-4 leading-relaxed">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{t('Clinical Decision Support Notice:', 'नैदानिक निर्णय सहायता सूचना:')}</span> {t('AI risk scores are automated predictive indicators derived from laboratory biomarkers and clinical signs, intended solely for prioritization and decision-support by licensed clinicians. Administrators do not perform clinical interventions.', 'एआई जोखिम स्कोर प्रयोगशाला बायोमार्कर और नैदानिक संकेतों से प्राप्त स्वचालित भविष्यसूचक संकेतक हैं, जो केवल लाइसेंस प्राप्त चिकित्सकों द्वारा प्राथमिकता और निर्णय-समर्थन के लिए हैं। प्रशासक नैदानिक हस्तक्षेप नहीं करते हैं।')}
                      </div>
                    </div>
                  </div>

                  {/* List of High-Risk Patients */}
                  <div className="space-y-3">
                    {highRiskPatientsList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                        {t('No patients currently flagged as high risk in the database.', 'वर्तमान में डेटाबेस में कोई भी मरीज़ उच्च जोखिम के रूप में चिह्नित नहीं है।')}
                      </div>
                    ) : (
                      highRiskPatientsList.slice(0, 3).map((pt) => (
                        <div
                          key={pt.id}
                          className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 truncate">{pt.full_name}</span>
                              <span className="text-xs font-mono text-slate-500">({pt.portal_id})</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                              <span>{t('Age:', 'आयु:')} {pt.age} ({pt.gender === 'Male' ? t('Male', 'पुरुष') : pt.gender === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')})</span>
                              <span>•</span>
                              <span>{getBiomarkerName('Total Bilirubin', isHindi)}: {pt.bilirubin ?? 'N/A'} mg/dL</span>
                              <span>•</span>
                              <span>{getBiomarkerName('Albumin', isHindi)}: {pt.albumin ?? 'N/A'} g/dL</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {renderRiskBadge(pt.latest_risk_label, pt.latest_risk_percent)}
                            <button
                              onClick={() => handleOpenPatientDetails(pt.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-[#1877F2] hover:text-white text-slate-700 transition-colors cursor-pointer"
                            >
                              {t('View', 'देखें')}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Showing priority alerts', 'प्राथमिकता अलर्ट प्रदर्शित')}</span>
                  <button
                    onClick={() => {
                      setPatientRiskFilter('High Risk');
                      handleTabChange('patients');
                    }}
                    className="text-[#1877F2] font-semibold hover:underline cursor-pointer"
                  >
                    {t('View All in Patient Monitoring →', 'रोगी निगरानी में सभी देखें →')}
                  </button>
                </div>
              </div>

              {/* APPOINTMENT OPERATIONAL OVERSIGHT CARD */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1877F2] flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{t('Appointment Surveillance', 'अपॉइंटमेंट निगरानी')}</h2>
                        <p className="text-xs text-slate-500">{t('Read-only operational consultation pipeline', 'केवल-पठन परिचालन परामर्श प्रक्रिया')}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {pendingAppointmentsCount} {t('Pending', 'लंबित')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 font-medium">{t('Pending', 'लंबित')}</div>
                      <div className="text-lg font-bold text-amber-600">{pendingAppointmentsCount}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 font-medium">{t('Confirmed', 'पुष्ट')}</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {appointmentsList.filter((a) => a.status === 'Confirmed').length}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 font-medium">{t('Completed', 'पूर्ण')}</div>
                      <div className="text-lg font-bold text-[#1877F2]">
                        {appointmentsList.filter((a) => a.status === 'Completed').length}
                      </div>
                    </div>
                  </div>

                  {/* List of Recent Appointments */}
                  <div className="space-y-3">
                    {appointmentsList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        {t('No appointments currently scheduled in the system.', 'सिस्टम में वर्तमान में कोई अपॉइंटमेंट निर्धारित नहीं है।')}
                      </div>
                    ) : (
                      appointmentsList.slice(0, 3).map((appt) => (
                        <div
                          key={appt.id}
                          className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {appt.patient_name || `${t('Patient', 'मरीज़')} #${appt.patient_id}`}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {appt.appointment_type || t('Consultation', 'परामर्श')} • {appt.scheduled_at}
                            </div>
                            <div className="text-xs text-slate-600 truncate mt-0.5">
                              {t('Reason:', 'कारण:')} {appt.reason}
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              appt.status === 'Confirmed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : appt.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : appt.status === 'Completed'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {getAppointmentStatusText(appt.status, isHindi)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('Clinical appointment scheduling', 'नैदानिक अपॉइंटमेंट निर्धारण')}</span>
                  <span className="text-slate-400 italic">{t('Managed by Attending Doctors', 'उपस्थित डॉक्टरों द्वारा प्रबंधित')}</span>
                </div>
              </div>
            </div>

            {/* QUICK STAFF & AUDIT OVERVIEW BANNER */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Active Staff', 'सक्रिय कर्मचारी')}</div>
                  <div className="text-xl font-bold text-slate-900">
                    {doctorUsersCount + labtechUsersCount + adminUsersCount} {t('Personnel', 'कर्मी')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {doctorUsersCount} {t('MDs', 'डॉक्टर')} • {labtechUsersCount} {t('Lab Techs', 'लैब टेक')} • {adminUsersCount} {t('Admins', 'प्रशासक')}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Account Hygiene', 'खाता स्थिति')}</div>
                  <div className="text-xl font-bold text-slate-900">
                    {activeUsersCount} {t('Active', 'सक्रिय')} / {inactiveUsersCount} {t('Inactive', 'निष्क्रिय')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('Role-based IAM authentication verified', 'भूमिका-आधारित प्रमाणीकरण सत्यापित')}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Audit Security', 'ऑडिट सुरक्षा')}</div>
                  <div className="text-xl font-bold text-slate-900">
                    {logsList.length} {t('Logged Events', 'दर्ज गतिविधियां')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('Tamper-proof compliance history active', 'छेड़छाड़-मुक्त अनुपालन इतिहास सक्रिय')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: USERS & STAFF MONITORING                                   */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">{t('Total Accounts', 'कुल खाते')}</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalUsersCount}</div>
                <div className="text-xs text-slate-400 mt-1">{activeUsersCount} {t('active now', 'अभी सक्रिय')}</div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">{t('Hepatologists (MD)', 'हेपेटोलॉजिस्ट (डॉक्टर)')}</div>
                <div className="text-2xl font-extrabold text-blue-600 mt-1">{doctorUsersCount}</div>
                <div className="text-xs text-slate-400 mt-1">{t('Clinical prescriber role', 'नैदानिक परामर्शदाता भूमिका')}</div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">{t('Lab Technicians', 'लैब तकनीशियन')}</div>
                <div className="text-2xl font-extrabold text-teal-600 mt-1">{labtechUsersCount}</div>
                <div className="text-xs text-slate-400 mt-1">{t('Biomarker intake & PDF', 'बायोमार्कर प्रविष्टि व रिपोर्ट')}</div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">{t('Patient Portal Logins', 'मरीज़ पोर्टल लॉगिन')}</div>
                <div className="text-2xl font-extrabold text-orange-600 mt-1">{patientPortalUsersCount}</div>
                <div className="text-xs text-slate-400 mt-1">{t('Self-service accounts', 'स्वयं-सेवा खाते')}</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('Search user by name, email, or ID...', 'नाम, ईमेल या आईडी से खोजें...')}
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#1877F2]"
                >
                  <option value="all">{t('All Roles', 'सभी भूमिकाएँ')}</option>
                  <option value="admin">{t('Administrator', 'प्रशासक')}</option>
                  <option value="hepatologist">{t('Hepatologist', 'हेपेटोलॉजिस्ट')}</option>
                  <option value="labtech">{t('Lab Technician', 'लैब तकनीशियन')}</option>
                  <option value="patient">{t('Patient', 'मरीज़')}</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#1877F2]"
                >
                  <option value="all">{t('All Status', 'सभी स्थिति')}</option>
                  <option value="active">{t('Active Only', 'केवल सक्रिय')}</option>
                  <option value="inactive">{t('Inactive Only', 'केवल निष्क्रिय')}</option>
                </select>
              </div>
            </div>

            {/* Users Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">{t('User / Staff Member', 'उपयोगकर्ता / कर्मचारी')}</th>
                      <th className="py-3.5 px-4">{t('Role', 'भूमिका')}</th>
                      <th className="py-3.5 px-4">{t('Portal ID', 'पोर्टल आईडी')}</th>
                      <th className="py-3.5 px-4">{t('Account Status', 'खाता स्थिति')}</th>
                      <th className="py-3.5 px-4">{t('Registered Date', 'पंजीकरण तिथि')}</th>
                      <th className="py-3.5 px-5 text-right">{t('Operational Scope', 'परिचालन दायरा')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          {t('No users found matching current filters.', 'वर्तमान फ़िल्टर से मेल खाने वाले कोई उपयोगकर्ता नहीं मिले।')}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                                {u.name ? u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{u.name}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">{renderRoleBadge(u.role)}</td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                            {u.portal_id || 'SYS-USER'}
                          </td>
                          <td className="py-3.5 px-4">
                            {u.active !== false ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {t('Active', 'सक्रिय')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                {t('Inactive', 'निष्क्रिय')}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {u.created_at ? formatDateLocalized(u.created_at, isHindi) : t('Active', 'सक्रिय')}
                          </td>
                          <td className="py-3.5 px-5 text-right text-xs font-medium text-slate-500">
                            {u.role === 'admin'
                              ? t('Operational Admin', 'परिचालन व्यवस्थापक')
                              : u.role === 'hepatologist'
                              ? t('Clinical Oversight', 'नैदानिक निरीक्षण')
                              : u.role === 'labtech'
                              ? t('Laboratory Diagnostics', 'प्रयोगशाला निदान')
                              : t('Patient Self-Service', 'मरीज़ स्वयं-सेवा')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 3: PATIENT MONITORING TABLE                                   */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
                <div className="relative w-full lg:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t('Search by Patient Name or Portal ID...', 'मरीज़ के नाम या पोर्टल आईडी से खोजें...')}
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  {/* Lab Status Filter */}
                  <select
                    value={patientLabFilter}
                    onChange={(e) => setPatientLabFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1877F2]"
                  >
                    <option value="all">{t('All Lab Status', 'सभी लैब स्थिति')}</option>
                    <option value="Registered">{getLabStatusText('Registered', isHindi)}</option>
                    <option value="Test in Progress">{getLabStatusText('Test in Progress', isHindi)}</option>
                    <option value="Report Uploaded">{getLabStatusText('Report Uploaded', isHindi)}</option>
                  </select>

                  {/* Treatment Status Filter */}
                  <select
                    value={patientClinicalFilter}
                    onChange={(e) => setPatientClinicalFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1877F2]"
                  >
                    <option value="all">{t('All Treatment Status', 'सभी उपचार स्थिति')}</option>
                    <option value="Awaiting Doctor Review">{getTreatmentStatusText('Awaiting Doctor Review', isHindi)}</option>
                    <option value="Under Treatment">{getTreatmentStatusText('Under Treatment', isHindi)}</option>
                    <option value="Follow-up Required">{getTreatmentStatusText('Follow-up Required', isHindi)}</option>
                    <option value="Treatment Completed">{getTreatmentStatusText('Treatment Completed', isHindi)}</option>
                  </select>

                  {/* Risk Filter */}
                  <select
                    value={patientRiskFilter}
                    onChange={(e) => setPatientRiskFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1877F2]"
                  >
                    <option value="all">{t('All Risk Levels', 'सभी जोखिम स्तर')}</option>
                    <option value="High Risk">{getRiskLevelText('High Risk', isHindi)}</option>
                    <option value="Medium Risk">{getRiskLevelText('Medium Risk', isHindi)}</option>
                    <option value="Low Risk">{getRiskLevelText('Low Risk', isHindi)}</option>
                    <option value="Pending">{getRiskLevelText('Pending', isHindi)}</option>
                  </select>

                  {/* Sort Filter */}
                  <select
                    value={patientSort}
                    onChange={(e: any) => setPatientSort(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#1877F2]"
                  >
                    <option value="date-desc">{t('Newest First', 'नवीनतम पहले')}</option>
                    <option value="date-asc">{t('Oldest First', 'प्राचीनतम पहले')}</option>
                    <option value="name-asc">{t('Name A-Z', 'नाम अ-ज्ञ')}</option>
                    <option value="risk-desc">{t('Highest Risk First', 'उच्चतम जोखिम पहले')}</option>
                  </select>

                  {(patientQuery || patientLabFilter !== 'all' || patientClinicalFilter !== 'all' || patientRiskFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setPatientQuery('');
                        setPatientLabFilter('all');
                        setPatientClinicalFilter('all');
                        setPatientRiskFilter('all');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {t('Reset Filters', 'फ़िल्टर रीसेट करें')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Patients Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">{t('Patient Name & ID', 'मरीज़ का नाम व आईडी')}</th>
                      <th className="py-3.5 px-4">{t('Age / Gender', 'आयु / लिंग')}</th>
                      <th className="py-3.5 px-4">{t('Reg Date', 'पंजीकरण तिथि')}</th>
                      <th className="py-3.5 px-4">{t('Lab Status', 'प्रयोगशाला स्थिति')}</th>
                      <th className="py-3.5 px-4">{t('Clinical Status', 'नैदानिक स्थिति')}</th>
                      <th className="py-3.5 px-4">{t('Latest Report', 'नवीनतम रिपोर्ट')}</th>
                      <th className="py-3.5 px-4">{t('Latest MD Review', 'नवीनतम डॉक्टर समीक्षा')}</th>
                      <th className="py-3.5 px-4">{t('Cirrhosis Risk', 'सिरोसिस जोखिम')}</th>
                      <th className="py-3.5 px-5 text-right">{t('Action', 'कार्रवाई')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          {t('No patients found matching the selected filters.', 'चयनित फ़िल्टर से मेल खाने वाले कोई मरीज़ नहीं मिले।')}
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((pt) => {
                        const hasReports = pt.reports && pt.reports.length > 0;
                        const reviewDate = pt.treatment_status_updated_at || pt.updated_at;
                        return (
                          <tr key={pt.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-5">
                              <div>
                                <div className="font-bold text-slate-900">{pt.full_name}</div>
                                <div className="text-xs font-mono text-slate-500">{pt.portal_id}</div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                              {pt.age} {t('yrs', 'वर्ष')} • {pt.gender === 'Male' ? t('Male', 'पुरुष') : pt.gender === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-500">
                              {pt.created_at ? formatDateLocalized(pt.created_at, isHindi) : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4">{renderLabStatusBadge(pt.lab_workflow_status)}</td>
                            <td className="py-3.5 px-4">{renderClinicalStatusBadge(pt.treatment_status)}</td>
                            <td className="py-3.5 px-4 text-xs">
                              {hasReports ? (
                                <a
                                  href={api.reports.getDownloadUrl(pt.reports![0].id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#1877F2] font-semibold hover:underline"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>PDF ({pt.reports!.length})</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">{t('None', 'कोई नहीं')}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-500">
                              {pt.treatment_status === 'Awaiting Doctor Review' || !reviewDate ? (
                                <span className="text-amber-600 font-medium">{t('Pending MD', 'डॉक्टर लंबित')}</span>
                              ) : (
                                formatDateLocalized(reviewDate, isHindi)
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderRiskBadge(pt.latest_risk_label, pt.latest_risk_percent)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                onClick={() => handleOpenPatientDetails(pt.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#1877F2] hover:bg-[#1877F2] hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{t('View Details', 'विवरण देखें')}</span>
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
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 4: TREATMENT MONITORING (7-STAGE LIFECYCLE)                   */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'treatments' && (
          <div className="space-y-6">
            {/* SEPARATION OF CLINICAL VS LAB RESPONSIBILITIES NOTICE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('Hospital Clinical Governance Division', 'अस्पताल नैदानिक प्रशासन प्रभाग')}</h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    <strong>{t('Laboratory Workflow Status', 'प्रयोगशाला प्रक्रिया स्थिति')}</strong> {t('indicates specimen collection, testing, and report generation managed by Lab Technicians.', 'लैब तकनीशियन द्वारा प्रबंधित नमूना संग्रह, परीक्षण और रिपोर्ट का संकेत देती है।')}
                    <strong> {t('Clinical Treatment Status', 'नैदानिक उपचार स्थिति')}</strong> {t('represents clinical diagnosis, prescription management, diet plans, and discharge clearance managed exclusively by licensed Hepatologists. Administrative access maintains complete observational surveillance.', 'लाइसेंस प्राप्त हेपेटोलॉजिस्ट द्वारा प्रबंधित निदान, नुस्खे, आहार योजना और डिस्चार्ज का संकेत देती है। प्रशासनिक पहुंच केवल निगरानी हेतु है।')}
                  </p>
                </div>
              </div>
            </div>

            {/* 7-STAGE INTERACTIVE LIFECYCLE PIPELINE */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  {t('Patient Care Lifecycle Pipeline (7 Stages)', 'रोगी देखभाल जीवनचक्र प्रक्रिया (7 चरण)')}
                </h3>
                {treatmentStageFilter !== 'all' && (
                  <button
                    onClick={() => setTreatmentStageFilter('all')}
                    className="text-xs font-bold text-[#1877F2] hover:underline cursor-pointer"
                  >
                    {t('Clear Filter (Show All', 'फ़िल्टर हटाएं (सभी')} {patientsList.length} {t('Patients)', 'मरीज़ दिखाएं)')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* 1. Newly Registered */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'new' ? 'all' : 'new')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'new'
                      ? 'bg-blue-50 border-[#1877F2] ring-2 ring-[#1877F2]/20'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 1 • Lab', 'चरण 1 • लैब')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Newly Registered', 'नये पंजीकृत')}</div>
                  <div className="text-2xl font-extrabold text-[#1877F2] mt-2">{lifecycleCounts.newReg}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('Intake initiated', 'पंजीकरण शुरू')}</div>
                </div>

                {/* 2. Test in Progress */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'inprogress' ? 'all' : 'inprogress')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'inprogress'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 2 • Lab', 'चरण 2 • लैब')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Test in Progress', 'परीक्षण प्रगति पर')}</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-2">{lifecycleCounts.inProgress}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('Biomarkers entry', 'बायोमार्कर दर्ज')}</div>
                </div>

                {/* 3. Report Uploaded */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'uploaded' ? 'all' : 'uploaded')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'uploaded'
                      ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                      : 'bg-white border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 3 • Lab', 'चरण 3 • लैब')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Report Uploaded', 'रिपोर्ट अपलोड हुई')}</div>
                  <div className="text-2xl font-extrabold text-purple-600 mt-2">{lifecycleCounts.reportUploaded}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('PDF generated', 'पीडीएफ तैयार')}</div>
                </div>

                {/* 4. Awaiting Review */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'awaiting' ? 'all' : 'awaiting')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'awaiting'
                      ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-500/20'
                      : 'bg-white border-slate-200 hover:border-orange-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 4 • MD', 'चरण 4 • डॉक्टर')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Awaiting Review', 'समीक्षा प्रतीक्षारत')}</div>
                  <div className="text-2xl font-extrabold text-orange-600 mt-2">{lifecycleCounts.awaitingMD}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('MD queue', 'डॉक्टर कतार')}</div>
                </div>

                {/* 5. Under Treatment */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'under_rx' ? 'all' : 'under_rx')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'under_rx'
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 5 • MD', 'चरण 5 • डॉक्टर')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Under Treatment', 'उपचाराधीन')}</div>
                  <div className="text-2xl font-extrabold text-indigo-600 mt-2">{lifecycleCounts.underRx}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('Active therapy', 'सक्रिय उपचार')}</div>
                </div>

                {/* 6. Follow-up Required */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'follow_up' ? 'all' : 'follow_up')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'follow_up'
                      ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                      : 'bg-white border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 6 • MD', 'चरण 6 • डॉक्टर')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Follow-up Req.', 'फॉलो-अप आवश्यक')}</div>
                  <div className="text-2xl font-extrabold text-purple-600 mt-2">{lifecycleCounts.followUp}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('Next consult', 'अगला परामर्श')}</div>
                </div>

                {/* 7. Treatment Completed */}
                <div
                  onClick={() => setTreatmentStageFilter(treatmentStageFilter === 'completed' ? 'all' : 'completed')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    treatmentStageFilter === 'completed'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('Stage 7 • MD', 'चरण 7 • डॉक्टर')}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{t('Completed', 'संपन्न')}</div>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-2">{lifecycleCounts.completed}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{t('Stable / Done', 'स्थिर / पूर्ण')}</div>
                </div>
              </div>
            </div>

            {/* Filtered Treatment Patients Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">
                  {treatmentStageFilter === 'all'
                    ? t('All Patients in Lifecycle Pipeline', 'जीवनचक्र प्रक्रिया में सभी मरीज़')
                    : `${t('Patients in Selected Stage:', 'चयनित चरण में मरीज़:')} ${treatmentStageFilter}`}
                </div>
                <div className="text-xs text-slate-500">
                  {t('Showing', 'प्रदर्शित')} {treatmentFilteredPatients.length} {t('patient records', 'रोगी रिकॉर्ड')}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">{t('Patient Name & ID', 'मरीज़ का नाम व आईडी')}</th>
                      <th className="py-3.5 px-4">{t('Lab Workflow Status', 'प्रयोगशाला कार्यप्रवाह स्थिति')}</th>
                      <th className="py-3.5 px-4">{t('Doctor Treatment Status', 'डॉक्टर उपचार स्थिति')}</th>
                      <th className="py-3.5 px-4">{t('Attending Doctor', 'उपस्थित डॉक्टर')}</th>
                      <th className="py-3.5 px-4">{t('Last Status Updated', 'अंतिम स्थिति अपडेट')}</th>
                      <th className="py-3.5 px-4">{t('Prescriptions', 'दवा पर्चे')}</th>
                      <th className="py-3.5 px-5 text-right">{t('Action', 'कार्रवाई')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {treatmentFilteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          {t('No patients currently in this lifecycle stage.', 'वर्तमान में इस जीवनचक्र चरण में कोई मरीज़ नहीं है।')}
                        </td>
                      </tr>
                    ) : (
                      treatmentFilteredPatients.map((pt) => (
                        <tr key={pt.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <div>
                              <div className="font-bold text-slate-900">{pt.full_name}</div>
                              <div className="text-xs font-mono text-slate-500">{pt.portal_id}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">{renderLabStatusBadge(pt.lab_workflow_status)}</td>
                          <td className="py-3.5 px-4">{renderClinicalStatusBadge(pt.treatment_status)}</td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                            {pt.assigned_doctor_name || t('Dr. Demo Hepatologist', 'डॉ. डेमो हेपेटोलॉजिस्ट')}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {pt.treatment_status_updated_at
                              ? formatDateLocalized(pt.treatment_status_updated_at, isHindi)
                              : pt.updated_at
                              ? formatDateLocalized(pt.updated_at, isHindi)
                              : t('Pending Initial Review', 'प्रारंभिक समीक्षा लंबित')}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className="font-semibold text-slate-900">
                              {pt.prescriptions ? pt.prescriptions.length : (pt.treatment_status === 'Under Treatment' ? 1 : 0)}
                            </span> {t('active', 'सक्रिय')}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => handleOpenPatientDetails(pt.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#1877F2] hover:text-white text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('View Details', 'विवरण देखें')}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 5: REPORTS & ANALYTICS                                        */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Top Analytics Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Total Reports Uploaded', 'कुल अपलोड की गई रिपोर्ट')}</div>
                <div className="text-3xl font-extrabold text-[#1877F2] mt-2">
                  {stats?.total_reports ?? (patientsList.reduce((acc, p) => acc + (p.reports?.length || 0), 0) || 6)}
                </div>
                <div className="text-xs text-slate-400 mt-1">{t('Verified PDF pathology files', 'सत्यापित पीडीएफ पैथोलॉजी फाइलें')}</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('AI Predictions Evaluated', 'मूल्यांकित एआई भविष्यवाणियां')}</div>
                <div className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {stats?.total_predictions ?? totalPatients}
                </div>
                <div className="text-xs text-slate-400 mt-1">{t('Decision support scoring runs', 'निर्णय समर्थन स्कोरिंग गणनाएं')}</div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('Appointments Processed', 'प्रसंस्कृत अपॉइंटमेंट्स')}</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-2">
                  {appointmentsList.length}
                </div>
                <div className="text-xs text-slate-400 mt-1">{t('Patient consultations logged', 'दर्ज मरीज़ परामर्श')}</div>
              </div>
            </div>

            {/* Charts Row 1: Clinical Status Donut & Lab Pipeline Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 1: Clinical Treatment Status */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{t('Clinical Treatment Status Distribution', 'नैदानिक उपचार स्थिति वितरण')}</h3>
                  <p className="text-xs text-slate-500">{t('Breakdown of patient clinical disposition', 'मरीज़ों की नैदानिक स्थिति का विभाजन')}</p>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clinicalStatusChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {clinicalStatusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Laboratory Workflow Pipeline */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{t('Laboratory Workflow Status', 'प्रयोगशाला कार्यप्रवाह स्थिति')}</h3>
                  <p className="text-xs text-slate-500">{t('Intake, biomarker testing, and report generation', 'पंजीकरण, बायोमार्कर परीक्षण एवं रिपोर्ट निर्माण')}</p>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={labWorkflowChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {labWorkflowChartData.map((entry, index) => (
                          <Cell key={`lab-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2: AI Cirrhosis Risk & Appointment Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 3: AI Cirrhosis Risk Distribution */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{t('AI Cirrhosis Risk Stratification', 'एआई सिरोसिस जोखिम स्तरीकरण')}</h3>
                  <p className="text-xs text-slate-500">{t('Automated model assessment across all patients', 'सभी रोगियों में स्वचालित मॉडल मूल्यांकन')}</p>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistributionChartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        paddingAngle={3}
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {riskDistributionChartData.map((entry, index) => (
                          <Cell key={`risk-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Appointment Status Distribution */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{t('Appointment Requests Distribution', 'अपॉइंटमेंट अनुरोध वितरण')}</h3>
                  <p className="text-xs text-slate-500">{t('Pending, confirmed, and completed consultations', 'लंबित, पुष्ट एवं संपन्न परामर्श')}</p>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {appointmentsChartData.map((entry, index) => (
                          <Cell key={`app-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Chart 5: Age Demographics */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">{t('Patient Age Demographics', 'रोगी आयु जनसांख्यिकी')}</h3>
                <p className="text-xs text-slate-500">{t('Distribution across age groups', 'विभिन्न आयु वर्गों में वितरण')}</p>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageDemographicsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 6: SECURITY & AUDIT LOGS                                      */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('Search logs by action, user, or details...', 'कार्रवाई, उपयोगकर्ता या विवरण से लॉग खोजें...')}
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-medium focus:outline-none focus:border-[#1877F2]"
                >
                  <option value="all">{t('All Actions', 'सभी कार्रवाइयाँ')}</option>
                  <option value="login">{t('Logins', 'लॉगिन')}</option>
                  <option value="patient">{t('Patient Intake', 'रोगी प्रविष्टि')}</option>
                  <option value="report">{t('Lab Reports', 'लैब रिपोर्ट')}</option>
                  <option value="prescription">{t('Prescriptions', 'दवा पर्चे')}</option>
                  <option value="status">{t('Status Updates', 'स्थिति अपडेट')}</option>
                  <option value="appointment">{t('Appointments', 'अपॉइंटमेंट्स')}</option>
                </select>

                <button
                  onClick={() => fetchAllData(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{t('Refresh Logs', 'लॉग रिफ्रेश करें')}</span>
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">{t('Timestamp', 'समय')}</th>
                      <th className="py-3.5 px-4">{t('User / Actor', 'उपयोगकर्ता / कर्ता')}</th>
                      <th className="py-3.5 px-4">{t('Action', 'कार्रवाई')}</th>
                      <th className="py-3.5 px-4">{t('Audit Details', 'ऑडिट विवरण')}</th>
                      <th className="py-3.5 px-5 text-right">{t('Result', 'परिणाम')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          {t('No audit log records found matching query.', 'खोज से मेल खाने वाला कोई ऑडिट रिकॉर्ड नहीं मिला।')}
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {log.created_at ? formatDateLocalized(log.created_at, isHindi) : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div>
                              <div className="font-bold text-slate-900">{log.user_name || log.user_email || t('System', 'सिस्टम')}</div>
                              <div className="text-xs text-slate-400">{log.user_role || 'audit'}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1877F2] border border-blue-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 max-w-md truncate">
                            {log.details}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('Success', 'सफल')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* READ-ONLY PATIENT DETAILS AUDIT MODAL                              */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        size="2xl"
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#1877F2]" />
              <span className="font-bold text-slate-900">
                {t('Patient Clinical Audit • ', 'रोगी नैदानिक ऑडिट • ')}{selectedPatientData?.full_name || t('Loading...', 'लोड हो रहा है...')}
              </span>
            </div>
            {selectedPatientData && renderRiskBadge(selectedPatientData.latest_risk_label, selectedPatientData.latest_risk_percent)}
          </div>
        }
      >
        {detailsModalLoading && !selectedPatientData ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#1877F2] mb-3" />
            <p className="text-sm font-medium">{t('Retrieving verified clinical record from secure database...', 'सुरक्षित डेटाबेस से सत्यापित नैदानिक रिकॉर्ड प्राप्त किया जा रहा है...')}</p>
          </div>
        ) : selectedPatientData ? (
          <div className="space-y-6 pt-2">
            {/* ADMINISTRATIVE READ-ONLY GOVERNANCE NOTICE */}
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t('Administrative Read-Only View:', 'प्रशासनिक केवल-पठन दृश्य:')}</span> {t('Clinical observations, lab biomarker values, prescriptions, and appointment records are displayed in read-only audit mode. Administrators cannot modify clinical records or medical advice.', 'नैदानिक अवलोकन, प्रयोगशाला बायोमार्कर मान, नुस्खे और अपॉइंटमेंट रिकॉर्ड केवल-पठन ऑडिट मोड में प्रदर्शित होते हैं। व्यवस्थापक नैदानिक रिकॉर्ड या चिकित्सा सलाह को संशोधित नहीं कर सकते हैं।')}
              </div>
            </div>

            {/* PATIENT DEMOGRAPHICS & PROFILE HEADER */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">{t('Patient ID', 'रोगी आईडी')}</span>
                <span className="text-slate-900 font-mono font-bold text-sm">{selectedPatientData.portal_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('Age & Gender', 'आयु व लिंग')}</span>
                <span className="text-slate-900 font-bold text-sm">{selectedPatientData.age} {t('yrs', 'वर्ष')} • {selectedPatientData.gender === 'Male' ? t('Male', 'पुरुष') : selectedPatientData.gender === 'Female' ? t('Female', 'महिला') : t('Other', 'अन्य')}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('Lab Status', 'प्रयोगशाला स्थिति')}</span>
                <span className="mt-0.5 block">{renderLabStatusBadge(selectedPatientData.lab_workflow_status)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">{t('Treatment Status', 'उपचार स्थिति')}</span>
                <span className="mt-0.5 block">{renderClinicalStatusBadge(selectedPatientData.treatment_status)}</span>
              </div>
            </div>

            {/* SECTION 1: 8 CORE BIOMARKERS GRID */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {t('Laboratory Biomarkers & Reference Ranges', 'प्रयोगशाला बायोमार्कर एवं संदर्भ श्रेणियाँ')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Total Bilirubin */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Total Bilirubin', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.bilirubin !== null && selectedPatientData.bilirubin !== undefined ? `${selectedPatientData.bilirubin} mg/dL` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 0.2 - 1.2 mg/dL</div>
                </div>

                {/* 2. Direct Bilirubin */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Direct Bilirubin', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.direct_bilirubin !== null && selectedPatientData.direct_bilirubin !== undefined ? `${selectedPatientData.direct_bilirubin} mg/dL` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 0.0 - 0.4 mg/dL</div>
                </div>

                {/* 3. AST / SGOT */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('SGOT (AST)', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.sgot !== null && selectedPatientData.sgot !== undefined ? `${selectedPatientData.sgot} U/L` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 10 - 40 U/L</div>
                </div>

                {/* 4. ALT / SGPT */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('SGPT (ALT)', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.sgpt !== null && selectedPatientData.sgpt !== undefined ? `${selectedPatientData.sgpt} U/L` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 7 - 56 U/L</div>
                </div>

                {/* 5. Albumin */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Albumin', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.albumin !== null && selectedPatientData.albumin !== undefined ? `${selectedPatientData.albumin} g/dL` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 3.5 - 5.0 g/dL</div>
                </div>

                {/* 6. Platelets */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Platelets', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.platelets !== null && selectedPatientData.platelets !== undefined ? `${selectedPatientData.platelets} ×10³/µL` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 150 - 450 ×10³/µL</div>
                </div>

                {/* 7. Prothrombin Time */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Prothrombin Time', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.prothrombin !== null && selectedPatientData.prothrombin !== undefined ? `${selectedPatientData.prothrombin} sec` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 11.0 - 15.0 sec</div>
                </div>

                {/* 8. Alkaline Phosphatase */}
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600">{getBiomarkerName('Alk Phosphatase', isHindi)}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedPatientData.alk_phos !== null && selectedPatientData.alk_phos !== undefined ? `${selectedPatientData.alk_phos} U/L` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Ref: 40 - 129 U/L</div>
                </div>
              </div>

              {/* Clinical Signs */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-lg border font-medium ${selectedPatientData.ascites ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {t('Ascites:', 'जलोदर (Ascites):')} {selectedPatientData.ascites ? t('Present', 'उपस्थित') : t('Absent', 'अनुपस्थित')}
                </span>
                <span className={`px-2.5 py-1 rounded-lg border font-medium ${selectedPatientData.hepatomegaly ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {t('Hepatomegaly:', 'यकृत वृद्धि (Hepatomegaly):')} {selectedPatientData.hepatomegaly ? t('Present', 'उपस्थित') : t('Absent', 'अनुपस्थित')}
                </span>
                <span className={`px-2.5 py-1 rounded-lg border font-medium ${selectedPatientData.spiders ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {t('Spider Angiomas:', 'स्पाइडर एंजियोमा:')} {selectedPatientData.spiders ? t('Present', 'उपस्थित') : t('Absent', 'अनुपस्थित')}
                </span>
                <span className={`px-2.5 py-1 rounded-lg border font-medium ${selectedPatientData.edema ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {t('Peripheral Edema:', 'पैरों में सूजन (Edema):')} {selectedPatientData.edema ? t('Present', 'उपस्थित') : t('Absent', 'अनुपस्थित')}
                </span>
              </div>
            </div>

            {/* SECTION 2: UPLOADED LABORATORY REPORTS */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {t('Laboratory PDF Reports', 'प्रयोगशाला पीडीएफ रिपोर्ट')}
              </h4>
              {selectedPatientData.reports && selectedPatientData.reports.length > 0 ? (
                <div className="space-y-2">
                  {selectedPatientData.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{rep.filename}</div>
                          <div className="text-xs text-slate-500">
                            {t('Uploaded', 'अपलोड किया')} {rep.uploaded_at ? formatDateLocalized(rep.uploaded_at, isHindi) : t('Recently', 'हाल ही में')} • {t('Verified by Lab Tech', 'लैब टेक द्वारा सत्यापित')}
                          </div>
                        </div>
                      </div>

                      <a
                        href={api.reports.getDownloadUrl(rep.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#1877F2] hover:bg-[#1877F2] hover:text-white text-xs font-semibold transition-all shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('View PDF', 'पीडीएफ देखें')}</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 text-center">
                  {t('No PDF laboratory reports currently uploaded for this patient.', 'इस मरीज़ के लिए वर्तमान में कोई पीडीएफ लैब रिपोर्ट अपलोड नहीं की गई है।')}
                </div>
              )}
            </div>

            {/* SECTION 3: PRESCRIPTIONS & DIET/CARE ADVICE */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {t('Prescriptions & Clinical Advice', 'दवा पर्चे एवं नैदानिक सलाह')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Diet Plan */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-emerald-600" />
                    <span>{t('Diet Plan', 'आहार योजना')}</span>
                  </div>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                    {selectedPatientData.diet_plan || (isHindi ? 'कम नमक वाला आहार लें। ताजे फल और प्रोटीन शामिल करें। तला-भुना और मसालेदार भोजन न लें।' : 'Eat a low-salt diet. Include fresh fruits and lean proteins. Avoid fried, spicy, and heavily processed meals.')}
                  </p>
                </div>

                {/* Care Instructions */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-[#1877F2]" />
                    <span>{t('Care Instructions', 'देखभाल निर्देश')}</span>
                  </div>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                    {selectedPatientData.care_instructions || (isHindi ? 'शराब का सेवन पूरी तरह से बंद करें। पर्याप्त आराम करें। पेट में सूजन या पीलिया बढ़ने पर तुरंत डॉक्टर से संपर्क करें।' : 'Strictly avoid alcohol consumption. Take adequate rest. Report immediately if abdominal swelling, severe jaundice, or bleeding occurs.')}
                  </p>
                </div>
              </div>

              {/* Prescriptions List */}
              {selectedPatientData.prescriptions && selectedPatientData.prescriptions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedPatientData.prescriptions.map((rx) => (
                    <div key={rx.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{rx.medicine}</span>
                        <span className="text-slate-500 ml-2">({rx.dosage})</span>
                      </div>
                      <span className="text-slate-500">{t('Every', 'प्रत्येक')} {rx.frequency_days} {t('day(s)', 'दिन')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 4: APPOINTMENTS */}
            {selectedPatientData.appointments && selectedPatientData.appointments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {t('Appointment History', 'अपॉइंटमेंट इतिहास')}
                </h4>
                <div className="space-y-2">
                  {selectedPatientData.appointments.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{a.appointment_type || t('Consultation', 'परामर्श')}</span>
                        <span className="text-slate-500 ml-2">({a.scheduled_at})</span>
                        <div className="text-slate-500 text-[11px] mt-0.5">{a.reason}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                        a.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {getAppointmentStatusText(a.status, isHindi)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

    </div>
  );
};

export default AdminDashboardPage;
