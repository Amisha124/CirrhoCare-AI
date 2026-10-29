import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '@/app/ToastContext';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';
import type { SystemNotification } from '@/types';
import { cn } from '@/utils/cn';

export const NotificationsPage: React.FC = () => {
  const { success, error } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);

  // Notification items & metadata
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(20);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load notifications from API
  const fetchNotifications = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setIsLoading(true);
      setFetchError(null);
      try {
        const res = await api.notifications.list({
          status: statusFilter,
          category: categoryFilter,
          q: appliedSearch || undefined,
          page: currentPage,
          per_page: perPage,
        });

        if (res.success) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unread_count || 0);
          setTotalCount(res.total || 0);
          setTotalPages(res.total_pages || 1);
        } else {
          setFetchError('Failed to retrieve notifications from server.');
        }
      } catch (err: any) {
        const msg = err.message || 'Failed to connect to notification service';
        setFetchError(msg);
        error(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, categoryFilter, appliedSearch, currentPage, perPage, error]
  );

  // Fetch when filters or page change
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingAll(true);
    try {
      const res = await api.notifications.markAllRead();
      if (res.success) {
        success('All accessible notifications marked as read.');
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err: any) {
      error(err.message || 'Failed to update notifications');
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Handle Toggle Single Read/Unread
  const handleToggleReadStatus = async (item: SystemNotification) => {
    setActionInProgressId(item.id);
    const targetAction = item.read ? 'unread' : 'read';
    try {
      if (item.read) {
        const res = await api.notifications.markOneUnread(item.id);
        if (res.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, read: false } : n))
          );
          setUnreadCount((c) => c + 1);
          success('Marked as unread');
        }
      } else {
        const res = await api.notifications.markOneRead(item.id);
        if (res.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
          success('Marked as read');
        }
      }
    } catch (err: any) {
      error(err.message || `Failed to mark notification as ${targetAction}`);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Dismiss / Delete
  const handleDismiss = async (id: number) => {
    setActionInProgressId(id);
    try {
      const res = await api.notifications.dismiss(id);
      if (res.success) {
        const removed = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotalCount((t) => Math.max(0, t - 1));
        if (removed && !removed.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        success('Notification dismissed.');
      }
    } catch (err: any) {
      error(err.message || 'Failed to dismiss notification');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearch(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  // Helpers for category appearance
  const getCategoryTheme = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          dot: 'bg-rose-500',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          cardBorder: 'border-l-rose-500',
          label: 'Critical Alert',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          dot: 'bg-amber-500',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          cardBorder: 'border-l-amber-500',
          label: 'Clinical Warning',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          dot: 'bg-emerald-500',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          cardBorder: 'border-l-emerald-500',
          label: 'System Update',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-teal-600" />,
          dot: 'bg-teal-500',
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
          cardBorder: 'border-l-teal-500',
          label: 'Information',
        };
    }
  };

  // Recipient scope tag
  const getScopeBadge = (notif: SystemNotification) => {
    if (notif.user_id) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Personal
        </span>
      );
    }
    if (notif.role) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 capitalize">
          {notif.role} Scope
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        Broadcast
      </span>
    );
  };

  // Formatting date
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Count active filters
  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || appliedSearch !== '';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 shadow-sm">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200 shadow-sm">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Real-time clinical alerts, diagnostic report updates, and patient triage notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              isLoading={isMarkingAll}
              className="text-xs font-semibold text-teal-700 border-teal-300 hover:bg-teal-50 shadow-sm"
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark all read
            </Button>
          )}

          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchNotifications(false);
            }}
            disabled={isRefreshing || isLoading}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition shadow-sm bg-white"
            title="Refresh notifications"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-teal-600')} />
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCount}</div>
            <div className="text-xs font-semibold text-slate-500">Total Alerts</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-teal-200 shadow-sm flex items-center gap-3.5 bg-teal-50/20">
          <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-teal-700">{unreadCount}</div>
            <div className="text-xs font-semibold text-teal-600">Pending Unread</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-sm flex items-center gap-3.5 bg-rose-50/20">
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-700">
              {notifications.filter((n) => n.category === 'danger').length}
            </div>
            <div className="text-xs font-semibold text-rose-600">Critical Risks</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm flex items-center gap-3.5 bg-emerald-50/20">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <MailOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">
              {Math.max(0, totalCount - unreadCount)}
            </div>
            <div className="text-xs font-semibold text-emerald-600">Acknowledged</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl self-start">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-bold rounded-lg transition',
                  statusFilter === 'all'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                All
              </button>
              <button
                onClick={() => {
                  setStatusFilter('unread');
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5',
                  statusFilter === 'unread'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full text-[10px] font-black bg-teal-600 text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setStatusFilter('read');
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-bold rounded-lg transition',
                  statusFilter === 'read'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Read
              </button>
            </div>

            {/* Category Dropdown and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Category selector */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="danger">Critical Risk (Danger)</option>
                  <option value="warning">Clinical Warning</option>
                  <option value="success">Success / Resolved</option>
                  <option value="info">Information</option>
                </select>
              </div>

              {/* Keyword Search */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm w-full sm:w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Active filter summary tag if any */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-600">Active filters:</span>
                {statusFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 capitalize font-medium">
                    Status: {statusFilter}
                  </span>
                )}
                {categoryFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 capitalize font-medium">
                    Category: {categoryFilter}
                  </span>
                )}
                {appliedSearch && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                    Query: "{appliedSearch}"
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSearchQuery('');
                  setAppliedSearch('');
                  setCurrentPage(1);
                }}
                className="text-xs text-teal-600 hover:text-teal-800 font-semibold hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Notification Card List */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24">
              <LoadingSpinner label="Loading clinical notifications..." />
            </div>
          ) : fetchError ? (
            <div className="p-12 text-center space-y-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mx-auto border border-rose-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Failed to load notifications</h4>
                <p className="text-xs text-slate-500 mt-1">{fetchError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => fetchNotifications(true)}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-10 h-10 text-slate-300" />}
              title={
                hasActiveFilters
                  ? 'No matching notifications found'
                  : 'No notifications present'
              }
              description={
                hasActiveFilters
                  ? 'Try broadening your search keywords or resetting status and category filters.'
                  : 'System alerts, diagnostic report updates, and patient risk notifications will appear here.'
              }
              actionLabel={hasActiveFilters ? 'Clear all filters' : undefined}
              onAction={
                hasActiveFilters
                  ? () => {
                      setStatusFilter('all');
                      setCategoryFilter('all');
                      setSearchQuery('');
                      setAppliedSearch('');
                      setCurrentPage(1);
                    }
                  : undefined
              }
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((item) => {
                const theme = getCategoryTheme(item.category);
                const isItemActionRunning = actionInProgressId === item.id;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 transition border-l-4',
                      theme.cardBorder,
                      !item.read
                        ? 'bg-teal-50/25 hover:bg-teal-50/40'
                        : 'bg-white hover:bg-slate-50/80'
                    )}
                  >
                    {/* Left: Icon & Content */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="mt-1 shrink-0 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                        {theme.icon}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Title and Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={cn(
                              'text-sm tracking-tight text-slate-900',
                              !item.read ? 'font-black' : 'font-semibold'
                            )}
                          >
                            {item.title}
                          </h4>

                          {!item.read && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              Unread
                            </span>
                          )}

                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                              theme.badgeClass
                            )}
                          >
                            {theme.label}
                          </span>

                          {getScopeBadge(item)}
                        </div>

                        {/* Message body */}
                        <p className="text-xs text-slate-600 leading-relaxed break-words">
                          {item.message}
                        </p>

                        {/* Metadata & Timestamp */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                          <span>{formatDate(item.created_at)}</span>
                          <span>•</span>
                          <span>ID: #{item.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Individual Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleToggleReadStatus(item)}
                        disabled={isItemActionRunning}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-xs',
                          item.read
                            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 bg-white'
                            : 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200'
                        )}
                        title={item.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        {item.read ? (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>Mark unread</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-teal-600" />
                            <span>Mark read</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDismiss(item.id)}
                        disabled={isItemActionRunning}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Server-Side Pagination Bar */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{(currentPage - 1) * perPage + 1}</strong> to{' '}
                <strong>{Math.min(currentPage * perPage, totalCount)}</strong> of{' '}
                <strong>{totalCount}</strong> notifications
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <span>Per page:</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="text-xs px-2.5 py-1 h-8"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>

              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs px-2.5 py-1 h-8"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
