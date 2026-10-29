import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Activity, FlaskConical, HeartPulse, Stethoscope, User } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AILiverMonitoringDashboardPage } from '@/pages/AILiverMonitoringDashboardPage';
import { AIPredictionReviewPage } from '@/pages/AIPredictionReviewPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { ClinicalReviewPage } from '@/pages/ClinicalReviewPage';
import { DoctorAppointmentRequestsPage } from '@/pages/DoctorAppointmentRequestsPage';
import { HepatologistDashboardPage } from '@/pages/HepatologistDashboardPage';
import { LabTechDashboardPage } from '@/pages/LabTechDashboardPage';
import { LabUploadPage } from '@/pages/LabUploadPage';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { ActivateAccountPage } from '@/pages/ActivateAccountPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { PatientDashboardPage } from '@/pages/PatientDashboardPage';
import { PatientProfilePage } from '@/pages/PatientProfilePage';
import { PatientRecordsPage } from '@/pages/PatientRecordsPage';
import { PatientReportsPage } from '@/pages/PatientReportsPage';
import { PatientBiomarkersPage } from '@/pages/PatientBiomarkersPage';
import { PatientPredictionsPage } from '@/pages/PatientPredictionsPage';
import { PatientAppointmentsPage } from '@/pages/PatientAppointmentsPage';
import { PatientsPage } from '@/pages/PatientsPage';
import { PrescriptionsPage } from '@/pages/PrescriptionsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { RoleDashboardPlaceholder } from '@/pages/RoleDashboardPlaceholder';
import { SettingsPage } from '@/pages/SettingsPage';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Verifying clinical session credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If user's role is not allowed, redirect to their home portal
    const defaultHome =
      user.role === 'admin'
        ? '/admin'
        : user.role === 'hepatologist'
        ? '/doctor'
        : user.role === 'patient'
        ? '/patient'
        : '/lab';
    return <Navigate to={defaultHome} replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />
      <Route path="/activate/:token" element={<ActivateAccountPage />} />
      <Route path="/activate-account/:token" element={<ActivateAccountPage />} />

      {/* Authenticated Dashboard Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Lab Technician Workspace */}
        <Route
          path="/lab"
          element={
            <ProtectedRoute allowedRoles={['labtech', 'admin']}>
              <LabTechDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lab/upload"
          element={
            <ProtectedRoute allowedRoles={['labtech', 'admin', 'hepatologist']}>
              <LabUploadPage />
            </ProtectedRoute>
          }
        />

        {/* Hepatologist Clinical Workspace */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
              <HepatologistDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/appointments"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
              <DoctorAppointmentRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/appointment-requests"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
              <DoctorAppointmentRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/reviews"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
              <ClinicalReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treatment"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
              <ClinicalReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/predictions"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin', 'labtech']}>
              <AIPredictionReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-predictions"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin', 'labtech']}>
              <AIPredictionReviewPage />
            </ProtectedRoute>
          }
        />

        {/* Patient Health Portal */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/records"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientRecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/reports"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/biomarkers"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientBiomarkersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/predictions"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientPredictionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientAppointmentsPage />
            </ProtectedRoute>
          }
        />

        {/* Shared Workspaces */}
        <Route
          path="/liver-monitoring"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin', 'labtech']}>
              <AILiverMonitoringDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute allowedRoles={['hepatologist', 'admin', 'labtech']}>
              <AILiverMonitoringDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={['admin', 'hepatologist', 'labtech']}>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            user?.role === 'hepatologist' ? (
              <ProtectedRoute allowedRoles={['hepatologist', 'admin']}>
                <DoctorAppointmentRequestsPage />
              </ProtectedRoute>
            ) : (
              <AppointmentsPage />
            )
          }
        />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/prescriptions" element={<PrescriptionsPage />} />
        <Route
          path="/logs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
