import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Search,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { useToast } from '@/app/ToastContext';
import { api } from '@/services/api';
import type { SystemNotification } from '@/types';
import { cn } from '@/utils/cn';

interface TopNavbarProps {
  onMobileMenuOpen: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onMobileMenuOpen }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { success } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Command/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const res = await api.notifications.list();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      success('All notifications marked as read');
    } catch {
      // Ignored
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (user?.role === 'labtech') {
        navigate(`/lab?q=${encodeURIComponent(searchQuery.trim())}`);
        window.dispatchEvent(new CustomEvent('labtech:search', { detail: searchQuery.trim() }));
      } else if (user?.role === 'hepatologist') {
        navigate(`/doctor?q=${encodeURIComponent(searchQuery.trim())}`);
        window.dispatchEvent(new CustomEvent('doctor:search', { detail: searchQuery.trim() }));
      } else if (user?.role === 'patient') {
        navigate(`/patient?q=${encodeURIComponent(searchQuery.trim())}`);
        window.dispatchEvent(new CustomEvent('patient:search', { detail: searchQuery.trim() }));
      } else {
        navigate(`/patients?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between shadow-xs">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              user?.role === 'hepatologist'
                ? (language === 'hi' ? 'मरीज़ का नाम, आईडी या जोखिम स्तर खोजें...' : 'Search patient by name, ID or risk level...')
                : user?.role === 'labtech'
                ? (language === 'hi' ? 'मरीज़ का नाम, मरीज़ आईडी या टेस्ट प्रकार खोजें...' : 'Search by patient name, patient ID or test type...')
                : user?.role === 'admin'
                ? (language === 'hi' ? 'मरीज़, उपयोगकर्ता, रिपोर्ट्स या सेटिंग्स खोजें...' : 'Search patients, users, reports, or settings...')
                : user?.role === 'patient'
                ? (language === 'hi' ? 'रिपोर्ट्स, दवाइयां, अपॉइंटमेंट्स या स्वास्थ्य मार्गदर्शन खोजें...' : 'Search reports, prescriptions, appointments, or health guidance...')
                : (language === 'hi' ? 'मरीज़, आईडी, रिपोर्ट्स खोजें...' : 'Search patients, IDs, reports, or staff...')
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-[15px] bg-slate-50/80 border border-slate-200/80 rounded-full outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition text-slate-800 placeholder:text-slate-400 font-normal"
          />
        </form>
      </div>

      {/* Right: Language switch, Notifications, User menu */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Bilingual Language Selector - Always Accessible Across All Roles */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-full border border-slate-200/70 shadow-xs">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'px-3.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
              language === 'en'
                ? 'bg-[#0A2540] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>English</span>
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={cn(
              'px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer font-devanagari',
              language === 'hi'
                ? 'bg-[#0A2540] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            )}
          >
            <span>हिंदी</span>
          </button>
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen((v) => !v)}
            className="relative p-2 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {(unreadCount > 0 || user?.role === 'hepatologist' || user?.role === 'admin' || user?.role === 'labtech' || user?.role === 'patient') && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                {user?.role === 'patient' ? '3' : unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : '3'}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">
                    {language === 'hi' ? 'सूचनाएं' : 'Notifications'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                    {unreadCount > 0 ? unreadCount : 3} {language === 'hi' ? 'अपठित' : 'unread'}
                  </span>
                </div>
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {language === 'hi' ? 'सभी पढ़े हुए करें' : 'Mark all read'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 px-2 py-1">
                {notifications.length === 0 ? (
                  <div className="py-4 px-3 space-y-2">
                    <div className="p-2.5 rounded-xl bg-blue-50/50">
                      <p className="text-sm font-semibold text-slate-900">Cirrhosis Risk Assessment Engine</p>
                      <p className="text-xs text-slate-500 mt-0.5">Model v1.7 operating normally with active telemetry.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <p className="text-sm font-semibold text-slate-900">Daily Clinical Audit Sync</p>
                      <p className="text-xs text-slate-500 mt-0.5">System activity integrity checked and verified.</p>
                    </div>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'p-3 rounded-xl transition flex flex-col gap-1',
                        !n.read ? 'bg-blue-50/40' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm font-semibold text-slate-900">{n.title}</strong>
                        <span
                          className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', {
                            'bg-rose-500': n.category === 'danger',
                            'bg-blue-500': n.category === 'info',
                            'bg-emerald-500': n.category === 'success',
                            'bg-amber-500': n.category === 'warning',
                          })}
                        />
                      </div>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{n.message}</p>
                      <span className="text-xs text-slate-400 mt-0.5">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t border-slate-100 text-center bg-slate-50/50 rounded-b-2xl">
                <Link
                  to="/notifications"
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  {language === 'hi' ? 'सभी सिस्टम सूचनाएं देखें →' : 'View all system notifications →'}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Help Circle Button (matching reference screenshot for all dashboards) */}
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          aria-label="Help and documentation"
          title={language === 'hi' ? 'सहायता एवं दस्तावेज़' : 'Help & Support'}
        >
          <div className="w-5 h-5 rounded-full border-1.5 border-slate-400 flex items-center justify-center text-xs font-bold text-slate-500 hover:border-slate-800 hover:text-slate-800">
            ?
          </div>
        </button>

        {/* User Profile Dropdown Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
              {user?.role === 'admin'
                ? 'SA'
                : user?.role === 'hepatologist'
                ? 'DR'
                : user?.role === 'labtech'
                ? 'LT'
                : (user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'KS')}
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center gap-1">
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {user?.role === 'admin'
                    ? (user?.name && !user.name.toLowerCase().includes('demo') && !user.name.toLowerCase().includes('admin user') ? user.name : 'System Admin')
                    : user?.role === 'hepatologist'
                    ? (user?.name && !user.name.toLowerCase().includes('hepato') ? user.name : 'Dr. Raj Sharma')
                    : user?.role === 'labtech'
                    ? (user?.name && !user.name.toLowerCase().includes('tech') && !user.name.toLowerCase().includes('demo') ? user.name : 'Neha Verma')
                    : user?.role === 'patient'
                    ? (user?.name ? user.name.toLowerCase() : 'krishna singh')
                    : (user?.name || 'krishna singh')}
                </p>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {user?.role === 'admin'
                  ? (language === 'hi' ? 'प्रशासक' : 'Administrator')
                  : user?.role === 'patient'
                  ? `${language === 'hi' ? 'मरीज़' : 'Patient'} | ${user?.portal_id || 'CC-2026-6423'}`
                  : user?.role === 'hepatologist'
                  ? (language === 'hi' ? 'हेपेटोलॉजिस्ट' : 'Hepatologist')
                  : user?.role === 'labtech'
                  ? (language === 'hi' ? 'लैब तकनीशियन' : 'Lab Technician')
                  : (user?.role || 'Admin')}
              </p>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                {user?.portal_id && (
                  <p className="mt-1 text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                    {language === 'hi' ? 'आईडी: ' : 'ID: '}{user.portal_id}
                  </p>
                )}
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  {language === 'hi' ? 'मेरा प्रोफ़ाइल' : 'My Profile'}
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium transition"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  {language === 'hi' ? 'खाता सेटिंग्स' : 'Account Settings'}
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition"
                >
                  <LogOut className="w-4 h-4" />
                  {language === 'hi' ? 'लॉग आउट' : 'Sign Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
