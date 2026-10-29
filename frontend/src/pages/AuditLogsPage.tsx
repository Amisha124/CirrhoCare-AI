import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FlaskConical,
  HeartPulse,
  Info,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Column, DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { api } from '@/services/api';
import type { ActivityLogItem } from '@/types';

export const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const { error, success } = useToast();

  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const perPage = 20;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.logs.list({
        q: searchQuery.trim() || undefined,
        action: selectedAction.trim() || undefined,
        role: selectedRole.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortColumn,
        sort_dir: sortDirection,
        page,
        per_page: perPage,
      });

      if (res && res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      } else {
        error('Failed to load system audit logs.');
      }
    } catch (err: any) {
      error(err.message || 'Error fetching activity logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedAction, selectedRole, startDate, endDate, sortColumn, sortDirection, page, error]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handlePreset = (preset: 'all' | 'today' | '7d' | '30d') => {
    setActivePreset(preset);
    setPage(1);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
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
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRole('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setActivePreset('all');
    setSortColumn('created_at');
    setSortDirection('desc');
    setPage(1);
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    success('Event details copied to clipboard.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedRole || selectedAction || startDate || endDate || activePreset !== 'all'
  );

  // Categorize action for colorful badges
  const getActionBadgeVariant = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('login') || act.includes('auth') || act.includes('password') || act.includes('registered')) {
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Auth & Access' };
    }
    if (act.includes('patient') || act.includes('deleted patient')) {
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Patient Record' };
    }
    if (act.includes('prescription') || act.includes('clinical') || act.includes('review')) {
      return { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'Clinical Care' };
    }
    if (act.includes('appointment')) {
      return { bg: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500', label: 'Appointments' };
    }
    if (act.includes('report') || act.includes('upload')) {
      return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', label: 'Diagnostics' };
    }
    if (act.includes('export')) {
      return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Registry Export' };
    }
    return { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', label: 'System Event' };
  };

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">Admin</span>;
      case 'hepatologist':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Hepatologist</span>;
      case 'labtech':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-50 text-teal-700 border border-teal-200">Lab Tech</span>;
      case 'patient':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Patient</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">System</span>;
    }
  };

  // KPI calculations from currently loaded scope
  const authEventsCount = logs.filter((l) => {
    const act = l.action.toLowerCase();
    return act.includes('login') || act.includes('logout') || act.includes('password') || act.includes('auth');
  }).length;

  const clinicalEventsCount = logs.filter((l) => {
    const act = l.action.toLowerCase();
    return act.includes('patient') || act.includes('prescription') || act.includes('appointment') || act.includes('report');
  }).length;

  const uniqueActors = new Set(logs.map((l) => l.user_email).filter(Boolean)).size;

  // Table Columns Definition
  const columns: Column<ActivityLogItem>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (log) => {
        const d = new Date(log.created_at);
        return (
          <div className="flex flex-col text-xs font-mono">
            <span className="font-semibold text-slate-800">
              {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Operation / Action',
      sortable: true,
      render: (log) => {
        const badge = getActionBadgeVariant(log.action);
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="font-bold text-slate-900 text-xs">{log.action}</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>
        );
      },
    },
    {
      key: 'details',
      header: 'Execution Context & Details',
      render: (log) => (
        <div
          onClick={() => setSelectedLog(log)}
          className="cursor-pointer group flex items-center justify-between gap-2 max-w-sm lg:max-w-md py-1"
          title="Click to view full event context"
        >
          <span className="text-xs text-slate-600 group-hover:text-purple-700 transition leading-relaxed truncate font-medium">
            {log.details || '—'}
          </span>
          <Eye className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 shrink-0 transition opacity-0 group-hover:opacity-100" />
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Performer / Actor',
      render: (log) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-800">
            {log.user_name || (log.user_email === 'System' ? 'System Service' : log.user_email)}
          </span>
          {log.user_email && log.user_email !== 'System' && (
            <span className="text-[11px] text-slate-400 font-mono">{log.user_email}</span>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (log) => getRoleBadge(log.user_role),
    },
    {
      key: 'actions',
      header: 'Inspect',
      render: (log) => (
        <button
          onClick={() => setSelectedLog(log)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 rounded-lg border border-slate-200 hover:border-purple-200 transition"
        >
          <Eye className="w-3 h-3" /> View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Security & Compliance Oversight
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Activity Audit Logs
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Immutable, server-verified chronological ledger recording clinical modifications, authentication events, and system activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Logs'}
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Audit Events"
          value={total}
          accent="purple"
          icon={<Database className="w-6 h-6 text-purple-600" />}
          subtitle="All-time recorded events"
        />
        <KpiCard
          title="Auth & Security Actions"
          value={authEventsCount}
          accent="blue"
          icon={<Shield className="w-6 h-6 text-blue-600" />}
          subtitle="Logins, resets, & sessions"
        />
        <KpiCard
          title="Clinical Operations"
          value={clinicalEventsCount}
          accent="teal"
          icon={<Stethoscope className="w-6 h-6 text-teal-600" />}
          subtitle="Records, reviews, & reports"
        />
        <KpiCard
          title="Distinct Actors"
          value={uniqueActors}
          accent="orange"
          icon={<Users className="w-6 h-6 text-amber-600" />}
          subtitle="Users in current scope"
        />
      </div>

      {/* 3. Search and Multi-Filter Toolbar */}
      <Card accentColor="purple">
        <CardContent className="p-5 space-y-4">
          {/* Search bar & Dropdowns */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="relative md:col-span-6">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search logs by action, details, user name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:bg-white transition"
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

            <div className="md:col-span-3">
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-slate-700 font-medium"
              >
                <option value="">All Performer Roles</option>
                <option value="admin">Administrator</option>
                <option value="hepatologist">Hepatologist</option>
                <option value="labtech">Lab Technician</option>
                <option value="patient">Patient</option>
                <option value="system">System / Background</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-slate-700 font-medium"
              >
                <option value="">All Action Types</option>
                <option value="Login">Authentication (Login / Logout)</option>
                <option value="Patient">Patient Demographics & Records</option>
                <option value="Prescription">Clinical Prescriptions</option>
                <option value="Appointment">Consultations & Appointments</option>
                <option value="Report">Laboratory & Scans</option>
                <option value="Export">Registry & Report Exports</option>
                <option value="Password">Password & Security Resets</option>
                <option value="Status">User / Record Status Changes</option>
              </select>
            </div>
          </form>

          {/* Date Range Toolbar & Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> Period:
              </span>
              {[
                { id: 'all', label: 'All Records' },
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePreset(p.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    activePreset === p.id && !hasActiveFilters && p.id === 'all'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : activePreset === p.id && p.id !== 'all'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Dates & Clear */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Custom:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('all');
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-purple-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('all');
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-purple-500"
              />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold transition px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200"
                >
                  <X className="w-3 h-3" /> Clear Filters
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. DataTable with Server-Side Pagination */}
      <Card>
        <CardHeader
          title="Audit Trail Log"
          subtitle={`Displaying records matching current filters (${logs.length} of ${total} total)`}
          action={
            <Badge variant="role">
              Page {page} of {Math.ceil(total / perPage) || 1}
            </Badge>
          }
        />
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={logs}
            isLoading={isLoading}
            emptyMessage={
              hasActiveFilters
                ? 'No audit log records match the selected search, role, or date criteria.'
                : 'No activity logs currently stored in the system audit database.'
            }
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            pagination={{
              currentPage: page,
              totalPages: Math.ceil(total / perPage) || 1,
              totalItems: total,
              onPageChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      {/* 5. Detailed Log Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          size="lg"
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <span>Audit Log Record #{selectedLog.id}</span>
            </div>
          }
          description="Detailed execution metadata, actor provenance, and audit trail payload."
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Database className="w-3.5 h-3.5 text-slate-400" /> Immutable SQLite Ledger
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyDetails(JSON.stringify(selectedLog, null, 2))}
                  leftIcon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {isCopied ? 'Copied JSON' : 'Copy JSON'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-xs">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">
                  Action Executed
                </span>
                <span className="font-bold text-slate-900 text-sm block">{selectedLog.action}</span>
                <div className="pt-1">{getActionBadgeVariant(selectedLog.action).label}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">
                  Recorded Timestamp
                </span>
                <span className="font-bold text-slate-900 text-sm block">
                  {new Date(selectedLog.created_at).toLocaleString([], {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">ISO: {selectedLog.created_at}</span>
              </div>
            </div>

            {/* Actor Information */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" /> Performer Provenance
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Actor Name</span>
                  <span className="font-bold text-slate-900">{selectedLog.user_name || 'System / Automated'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Contact Email</span>
                  <span className="font-mono text-slate-800">{selectedLog.user_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Authorized Role</span>
                  <div className="mt-0.5">{getRoleBadge(selectedLog.user_role)}</div>
                </div>
              </div>
            </div>

            {/* Execution Details & Payload */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-purple-600" /> Execution Outcome & Context
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyDetails(selectedLog.details || '')}
                  className="text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" /> Copy Text
                </button>
              </div>
              <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs whitespace-pre-wrap break-words leading-relaxed border border-slate-800 shadow-inner">
                {selectedLog.details || 'No additional execution payload recorded for this event.'}
              </div>
            </div>

            {/* Compliance Guarantee */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Tamper-Evident System Audit Record</p>
                <p className="text-emerald-800 mt-0.5 leading-relaxed">
                  This record was committed automatically by the server-side authentication and activity logging subsystem. Audit records cannot be edited or erased via user interfaces.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuditLogsPage;
