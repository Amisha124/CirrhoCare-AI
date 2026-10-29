import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Calendar,
  CheckCheck,
  ChevronDown,
  FileText,
  HeartPulse,
  LogOut,
  Menu,
  Pill,
  Search,
  Settings,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { api } from '@/services/api';
import type { SystemNotification } from '@/types';
import { cn } from '@/utils/cn';

export const HepatologistTopNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { success } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotifOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  // Command/Ctrl+K shortcut for search
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
    const interval = setInterval(loadNotifications, 30000);
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
      navigate(`/patients?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { title: 'Dashboard', href: '/doctor', icon: <Activity className="w-4 h-4" /> },
    { title: 'Patients', href: '/patients', icon: <Users className="w-4 h-4" /> },
    { title: 'AI Monitoring', href: '/liver-monitoring', icon: <HeartPulse className="w-4 h-4" /> },
    { title: 'Clinical Reviews', href: '/doctor/reviews', icon: <Stethoscope className="w-4 h-4" /> },
    { title: 'Lab Reports', href: '/reports', icon: <FileText className="w-4 h-4" /> },
    { title: 'Prescriptions', href: '/prescriptions', icon: <Pill className="w-4 h-4" /> },
    { title: 'Appointments', href: '/appointments', icon: <Calendar className="w-4 h-4" /> },
  ];

  const isActiveLink = (href: string) => {
    if (href === '/doctor') {
      return location.pathname === '/doctor';
    }
    return location.pathname.startsWith(href);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'HP';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left: Branding & Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/doctor" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:bg-blue-700 transition">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-blue-600 transition">
                    CirrhoCare <span className="text-blue-600">AI</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 uppercase tracking-wider hidden sm:inline-block">
                    Hepatology
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center: Horizontal Navigation Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isActiveLink(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition',
                    active
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                  )}
                >
                  <span className={active ? 'text-blue-600' : 'text-slate-400'}>{link.icon}</span>
                  <span>{link.title}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Search, Notifications, Profile, Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Input (Desktop) */}
            <form onSubmit={handleSearchSubmit} className="relative hidden lg:block w-48 xl:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-slate-800 placeholder:text-slate-400 transition"
              />
            </form>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((v) => !v)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition relative cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                        {unreadCount} unread
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 px-2 py-1">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No new notifications at this time.
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
                            <strong className="text-xs font-semibold text-slate-900">{n.title}</strong>
                            <span
                              className={cn('w-2 h-2 rounded-full shrink-0 mt-1', {
                                'bg-rose-500': n.category === 'danger',
                                'bg-blue-500': n.category === 'info',
                                'bg-emerald-500': n.category === 'success',
                                'bg-amber-500': n.category === 'warning',
                              })}
                            />
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hepatologist Profile Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                aria-label="Clinician Profile Menu"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                  {getInitials(user?.name)}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {user?.name ? (user.name.toLowerCase().startsWith('dr') ? user.name : `Dr. ${user.name}`) : 'Dr. Hepatologist'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">Attending Hepatologist</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.name || 'Hepatologist'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      Hepatologist Workspace
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/settings"
                      className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Settings & Preferences
                    </Link>
                    <Link
                      to="/notifications"
                      className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                    >
                      <Bell className="w-3.5 h-3.5 text-slate-400" />
                      Notification Center
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile / Tablet Menu Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="xl:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile / Tablet Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-100 py-3 space-y-2 animate-in fade-in slide-in-from-top-1">
            {/* Search in Mobile Drawer */}
            <form onSubmit={handleSearchSubmit} className="relative pb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-slate-800"
              />
            </form>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {navLinks.map((link) => {
                const active = isActiveLink(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition',
                      active
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                    )}
                  >
                    <span className={active ? 'text-blue-600' : 'text-slate-400'}>{link.icon}</span>
                    <span>{link.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
