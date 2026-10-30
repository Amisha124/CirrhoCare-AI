import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  Pill,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UploadCloud,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, isHindi } = useLanguage();
  const role = user?.role || 'admin';
  const location = useLocation();
  const navigate = useNavigate();

  // Pending appointment requests counter for hepatologists
  const [pendingDoctorRequestsCount, setPendingDoctorRequestsCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (role !== 'hepatologist') return;

    let isMounted = true;
    const fetchPending = async () => {
      try {
        const res = await api.appointments.list({ status: 'Pending', per_page: 100 });
        if (res && res.success && isMounted) {
          setPendingDoctorRequestsCount(res.total ?? res.appointments?.length ?? 0);
        }
      } catch {
        // silent fail
      }
    };

    fetchPending();

    const handleUpdate = () => {
      fetchPending();
    };

    window.addEventListener('appointment-updated', handleUpdate);
    const interval = setInterval(fetchPending, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener('appointment-updated', handleUpdate);
      clearInterval(interval);
    };
  }, [role]);

  const isItemActive = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin' && (!location.search || location.search === '' || location.search.includes('tab=overview'));
    }
    if (href.startsWith('/admin?tab=')) {
      const tabParam = href.split('tab=')[1];
      return location.pathname === '/admin' && location.search.includes(`tab=${tabParam}`);
    }
    return location.pathname === href;
  };

  // Navigation items scoped and customized per role
  const adminItems = [
    {
      title: isHindi ? 'अवलोकन' : 'Overview',
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
      href: '/admin',
    },
    {
      title: isHindi ? 'उपयोगकर्ता एवं स्टाफ' : 'Users & Staff',
      icon: <Users className="w-5 h-5 shrink-0" />,
      href: '/admin?tab=users',
    },
    {
      title: isHindi ? 'रोगी निगरानी' : 'Patient Monitoring',
      icon: <HeartPulse className="w-5 h-5 shrink-0" />,
      href: '/admin?tab=patients',
    },
    {
      title: isHindi ? 'उपचार निगरानी' : 'Treatment Monitoring',
      icon: <Activity className="w-5 h-5 shrink-0" />,
      href: '/admin?tab=treatments',
    },
    {
      title: isHindi ? 'रिपोर्ट एवं एनालिटिक्स' : 'Reports & Analytics',
      icon: <BarChart3 className="w-5 h-5 shrink-0" />,
      href: '/admin?tab=analytics',
    },
    {
      title: isHindi ? 'सुरक्षा एवं ऑडिट लॉग' : 'Security & Audit Logs',
      icon: <ShieldCheck className="w-5 h-5 shrink-0" />,
      href: '/admin?tab=audit',
    },
  ];

  const labTechItems = [
    {
      title: 'Dashboard',
      icon: <Activity className="w-5 h-5 shrink-0" />,
      href: '/lab',
    },
    {
      title: 'AI Liver Monitoring',
      icon: <HeartPulse className="w-5 h-5 shrink-0" />,
      href: '/liver-monitoring',
    },
    {
      title: 'Patient Records',
      icon: <Users className="w-5 h-5 shrink-0" />,
      href: '/patients',
    },
    {
      title: 'Lab Reports',
      icon: <FileText className="w-5 h-5 shrink-0" />,
      href: '/reports',
    },
    {
      title: 'Report Analytics',
      icon: <BarChart3 className="w-5 h-5 shrink-0" />,
      href: '/analytics',
    },
    {
      title: 'Upload Report',
      icon: <UploadCloud className="w-5 h-5 shrink-0" />,
      href: '/lab/upload',
    },
    {
      title: 'Notifications',
      icon: <Bell className="w-5 h-5 shrink-0" />,
      href: '/notifications',
    },
    {
      title: 'Profile',
      icon: <User className="w-5 h-5 shrink-0" />,
      href: '/settings',
    },
  ];

  const hepatologistItems = [
    {
      title: 'Dashboard',
      icon: <Activity className="w-5 h-5 shrink-0" />,
      href: '/doctor',
    },
    {
      title: 'AI Liver Monitoring',
      icon: <HeartPulse className="w-5 h-5 shrink-0" />,
      href: '/liver-monitoring',
    },
    {
      title: 'My Patients',
      icon: <Users className="w-5 h-5 shrink-0" />,
      href: '/patients',
    },
    {
      title: 'Clinical Reviews',
      icon: <Stethoscope className="w-5 h-5 shrink-0" />,
      href: '/doctor/reviews',
    },
    {
      title: 'Lab Reports',
      icon: <FileText className="w-5 h-5 shrink-0" />,
      href: '/reports',
    },
    {
      title: 'Report Analytics',
      icon: <BarChart3 className="w-5 h-5 shrink-0" />,
      href: '/analytics',
    },
    {
      title: 'AI Predictions',
      icon: <FlaskConical className="w-5 h-5 shrink-0" />,
      href: '/doctor/predictions',
    },
    {
      title: 'Appointments',
      icon: <Calendar className="w-5 h-5 shrink-0" />,
      href: '/appointments',
    },
    {
      title: 'Prescriptions',
      icon: <ClipboardList className="w-5 h-5 shrink-0" />,
      href: '/prescriptions',
    },
    {
      title: 'Notifications',
      icon: <Bell className="w-5 h-5 shrink-0" />,
      href: '/notifications',
    },
    {
      title: 'Profile',
      icon: <User className="w-5 h-5 shrink-0" />,
      href: '/settings',
    },
  ];

  const navItems = [
    {
      title: 'Dashboard',
      icon: <Activity className="w-5 h-5 shrink-0" />,
      href: role === 'admin' ? '/admin' : role === 'hepatologist' ? '/doctor' : role === 'patient' ? '/patient' : '/lab',
      allowedRoles: ['admin', 'labtech', 'hepatologist', 'patient'],
    },
    {
      title: 'Patients Directory',
      icon: <Users className="w-5 h-5 shrink-0" />,
      href: '/patients',
      allowedRoles: ['admin', 'labtech', 'hepatologist'],
    },
    {
      title: 'AI Lab & Predictions',
      icon: <FlaskConical className="w-5 h-5 shrink-0" />,
      href: '/doctor/predictions',
      allowedRoles: ['admin', 'labtech', 'hepatologist'],
    },
    {
      title: 'Clinical Treatment',
      icon: <Stethoscope className="w-5 h-5 shrink-0" />,
      href: '/doctor/reviews',
      allowedRoles: ['hepatologist', 'admin'],
    },
    {
      title: 'Appointments',
      icon: <Calendar className="w-5 h-5 shrink-0" />,
      href: '/appointments',
      allowedRoles: ['admin', 'labtech', 'hepatologist', 'patient'],
    },
    {
      title: 'Lab Reports',
      icon: <FileText className="w-5 h-5 shrink-0" />,
      href: '/reports',
      allowedRoles: ['admin', 'labtech', 'hepatologist', 'patient'],
    },
    {
      title: 'Prescriptions',
      icon: <ClipboardList className="w-5 h-5 shrink-0" />,
      href: '/prescriptions',
      allowedRoles: ['patient', 'hepatologist', 'admin'],
    },
    {
      title: 'Analytics & Insights',
      icon: <BarChart3 className="w-5 h-5 shrink-0" />,
      href: '/analytics',
      allowedRoles: ['admin', 'hepatologist', 'labtech'],
    },
    {
      title: 'System Audit Logs',
      icon: <ShieldAlert className="w-5 h-5 shrink-0" />,
      href: '/logs',
      allowedRoles: ['admin'],
    },
    {
      title: 'Settings',
      icon: <Settings className="w-5 h-5 shrink-0" />,
      href: '/settings',
      allowedRoles: ['admin', 'labtech', 'hepatologist', 'patient'],
    },
  ];

  // Admin-specific navigation matching simplified 6 items + Logout
  if (role === 'admin') {
    const adminNavList = [
      {
        title: 'Overview',
        hindi: 'अवलोकन',
        icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        href: '/admin',
      },
      {
        title: 'Users & Staff',
        hindi: 'उपयोगकर्ता और कर्मचारी',
        icon: <Users className="w-5 h-5 shrink-0" />,
        href: '/admin?tab=users',
      },
      {
        title: 'Patient Monitoring',
        hindi: 'रोगी निगरानी',
        icon: <UserCheck className="w-5 h-5 shrink-0" />,
        href: '/admin?tab=patients',
      },
      {
        title: 'Treatment Monitoring',
        hindi: 'उपचार निगरानी',
        icon: <Stethoscope className="w-5 h-5 shrink-0" />,
        href: '/admin?tab=treatments',
      },
      {
        title: 'Reports & Analytics',
        hindi: 'रिपोर्ट और एनालिटिक्स',
        icon: <BarChart3 className="w-5 h-5 shrink-0" />,
        href: '/admin?tab=analytics',
      },
      {
        title: 'Security & Audit Logs',
        hindi: 'सुरक्षा एवं ऑडिट लॉग',
        icon: <ShieldCheck className="w-5 h-5 shrink-0" />,
        href: '/admin?tab=audit',
      },
      {
        title: 'System Settings',
        hindi: 'सिस्टम सेटिंग्स',
        icon: <Settings className="w-5 h-5 shrink-0" />,
        href: '/settings',
      },
    ];

    const adminContent = (
      <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200/80 select-none shadow-[2px_0_12px_-4px_rgba(0,0,0,0.03)]">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1877F2] to-[#2B9BFF] flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                  CirrhoCare <span className="text-[#1877F2]">AI</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Smarter Liver Health</p>
              </div>
            )}
          </div>
          {/* Desktop Expand Button if collapsed */}
          {isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
          {adminNavList.map((item, idx) => {
            const isOverviewActive = item.href === '/admin' && (location.pathname === '/admin' && (!location.search || location.search === '' || location.search === '?tab=overview'));
            const isUsersActive = item.href === '/admin?tab=users' && location.search.includes('tab=users');
            const isPatientsActive = item.href === '/admin?tab=patients' && (location.search.includes('tab=patients') || location.pathname.startsWith('/patients'));
            const isTreatmentsActive = item.href === '/admin?tab=treatments' && location.search.includes('tab=treatments');
            const isAnalyticsActive = item.href === '/admin?tab=analytics' && (location.search.includes('tab=analytics') || location.pathname.startsWith('/analytics'));
            const isAuditActive = item.href === '/admin?tab=audit' && (location.search.includes('tab=audit') || location.pathname.startsWith('/logs'));
            const isSettingsActive = item.href === '/settings' && (location.pathname.startsWith('/settings') || (location.pathname === '/admin' && location.search.includes('tab=settings')));

            const isCurrentActive = isOverviewActive || isUsersActive || isPatientsActive || isTreatmentsActive || isAnalyticsActive || isAuditActive || isSettingsActive;

            return (
              <NavLink
                key={`${item.title}-${idx}`}
                to={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all duration-150 group relative font-semibold',
                  isCurrentActive
                    ? 'bg-[#1877F2] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50/50'
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <span className={isCurrentActive ? 'text-white' : 'text-slate-400 group-hover:text-[#1877F2]'}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="truncate leading-tight">
                      {isHindi ? item.hindi : item.title}
                    </span>
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* Logout item in red */}
          <button
            type="button"
            onClick={() => {
              onMobileClose();
              logout();
            }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all duration-150 group font-semibold text-[#e53e3e] hover:bg-rose-50 w-full text-left cursor-pointer"
            title={isCollapsed ? (isHindi ? 'लॉग आउट' : 'Logout') : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0 text-[#e53e3e]" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="truncate leading-tight">{isHindi ? 'लॉग आउट' : 'Logout'}</span>
              </div>
            )}
          </button>
        </div>

        {/* Promo Card & Admin Profile Footer */}
        <div className="p-3 border-t border-slate-100 space-y-3">
          {/* Promo Card matching reference screenshot */}
          {!isCollapsed && (
            <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-blue-50/60 border border-emerald-100/70 rounded-2xl p-3 text-center relative overflow-hidden shadow-xs">
              <div className="w-16 h-16 mx-auto mb-1 flex items-center justify-center">
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver Health"
                  className="w-14 h-14 object-contain rounded-full shadow-xs bg-white/80 p-0.5"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-snug px-1 whitespace-pre-line">
                {isHindi ? 'बेहतर डेटा।\nबेहतर निर्णय।\nस्वस्थ जीवन।' : 'Better data.\nBetter decisions.\nHealthier lives.'}
              </p>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/admin');
                  }}
                  className="w-6 h-6 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-600 transition shadow-xs cursor-pointer"
                  title="CirrhoCare AI"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Admin Profile Footer matching reference screenshot */}
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-xl transition',
            isCollapsed ? 'justify-center' : 'bg-slate-50/80 border border-slate-100'
          )}>
            <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              SA
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user?.name && !user.name.toLowerCase().includes('demo') && !user.name.toLowerCase().includes('admin user') ? user.name : 'System Admin'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="truncate">{isHindi ? 'प्रशासक' : 'Administrator'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-blue-600">ADM-001</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* Desktop Persistent Sidebar */}
        <aside
          className={cn(
            'hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-30 transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {adminContent}
        </aside>

        {/* Mobile Slide-out Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={onMobileClose}
            />
            <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {adminContent}
            </div>
          </div>
        )}

        {/* Desktop Spacer */}
        <div
          className={cn(
            'hidden md:block shrink-0 transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        />
      </>
    );
  }

  // Hepatologist-specific navigation matching reference screenshot exactly
  if (role === 'hepatologist') {
    const hepatologistNavList = [
      {
        title: isHindi ? 'डैशबोर्ड' : 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        href: '/doctor',
        action: 'dashboard',
      },
      {
        title: isHindi ? 'मरीज़' : 'Patients',
        icon: <Users className="w-5 h-5 shrink-0" />,
        href: '/doctor?tab=patients',
        action: 'patients',
      },
      {
        title: isHindi ? 'अपॉइंटमेंट अनुरोध' : 'Appointment Requests',
        icon: <CalendarClock className="w-5 h-5 shrink-0" />,
        href: '/doctor/appointments',
        action: 'appointments',
        badge: pendingDoctorRequestsCount,
      },
      {
        title: isHindi ? 'दवाइयां' : 'Prescriptions',
        icon: <ClipboardList className="w-5 h-5 shrink-0" />,
        href: '/doctor?tab=prescriptions',
        action: 'prescriptions',
      },
      {
        title: isHindi ? 'रिपोर्ट्स' : 'Reports',
        icon: <FileText className="w-5 h-5 shrink-0" />,
        href: '/doctor?tab=reports',
        action: 'reports',
      },
      {
        title: isHindi ? 'मेरी प्रोफ़ाइल' : 'My Profile',
        icon: <User className="w-5 h-5 shrink-0" />,
        href: '/settings',
        action: 'profile',
      },
    ];

    const hepatologistContent = (
      <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-100 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] justify-between">
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-xs shrink-0">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                    CirrhoCare AI
                  </h1>
                  <p className="text-xs text-slate-400 font-medium">{isHindi ? 'लिवर केयर प्रबंधन' : 'Liver Care Management'}</p>
                </div>
              )}
            </div>
            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="py-4 px-3 space-y-1.5 custom-scrollbar">
            {hepatologistNavList.map((item, idx) => {
              const isDashboard = item.action === 'dashboard';
              const isPatients = item.action === 'patients';
              const isAppointments = item.action === 'appointments';
              const isPrescriptions = item.action === 'prescriptions';
              const isReports = item.action === 'reports';
              const isProfile = item.action === 'profile';

              const isCurrentActive = isDashboard
                ? (location.pathname === '/doctor' || location.pathname === '/') && (!location.search || location.search === '' || location.search === '?tab=overview')
                : isPatients
                ? (location.pathname === '/doctor' && location.search.includes('tab=patients')) || location.pathname.startsWith('/patients')
                : isAppointments
                ? location.pathname.startsWith('/doctor/appointments') || location.pathname === '/appointments'
                : isPrescriptions
                ? (location.pathname === '/doctor' && location.search.includes('tab=prescriptions')) || location.pathname.startsWith('/prescriptions')
                : isReports
                ? (location.pathname === '/doctor' && location.search.includes('tab=reports')) || location.pathname.startsWith('/reports')
                : isProfile
                ? location.pathname.startsWith('/settings')
                : false;

              return (
                <NavLink
                  key={`${item.title}-${idx}`}
                  to={item.href}
                  onClick={() => {
                    onMobileClose();
                    if (item.action && location.pathname === '/doctor') {
                      window.dispatchEvent(new CustomEvent('doctor:action', { detail: item.action }));
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group font-medium relative',
                    isCurrentActive
                      ? 'bg-[#1877F2] text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50/50'
                  )}
                  title={isCollapsed ? (item.badge ? `${item.title} (${item.badge} pending)` : item.title) : undefined}
                >
                  <span className={isCurrentActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="truncate leading-tight">
                      {item.title}
                    </span>
                  )}
                  {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={cn(
                        'ml-auto px-2 py-0.5 rounded-full text-xs font-bold shrink-0 transition-colors',
                        isCurrentActive ? 'bg-white text-[#1877F2]' : 'bg-blue-100 text-[#1877F2]'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#1877F2]" />
                  )}
                </NavLink>
              );
            })}

            {/* Logout Navigation Item */}
            <button
              type="button"
              onClick={() => {
                onMobileClose();
                logout();
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 w-full text-left cursor-pointer"
              title={isCollapsed ? (isHindi ? 'लॉग आउट' : 'Logout') : undefined}
            >
              <LogOut className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-rose-600" />
              {!isCollapsed && (
                <span className="truncate leading-tight">{isHindi ? 'लॉग आउट' : 'Logout'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Section: Promo Card & Profile pill */}
        <div className="p-3 border-t border-slate-100 space-y-3">
          {/* Promo Card matching reference specification */}
          {!isCollapsed && (
            <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-blue-50/60 border border-emerald-100/70 rounded-2xl p-3 text-center relative overflow-hidden shadow-xs">
              <div className="w-16 h-16 mx-auto mb-1.5 flex items-center justify-center">
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver Health"
                  className="w-14 h-14 object-contain rounded-full shadow-xs bg-white/80 p-0.5"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-snug px-1">
                {isHindi ? 'शीघ्र पहचान। बेहतर उपचार। स्वस्थ कल।' : 'Early detection. Better treatment. Healthier tomorrows.'}
              </p>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('doctor:action', { detail: 'overview' }));
                  }}
                  className="w-6 h-6 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-600 transition shadow-xs cursor-pointer"
                  title="Liver Care Management"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Doctor User Card */}
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-xl transition',
            isCollapsed ? 'justify-center' : 'bg-slate-50/80 border border-slate-100'
          )}>
            <div className="w-9 h-9 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              DR
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user?.name && !user.name.toLowerCase().includes('demo') ? user.name : 'Dr. Raj Sharma'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="truncate">{isHindi ? 'हेपेटोलॉजिस्ट' : 'Hepatologist'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-blue-600">HEP-001</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* Desktop Persistent Sidebar */}
        <aside
          className={cn(
            'hidden md:block transition-all duration-300 shrink-0 sticky top-0 h-screen z-30',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {hepatologistContent}
        </aside>

        {/* Mobile Drawer Backdrop */}
        {isMobileOpen && (
          <div
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden animate-in fade-in"
          />
        )}

        {/* Mobile Slide-out Drawer */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 md:hidden transition-transform duration-300 ease-in-out',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {hepatologistContent}
        </div>
      </>
    );
  }

  // Patient-specific navigation matching the reference image exactly
  if (role === 'patient') {
    const patientNavList = [
      {
        title: 'Dashboard',
        hindi: 'डैशबोर्ड',
        icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        href: '/patient',
      },
      {
        title: 'My Reports',
        hindi: 'मेरी रिपोर्ट्स',
        icon: <FileText className="w-5 h-5 shrink-0" />,
        href: '/reports',
      },
      {
        title: 'My Prescriptions',
        hindi: 'मेरी दवाइयाँ',
        icon: <Pill className="w-5 h-5 shrink-0" />,
        href: '/prescriptions',
      },
      {
        title: 'My Appointments',
        hindi: 'मेरी अपॉइंटमेंट्स',
        icon: <Calendar className="w-5 h-5 shrink-0" />,
        href: '/appointments',
      },
      {
        title: 'Health Guidance',
        hindi: 'स्वास्थ्य मार्गदर्शन',
        icon: <Sparkles className="w-5 h-5 shrink-0" />,
        href: '/patient?tab=guidance',
      },
      {
        title: 'My Profile',
        hindi: 'मेरी प्रोफ़ाइल',
        icon: <User className="w-5 h-5 shrink-0" />,
        href: '/settings',
      },
    ];

    const patientContent = (
      <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200/80 select-none shadow-[2px_0_12px_-4px_rgba(0,0,0,0.03)]">
        {/* Brand Header */}
        <div className="flex items-center px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                CirrhoCare <span className="text-[#1877F2]">AI</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Smarter Liver Health</p>
            </div>
          </div>
        </div>

        {/* Navigation Links (Dashboard, My Reports, My Prescriptions, My Appointments, Health Guidance, My Profile, Logout) */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
          {patientNavList.map((item) => {
            const active =
              item.href === '/patient'
                ? location.pathname === '/patient' && !location.search.includes('tab=guidance')
                : item.href.includes('tab=guidance')
                ? location.search.includes('tab=guidance')
                : location.pathname === item.href;

            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all duration-150 group relative font-semibold',
                  active
                    ? 'bg-[#1877F2] text-white font-bold shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}>
                  {item.icon}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate leading-tight">
                    {isHindi ? item.hindi : item.title}
                  </span>
                </div>
              </NavLink>
            );
          })}

          {/* 7. Logout item in red */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onMobileClose();
                logout();
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all duration-150 group font-semibold text-[#e53e3e] hover:bg-rose-50 w-full text-left cursor-pointer"
              title={isHindi ? 'लॉग आउट' : 'Logout'}
            >
              <LogOut className="w-5 h-5 shrink-0 text-[#e53e3e]" />
              <div className="flex flex-col min-w-0">
                <span className="truncate leading-tight">{isHindi ? 'लॉग आउट' : 'Logout'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Meditation Wellness Card matching reference screenshot */}
        <div className="p-3 mt-auto">
          <div className="bg-[#EBF7F2] border border-[#CDEFE0] rounded-2xl p-3.5 flex flex-col items-center text-center shadow-xs">
            <div className="w-24 h-20 mb-2 flex items-center justify-center">
              <img
                src="/assets/patient_meditation_wellness.png"
                alt="Wellness Meditation"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between w-full mt-1">
              <p className="text-xs font-bold text-slate-800 leading-snug text-left flex-1">
                {isHindi ? 'स्वस्थ कल के लिए आज छोटे कदम।' : 'Small steps today for a healthier tomorrow.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  onMobileClose();
                  navigate('/patient?tab=guidance');
                }}
                className="w-7 h-7 rounded-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0284C7] flex items-center justify-center shrink-0 ml-2 transition cursor-pointer"
                title={isHindi ? 'स्वास्थ्य मार्गदर्शन' : 'Health Guidance'}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* Desktop Persistent Sidebar */}
        <aside
          className={cn(
            'hidden md:block transition-all duration-300 shrink-0 sticky top-0 h-screen z-30',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {patientContent}
        </aside>

        {/* Mobile Drawer Backdrop */}
        {isMobileOpen && (
          <div
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden animate-in fade-in"
          />
        )}

        {/* Mobile Slide-out Drawer */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 md:hidden transition-transform duration-300 ease-in-out',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {patientContent}
        </div>
      </>
    );
  }

  // Lab Technician-specific navigation matching reference screenshot exactly
  if (role === 'labtech') {
    const labTechNavList = [
      {
        title: isHindi ? 'डैशबोर्ड' : 'Dashboard',
        icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        href: '/lab',
        action: 'dashboard',
      },
      {
        title: isHindi ? 'मरीज़' : 'Patients',
        icon: <Users className="w-5 h-5 shrink-0" />,
        href: '/lab?tab=patients',
        action: 'patients',
      },
      {
        title: isHindi ? 'टेस्ट परिणाम दर्ज करें' : 'Enter Test Results',
        icon: <FlaskConical className="w-5 h-5 shrink-0" />,
        href: '/lab?action=enter-results',
        action: 'enter-results',
      },
      {
        title: isHindi ? 'रिपोर्ट्स अपलोड करें' : 'Upload Reports',
        icon: <UploadCloud className="w-5 h-5 shrink-0" />,
        href: '/lab?action=upload-report',
        action: 'upload-report',
      },
      {
        title: isHindi ? 'रिपोर्ट्स' : 'Reports',
        icon: <FileText className="w-5 h-5 shrink-0" />,
        href: '/lab?tab=reports',
        action: 'reports',
      },
      {
        title: isHindi ? 'मेरी प्रोफ़ाइल' : 'My Profile',
        icon: <User className="w-5 h-5 shrink-0" />,
        href: '/settings',
        action: 'profile',
      },
    ];

    const labTechContent = (
      <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-100 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] justify-between">
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-xs shrink-0">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                    CirrhoCare AI
                  </h1>
                  <p className="text-xs text-slate-400 font-medium">{isHindi ? 'लिवर केयर प्रबंधन' : 'Liver Care Management'}</p>
                </div>
              )}
            </div>
            {/* Desktop Collapse Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="py-4 px-3 space-y-1.5 custom-scrollbar">
            {labTechNavList.map((item, idx) => {
              const isDashboard = item.action === 'dashboard';
              const isProfile = item.action === 'profile';
              const isCurrentActive = isDashboard
                ? location.pathname === '/lab' && !location.search
                : isProfile
                ? location.pathname.startsWith('/settings')
                : location.pathname === '/lab' && location.search.includes(item.action);

              return (
                <NavLink
                  key={`${item.title}-${idx}`}
                  to={item.href}
                  onClick={() => {
                    onMobileClose();
                    if (item.action && item.action !== 'dashboard' && item.action !== 'profile') {
                      window.dispatchEvent(new CustomEvent('labtech:action', { detail: item.action }));
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group font-medium',
                    isCurrentActive
                      ? 'bg-[#1877F2] text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <span className={isCurrentActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="truncate leading-tight">
                      {item.title}
                    </span>
                  )}
                </NavLink>
              );
            })}

            {/* Logout Navigation Item */}
            <button
              type="button"
              onClick={() => {
                onMobileClose();
                logout();
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 w-full text-left cursor-pointer"
              title={isCollapsed ? (isHindi ? 'लॉग आउट' : 'Logout') : undefined}
            >
              <LogOut className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-rose-600" />
              {!isCollapsed && (
                <span className="truncate leading-tight">{isHindi ? 'लॉग आउट' : 'Logout'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Section: Promo Card & Profile pill */}
        <div className="p-3 border-t border-slate-100 space-y-3">
          {/* Promo Card matching reference screenshot */}
          {!isCollapsed && (
            <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-blue-50/60 border border-emerald-100/70 rounded-2xl p-3 text-center relative overflow-hidden shadow-xs">
              <div className="w-16 h-16 mx-auto mb-1.5 flex items-center justify-center">
                <img
                  src="/assets/healthy_liver_organ.jpg"
                  alt="Liver Health"
                  className="w-14 h-14 object-contain rounded-full shadow-xs bg-white/80 p-0.5"
                  onError={(e) => {
                    // Fallback to sparkles / organ icon if image not available
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-snug px-1">
                Accurate tests today for healthier tomorrows.
              </p>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('labtech:action', { detail: 'enter-results' }));
                  }}
                  className="w-6 h-6 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:bg-blue-600 transition shadow-xs cursor-pointer"
                  title="Enter lab results"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Lab Technician User Card */}
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-xl transition',
            isCollapsed ? 'justify-center' : 'bg-slate-50/80 border border-slate-100'
          )}>
            <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              NV
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user?.name || 'Neha Verma'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="truncate">Lab Technician</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-indigo-600">LAB-001</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* Desktop Persistent Sidebar */}
        <aside
          className={cn(
            'hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-30 transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {labTechContent}
        </aside>

        {/* Mobile Slide-out Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={onMobileClose}
            />
            <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {labTechContent}
            </div>
          </div>
        )}

        {/* Desktop Spacer */}
        <div
          className={cn(
            'hidden md:block shrink-0 transition-all duration-300 ease-in-out',
            isCollapsed ? 'w-20' : 'w-64'
          )}
        />
      </>
    );
  }

  const visibleItems = (navItems as any[]).filter((item) => item.allowedRoles.includes(role as string));

  const content = (
    <div className="flex flex-col h-full bg-[#0d172e] text-slate-300 border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-6 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-white tracking-tight">
                CirrhoCare AI
              </h1>
              <p className="text-xs text-slate-400 font-normal">Smarter Liver Health</p>
            </div>
          )}
        </div>
        {/* Desktop Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
        {visibleItems.map((item) => {
          const active = isItemActive(item.href);
          return (
            <NavLink
              key={`${item.title}-${item.href}`}
              to={item.href}
              onClick={onMobileClose}
              className={
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 group relative',
                  active
                    ? 'bg-blue-600 text-white font-medium shadow-sm shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                )
              }
              title={isCollapsed ? item.title : undefined}
            >
              {item.icon}
              {!isCollapsed && (
                <>
                  <span className="truncate">{item.title}</span>
                  {'hasChevron' in item && item.hasChevron && (
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-400 group-hover:text-white transition" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* AI Model Status Card */}
      {!isCollapsed && (
        <div className="px-3 pb-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-white font-medium mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse" />
                <span className="font-semibold text-xs text-white">AI Model Status</span>
              </div>
              <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-white" />
            </div>
            <p className="text-emerald-400 font-semibold pl-4.5 text-xs">• Active</p>
            <p className="text-slate-400 text-[11px] pl-4.5 mt-0.5">Random Forest v1.7</p>
          </div>
        </div>
      )}

      {/* User Info & Role Footer (Only for non-admin roles without top-navbar profile) */}
      {(role as string) !== 'admin' && (
        <div className="p-3 border-t border-slate-800/80">
          <div
            className={cn(
              'flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80',
              isCollapsed && 'justify-center p-2'
            )}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow">
                {user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'SA'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 capitalize">{role}</span>
                </div>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:block transition-all duration-300 shrink-0 sticky top-0 h-screen z-30',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden animate-in fade-in"
        />
      )}

      {/* Mobile Slide-out Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 md:hidden transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {content}
      </div>
    </>
  );
};
