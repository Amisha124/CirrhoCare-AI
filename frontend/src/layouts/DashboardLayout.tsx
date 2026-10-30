import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { cn } from '@/utils/cn';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { HepatologistTopNavbar } from './HepatologistTopNavbar';

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const { isHindi } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Generate breadcrumbs from current route path
  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbLabel = (name: string): string => {
    if (!isHindi) return name.replace('-', ' ');
    const map: Record<string, string> = {
      doctor: 'हेपेटोलॉजिस्ट डैशबोर्ड',
      patients: 'मरीज़',
      reviews: 'क्लिनिकल समीक्षा',
      reports: 'लैब रिपोर्ट्स',
      analytics: 'रिपोर्ट एनालिटिक्स',
      predictions: 'एआई पूर्वानुमान',
      appointments: 'अपॉइंटमेंट्स',
      prescriptions: 'दवाइयाँ',
      notifications: 'सूचनाएं',
      settings: 'मेरा प्रोफ़ाइल',
      'liver-monitoring': 'एआई लिवर निगरानी',
      admin: 'प्रशासन',
      lab: 'लैब',
    };
    return map[name.toLowerCase()] || name.replace('-', ' ');
  };

  // Patient, Hepatologist, Admin & Lab Tech layouts use dedicated role-specific visual themes
  const getWorkspaceBackground = () => {
    if (user?.role === 'labtech') {
      return 'bg-gradient-to-br from-[#f0f9fa] via-[#f7fcfd] to-[#eaf5f7]';
    }
    if (user?.role === 'patient' || user?.role === 'hepatologist' || user?.role === 'admin') {
      return 'bg-gradient-to-br from-[#ebf5ff] via-[#f0f7fe] to-[#e4f1fc]';
    }
    return 'bg-[#F8FAFC]';
  };

  return (
    <div className={cn('min-h-screen w-full flex text-slate-900', getWorkspaceBackground())}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((v) => !v)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <TopNavbar onMobileMenuOpen={() => setIsMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {/* Breadcrumbs (only on subpages, not main admin, doctor, patient, or lab dashboards) */}
          {pathnames.length > 0 && location.pathname !== '/admin' && location.pathname !== '/doctor' && location.pathname !== '/patient' && location.pathname !== '/lab' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-6 font-medium">
              <Link to="/" className="hover:text-blue-600 transition">
                <span>{isHindi ? 'सिरोकेयर एआई' : 'CirrhoCare AI'}</span>
                <span className="sr-only">CirrhoCare AI</span>
              </Link>
              {pathnames.map((name, index) => {
                const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
                const isLast = index === pathnames.length - 1;
                const label = getBreadcrumbLabel(name);
                return (
                  <React.Fragment key={name}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    {isLast ? (
                      <span className="font-semibold text-slate-700 capitalize font-devanagari">
                        {label}
                        <span className="sr-only">{name.replace('-', ' ')}</span>
                      </span>
                    ) : (
                      <Link to={routeTo} className="hover:text-blue-600 capitalize transition font-devanagari">
                        {label}
                        <span className="sr-only">{name.replace('-', ' ')}</span>
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
};
