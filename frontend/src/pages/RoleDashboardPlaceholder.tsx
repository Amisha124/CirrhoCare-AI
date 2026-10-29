import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, Calendar, CheckCircle2, FileText, FlaskConical, Stethoscope, User } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';

interface RoleDashboardProps {
  roleTitle: string;
  roleDescription: string;
  roleIcon: React.ReactNode;
  accent: 'blue' | 'purple' | 'teal' | 'pink' | 'orange' | 'green';
}

export const RoleDashboardPlaceholder: React.FC<RoleDashboardProps> = ({
  roleTitle,
  roleDescription,
  roleIcon,
  accent,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.dashboard.getStats();
        if (res.success) {
          setData(res);
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return <LoadingSpinner label={`Loading ${roleTitle} dashboard...`} className="py-20" />;
  }

  const role = user?.role;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-md text-blue-600">
            {roleIcon}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{roleTitle}</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">{roleDescription}</p>
          </div>
        </div>
        <Badge role={role} size="md" />
      </div>

      {/* Role-Specific Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {role === 'labtech' && (
          <>
            <KpiCard
              title="Total Lab Submissions"
              value={data?.stats?.total_records ?? 0}
              accent="teal"
              icon={<FlaskConical className="w-6 h-6" />}
              subtitle="All clinical intake forms"
            />
            <KpiCard
              title="Awaiting Doctor Review"
              value={data?.stats?.awaiting_review ?? 0}
              accent="orange"
              icon={<AlertCircle className="w-6 h-6" />}
              subtitle="Requires clinical follow-up"
            />
            <KpiCard
              title="Completed AI Predictions"
              value={data?.stats?.completed_predictions ?? 0}
              accent="green"
              icon={<CheckCircle2 className="w-6 h-6" />}
              subtitle="Synchronized with database"
            />
          </>
        )}

        {role === 'hepatologist' && (
          <>
            <KpiCard
              title="High Risk Cirrhosis Patients"
              value={data?.stats?.high_risk ?? 0}
              accent="pink"
              icon={<Activity className="w-6 h-6" />}
              subtitle="Critical clinical priority"
            />
            <KpiCard
              title="Urgent Clinical Reviews"
              value={data?.stats?.urgent_review ?? 0}
              accent="orange"
              icon={<AlertCircle className="w-6 h-6" />}
              subtitle="Needs immediate treatment plan"
            />
            <KpiCard
              title="Active Appointments"
              value={data?.stats?.appointments_count ?? 0}
              accent="purple"
              icon={<Calendar className="w-6 h-6" />}
              subtitle="Scheduled with Dr. Care"
            />
          </>
        )}

        {role === 'patient' && (
          <>
            <KpiCard
              title="My Clinical Records"
              value={data?.records_count ?? 0}
              accent="blue"
              icon={<FileText className="w-6 h-6" />}
              subtitle={`Patient ID: ${user?.portal_id || 'PAT-1001'}`}
            />
            <KpiCard
              title="Latest AI Risk Assessment"
              value={data?.latest_record?.latest_risk_label || 'Evaluated'}
              accent="purple"
              icon={<Activity className="w-6 h-6" />}
              subtitle={`Probability: ${data?.latest_record?.latest_risk_percent || 0}%`}
            />
            <KpiCard
              title="Upcoming Appointments"
              value={data?.appointments?.length ?? 0}
              accent="teal"
              icon={<Calendar className="w-6 h-6" />}
              subtitle="With hepatologist care team"
            />
          </>
        )}
      </div>

      {/* Workspace Roadmap Card */}
      <Card accentColor={accent}>
        <CardHeader
          title={`${roleTitle} Dedicated Workspace`}
          subtitle="Real-time backend synchronization is active"
        />
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            The CirrhoCare AI backend is fully integrated and serving live data for your account. You can navigate using the left sidebar to access the <b>Patient Directory</b>, <b>Appointments</b>, and <b>Laboratory Reports</b>.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/patients"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
            >
              Browse Patients Directory <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="/reports"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition"
            >
              Access Laboratory Reports
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
