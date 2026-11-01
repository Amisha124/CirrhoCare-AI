import type {
  ActivityLogItem,
  AdminDashboardData,
  AnalyticsData,
  Appointment,
  LabOrder,
  MedicalReport,
  Patient,
  Prediction,
  Prescription,
  NotificationListResponse,
  ReportAnalyticsData,
  SystemNotification,
  User,
} from '@/types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = new Headers(options.headers || {});

    // Set JSON content type unless body is FormData
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Ensure session cookies are sent to Flask
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Unauthorized
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Authentication required. Please log in.');
      }

      if (response.status === 403) {
        // Forbidden
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'You do not have permission to perform this action.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to the CirrhoCare AI backend. Please verify the Flask server is running.');
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  auth = {
    login: (identifier: string, password: string, remember = false) =>
      this.request<{ success: boolean; user: User; message: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, remember }),
      }),

    logout: () =>
      this.request<{ success: boolean; message: string }>('/auth/logout', {
        method: 'POST',
      }),

    me: () =>
      this.request<{ success: boolean; authenticated: boolean; user: User | null }>('/auth/me', {
        method: 'GET',
      }),

    forgotPassword: (email: string) =>
      this.request<{ success: boolean; message: string; dev_reset_url?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      this.request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),

    verifyActivationToken: (token: string) =>
      this.request<{
        success: boolean;
        valid: boolean;
        user: { name: string; email: string; portal_id?: string };
        message: string;
      }>(`/auth/verify-activation-token?token=${encodeURIComponent(token)}`, {
        method: 'GET',
      }),

    activateAccount: (token: string, password: string, confirmPassword?: string) =>
      this.request<{ success: boolean; message: string; user: User }>('/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
      }),

    getOAuthStatus: () =>
      this.request<{ success: boolean; google_enabled: boolean; google_client_id: string | null }>('/auth/oauth-status', {
        method: 'GET',
      }),

    patientLogin: (name: string, portal_id: string, remember: boolean = false) =>
      this.request<{ success: boolean; user: User; message: string }>('/auth/patient-login', {
        method: 'POST',
        body: JSON.stringify({ name, portal_id, remember }),
      }),

    changePin: (data: { current_pin: string; new_pin: string; confirm_pin?: string }) =>
      this.request<{ success: boolean; user: User; message: string }>('/auth/change-pin', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateProfile: (data: { name: string }) =>
      this.request<{ success: boolean; user: User; message: string }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    demoLogin: (role: 'admin' | 'doctor' | 'labtech' | 'patient') =>
      this.request<{ success: boolean; user: User; message: string; redirect_url: string }>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
  };

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard = {
    getStats: <T = AdminDashboardData>() =>
      this.request<{ success: boolean } & T>('/dashboard/stats', {
        method: 'GET',
      }),
  };

  // ---------------------------------------------------------------------------
  // Patients
  // ---------------------------------------------------------------------------
  patients = {
    list: (params: {
      q?: string;
      risk?: string;
      status?: string;
      scope?: string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.risk) searchParams.set('risk', params.risk);
      if (params.status) searchParams.set('status', params.status);
      if (params.scope) searchParams.set('scope', params.scope);
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params.sort_dir) searchParams.set('sort_dir', params.sort_dir);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        patients: Patient[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/patients${query}`);
    },

    get: (id: number) =>
      this.request<{ success: boolean; patient: Patient }>(`/patients/${id}`),

    updateReviewStatus: (
      id: number,
      treatment_status: string,
      options: { confirm?: boolean; treatment_notes?: string } = {}
    ) =>
      this.request<{ success: boolean; patient: Patient; message: string }>(`/patients/${id}/review-status`, {
        method: 'PATCH',
        body: JSON.stringify({ treatment_status, ...options }),
      }),

    create: (data: Partial<Patient>) =>
      this.request<{
        success: boolean;
        patient: Patient;
        prediction: any;
        message: string;
        initial_pin?: string;
        portal_id?: string;
        email_sent?: boolean;
        activation_url?: string;
      }>('/patients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: number, data: Partial<Patient>) =>
      this.request<{
        success: boolean;
        patient: Patient;
        prediction: any;
        report?: MedicalReport;
        generated_report?: MedicalReport;
        report_error?: string;
        message: string;
      }>(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getReports: (patientId: number) =>
      this.request<{
        success: boolean;
        reports: MedicalReport[];
        total: number;
      }>(`/patients/${patientId}/reports`),

    generateReport: (patientId: number) =>
      this.request<{
        success: boolean;
        report: MedicalReport;
        patient: Patient;
        message: string;
      }>(`/patients/${patientId}/generate-report`, {
        method: 'POST',
      }),

    delete: (id: number) =>
      this.request<{ success: boolean; message: string }>(`/patients/${id}`, {
        method: 'DELETE',
      }),

    resetPin: (id: number) =>
      this.request<{
        success: boolean;
        message: string;
        portal_id: string;
        new_pin: string;
      }>(`/patients/${id}/reset-pin`, {
        method: 'POST',
      }),

    invite: (id: number, email?: string) =>
      this.request<{
        success: boolean;
        message: string;
        email_sent: boolean;
        delivery_status: string;
        provider?: string;
        activation_url?: string;
      }>(`/patients/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    getActivationStatus: (id: number) =>
      this.request<{
        success: boolean;
        has_portal_account: boolean;
        is_activated: boolean;
        user_email?: string;
        last_token?: {
          id: number;
          delivery_status: string;
          delivery_provider?: string;
          delivery_error?: string;
          sent_to_email?: string;
          last_sent_at?: string;
          created_at?: string;
          expires_at?: string;
          is_expired: boolean;
          is_used: boolean;
          is_revoked: boolean;
        };
      }>(`/patients/${id}/activation-status`),

    saveAdvice: (
      id: number,
      data: {
        diet_plan?: string;
        care_instructions?: string;
        follow_up_date?: string;
        treatment_status?: string;
      }
    ) =>
      this.request<{
        success: boolean;
        message: string;
        patient: Patient;
      }>(`/patients/${id}/advice`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // ---------------------------------------------------------------------------
  // AI Predictions
  // ---------------------------------------------------------------------------
  predict = {
    direct: (payload: Record<string, any>) =>
      this.request<{
        success: boolean;
        probability: number;
        risk_label: string;
        confidence: number;
        model_accuracy: number;
        biomarker_flags: any[];
        clinical_signs: string[];
      }>('/predict', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    history: (patientId: number) =>
      this.request<{ success: boolean; predictions: any[] }>(`/patients/${patientId}/predictions`),

    list: (params: {
      q?: string;
      risk?: string;
      patient_id?: number;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.risk) searchParams.set('risk', params.risk);
      if (params.patient_id) searchParams.set('patient_id', params.patient_id.toString());
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params.sort_dir) searchParams.set('sort_dir', params.sort_dir);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        predictions: Prediction[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/predictions${query}`);
    },
  };

  predictions = this.predict;

  // ---------------------------------------------------------------------------
  // Users & Clinicians
  // ---------------------------------------------------------------------------
  users = {
    list: (params: {
      q?: string;
      role?: string;
      active?: boolean | string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.role) searchParams.set('role', params.role);
      if (params.active !== undefined) searchParams.set('active', String(params.active));
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params.sort_dir) searchParams.set('sort_dir', params.sort_dir);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        users: User[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/users${query}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Doctors
  // ---------------------------------------------------------------------------
  doctors = {
    list: () =>
      this.request<{ success: boolean; doctors: User[] }>('/doctors'),
  };

  // ---------------------------------------------------------------------------
  // Prescriptions
  // ---------------------------------------------------------------------------
  prescriptions = {
    list: (params?: {
      q?: string;
      patient_id?: number;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } | number) => {
      const opts = typeof params === 'number' ? { patient_id: params } : (params || {});
      const searchParams = new URLSearchParams();
      if (opts.q) searchParams.set('q', opts.q);
      if (opts.patient_id) searchParams.set('patient_id', opts.patient_id.toString());
      if (opts.start_date) searchParams.set('start_date', opts.start_date);
      if (opts.end_date) searchParams.set('end_date', opts.end_date);
      if (opts.sort_by) searchParams.set('sort_by', opts.sort_by);
      if (opts.sort_dir) searchParams.set('sort_dir', opts.sort_dir);
      if (opts.page) searchParams.set('page', opts.page.toString());
      if (opts.per_page) searchParams.set('per_page', opts.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        prescriptions: Prescription[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/prescriptions${query}`);
    },

    create: (patientId: number, data: {
      medicine?: string;
      dosage?: string;
      frequency_days?: number;
      treatment_status?: string;
      clinical_notes?: string;
      diet_suggestion?: string;
      diet_plan?: string;
      care_instructions?: string;
      follow_up_date?: string;
      medicines?: Array<{
        medicine: string;
        dosage: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
      }>;
    }) =>
      this.request<{
        success: boolean;
        prescription?: Prescription;
        prescriptions?: Prescription[];
        treatment_status: string;
        message: string;
      }>(
        `/patients/${patientId}/prescriptions`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    get: (id: number) =>
      this.request<{ success: boolean; prescription: Prescription }>(`/prescriptions/${id}`),
  };

  // ---------------------------------------------------------------------------
  // Appointments
  // ---------------------------------------------------------------------------
  appointments = {
    list: (params?: {
      q?: string;
      status?: string;
      patient_id?: number;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } | string) => {
      const opts = typeof params === 'string' ? { status: params } : (params || {});
      const searchParams = new URLSearchParams();
      if (opts.q) searchParams.set('q', opts.q);
      if (opts.status) searchParams.set('status', opts.status);
      if (opts.patient_id) searchParams.set('patient_id', opts.patient_id.toString());
      if (opts.start_date) searchParams.set('start_date', opts.start_date);
      if (opts.end_date) searchParams.set('end_date', opts.end_date);
      if (opts.sort_by) searchParams.set('sort_by', opts.sort_by);
      if (opts.sort_dir) searchParams.set('sort_dir', opts.sort_dir);
      if (opts.page) searchParams.set('page', opts.page.toString());
      if (opts.per_page) searchParams.set('per_page', opts.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        appointments: Appointment[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/appointments${query}`);
    },

    get: (id: number) =>
      this.request<{ success: boolean; appointment: Appointment }>(`/appointments/${id}`),

    create: (data: { patient_id?: number; doctor_id?: number; scheduled_at: string; reason: string; appointment_type?: string }) =>
      this.request<{ success: boolean; appointment: Appointment; message: string }>('/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    reschedule: (id: number, data: { scheduled_at: string; reason?: string }) =>
      this.request<{ success: boolean; appointment: Appointment; message: string }>(`/appointments/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateStatus: (
      id: number,
      status: 'Pending' | 'Confirmed' | 'Reschedule Requested' | 'Rescheduled' | 'Rejected' | 'Completed' | 'Cancelled',
      options?: { notes?: string; reason?: string; scheduled_at?: string; doctor_notes?: string }
    ) =>
      this.request<{ success: boolean; appointment: Appointment; message: string }>(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...options }),
      }),
  };

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  reports = {
    list: (params?: {
      q?: string;
      category?: string;
      patient_id?: number;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } | number) => {
      const opts = typeof params === 'number' ? { patient_id: params } : (params || {});
      const searchParams = new URLSearchParams();
      if (opts.q) searchParams.set('q', opts.q);
      if (opts.category) searchParams.set('category', opts.category);
      if (opts.patient_id) searchParams.set('patient_id', opts.patient_id.toString());
      if (opts.start_date) searchParams.set('start_date', opts.start_date);
      if (opts.end_date) searchParams.set('end_date', opts.end_date);
      if (opts.sort_by) searchParams.set('sort_by', opts.sort_by);
      if (opts.sort_dir) searchParams.set('sort_dir', opts.sort_dir);
      if (opts.page) searchParams.set('page', opts.page.toString());
      if (opts.per_page) searchParams.set('per_page', opts.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        reports: MedicalReport[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/reports${query}`);
    },

    upload: (
      patientId: number,
      file: File,
      category = 'Lab report',
      labOrderId?: number,
      completeOrder?: boolean,
      allowReplace?: boolean,
      replaceReportId?: number
    ) => {
      const formData = new FormData();
      formData.append('report', file);
      formData.append('category', category);
      if (labOrderId) {
        formData.append('lab_order_id', labOrderId.toString());
      }
      if (completeOrder !== undefined) {
        formData.append('complete_order', completeOrder ? 'true' : 'false');
      }
      if (allowReplace) {
        formData.append('allow_replace', 'true');
      }
      if (replaceReportId) {
        formData.append('replace_report_id', replaceReportId.toString());
      }
      return this.request<{ success: boolean; report: MedicalReport; message: string }>(
        `/patients/${patientId}/reports`,
        {
          method: 'POST',
          body: formData,
        }
      );
    },

    batchUpload: (patientId: number, files: File[], category = 'Lab report', labOrderId?: number) => {
      const formData = new FormData();
      formData.append('patient_id', patientId.toString());
      formData.append('category', category);
      if (labOrderId) {
        formData.append('lab_order_id', labOrderId.toString());
      }
      files.forEach((f) => formData.append('reports', f));
      return this.request<{
        success: boolean;
        uploaded_count: number;
        failed_count: number;
        uploaded_files: string[];
        failed_files: { filename: string; error: string }[];
        message: string;
      }>('/reports/batch-upload', {
        method: 'POST',
        body: formData,
      });
    },

    getDownloadUrl: (reportId: number) => `/api/reports/${reportId}/download`,

    generate: (patientId: number) =>
      this.request<{
        success: boolean;
        report: MedicalReport;
        patient: Patient;
        message: string;
      }>(`/patients/${patientId}/generate-report`, {
        method: 'POST',
      }),

    markReviewed: (reportId: number) => {
      return this.request<{
        success: boolean;
        report: MedicalReport;
        message: string;
      }>(`/reports/${reportId}/review`, {
        method: 'POST',
      });
    },

    analytics: (params: { start_date?: string; end_date?: string; patient_id?: number } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.patient_id) searchParams.set('patient_id', params.patient_id.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{ success: boolean } & ReportAnalyticsData>(`/reports/analytics${query}`);
    },
  };

  // ---------------------------------------------------------------------------
  // Diagnostic Laboratory Orders (Doctor-to-Lab Accession Lifecycle)
  // ---------------------------------------------------------------------------
  labOrders = {
    list: (params: {
      patient_id?: number;
      status?: string;
      priority?: string;
      page?: number;
      per_page?: number;
      mine?: boolean;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.patient_id) searchParams.set('patient_id', params.patient_id.toString());
      if (params.status) searchParams.set('status', params.status);
      if (params.priority) searchParams.set('priority', params.priority);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params.mine) searchParams.set('mine', 'true');
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        orders: LabOrder[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/lab-orders${query}`);
    },

    get: (orderId: number) => {
      return this.request<{ success: boolean; order: LabOrder }>(`/lab-orders/${orderId}`);
    },

    create: (
      patientId: number,
      data: {
        test_type: string;
        clinical_indication?: string;
        priority?: 'Routine' | 'Urgent' | 'STAT';
        doctor_id?: number;
      }
    ) => {
      return this.request<{ success: boolean; order: LabOrder; message: string }>(
        `/patients/${patientId}/lab-orders`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
    },

    updateStatus: (orderId: number, status: string, reason?: string) => {
      return this.request<{ success: boolean; order: LabOrder; message: string }>(
        `/lab-orders/${orderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reason }),
        }
      );
    },

    submitDoctorDecision: (
      orderId: number,
      decision: 'No Test Needed' | 'Cancelled' | 'Proceed',
      notes?: string
    ) => {
      return this.request<{ success: boolean; order: LabOrder; message: string }>(
        `/lab-orders/${orderId}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, notes }),
        }
      );
    },
  };

  // ---------------------------------------------------------------------------
  // Notifications & Audit Logs
  // ---------------------------------------------------------------------------
  notifications = {
    list: (params?: {
      status?: 'all' | 'read' | 'unread';
      category?: string;
      q?: string;
      page?: number;
      per_page?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
      if (params?.category && params.category !== 'all') searchParams.set('category', params.category);
      if (params?.q) searchParams.set('q', params.q.trim());
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      const qs = searchParams.toString();
      return this.request<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`);
    },

    markAllRead: () =>
      this.request<{ success: boolean; message: string }>('/notifications/mark-read', {
        method: 'POST',
      }),

    // Backward-compatibility alias
    markRead: () =>
      this.request<{ success: boolean; message: string }>('/notifications/mark-read', {
        method: 'POST',
      }),

    markOneRead: (id: number) =>
      this.request<{ success: boolean; notification: SystemNotification; message: string }>(
        `/notifications/${id}/read`,
        { method: 'PATCH' }
      ),

    markOneUnread: (id: number) =>
      this.request<{ success: boolean; notification: SystemNotification; message: string }>(
        `/notifications/${id}/unread`,
        { method: 'PATCH' }
      ),

    dismiss: (id: number) =>
      this.request<{ success: boolean; message: string }>(`/notifications/${id}`, {
        method: 'DELETE',
      }),
  };

  logs = {
    list: (params?: {
      q?: string;
      action?: string;
      role?: string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      page?: number;
      per_page?: number;
    } | number, legacyPerPage = 30) => {
      const opts = typeof params === 'number' ? { page: params, per_page: legacyPerPage } : (params || {});
      const searchParams = new URLSearchParams();
      if (opts.q) searchParams.set('q', opts.q);
      if (opts.action) searchParams.set('action', opts.action);
      if (opts.role) searchParams.set('role', opts.role);
      if (opts.start_date) searchParams.set('start_date', opts.start_date);
      if (opts.end_date) searchParams.set('end_date', opts.end_date);
      if (opts.sort_by) searchParams.set('sort_by', opts.sort_by);
      if (opts.sort_dir) searchParams.set('sort_dir', opts.sort_dir);
      if (opts.page) searchParams.set('page', opts.page.toString());
      if (opts.per_page) searchParams.set('per_page', opts.per_page.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{
        success: boolean;
        logs: ActivityLogItem[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
      }>(`/logs${query}`);
    },
  };

  analytics = {
    get: (params: { start_date?: string; end_date?: string } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<{ success: boolean } & AnalyticsData>(`/analytics${query}`);
    },
  };

  health = {
    check: () =>
      this.request<{
        success: boolean;
        status: string;
        service: string;
        version: string;
        demo_mode?: boolean;
        timestamp: string;
      }>('/health'),
  };

  // ---------------------------------------------------------------------------
  // Secure CSV & PDF Exports
  // ---------------------------------------------------------------------------
  exports = {
    getCsvUrl: (params: {
      q?: string;
      risk?: string;
      status?: string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      scope?: string;
      current_page?: boolean;
      page?: number;
      per_page?: number;
      patient_id?: number;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q.trim());
      if (params.risk) searchParams.set('risk', params.risk);
      if (params.status) searchParams.set('status', params.status);
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params.sort_dir) searchParams.set('sort_dir', params.sort_dir);
      if (params.scope) searchParams.set('scope', params.scope);
      if (params.current_page) searchParams.set('current_page', 'true');
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params.patient_id) searchParams.set('patient_id', params.patient_id.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return `/api/export/patients.csv${query}`;
    },

    getPdfUrl: (params: {
      q?: string;
      risk?: string;
      status?: string;
      start_date?: string;
      end_date?: string;
      sort_by?: string;
      sort_dir?: 'asc' | 'desc';
      scope?: string;
      current_page?: boolean;
      page?: number;
      per_page?: number;
      patient_id?: number;
    } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q.trim());
      if (params.risk) searchParams.set('risk', params.risk);
      if (params.status) searchParams.set('status', params.status);
      if (params.start_date) searchParams.set('start_date', params.start_date);
      if (params.end_date) searchParams.set('end_date', params.end_date);
      if (params.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params.sort_dir) searchParams.set('sort_dir', params.sort_dir);
      if (params.scope) searchParams.set('scope', params.scope);
      if (params.current_page) searchParams.set('current_page', 'true');
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params.patient_id) searchParams.set('patient_id', params.patient_id.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return `/api/export/report.pdf${query}`;
    },

    getSinglePatientCsvUrl: (patientId: number) => `/api/patients/${patientId}/export/csv`,
    getSinglePatientPdfUrl: (patientId: number) => `/api/patients/${patientId}/export/pdf`,

    downloadFile: async (url: string, defaultFilename: string): Promise<void> => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        let errorMsg = `Download failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error || errJson.message) {
            errorMsg = errJson.error || errJson.message;
          }
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = defaultFilename;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    },
  };
}

export const api = new ApiClient();
