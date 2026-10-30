export type UserRole = 'admin' | 'labtech' | 'hepatologist' | 'patient';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  portal_id: string | null;
  active: boolean;
  must_change_password?: boolean;
  created_at: string | null;
}

export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Pending';

export interface BiomarkerFlag {
  marker: string;
  value: number;
  unit: string;
  severity: 'warning' | 'critical';
  message: string;
}

export interface PatientEvaluation {
  flags: BiomarkerFlag[];
  clinical_signs: string[];
}

export interface Patient {
  id: number;
  full_name: string;
  portal_id: string;
  age: number;
  gender: string;
  phone?: string;
  email?: string;
  bilirubin?: number | null;
  direct_bilirubin?: number | null;
  albumin?: number | null;
  sgot?: number | null;
  sgpt?: number | null;
  platelets?: number | null;
  cholesterol?: number | null;
  prothrombin?: number | null;
  ascites?: boolean;
  hepatomegaly?: boolean;
  spiders?: boolean;
  edema?: boolean;
  copper?: number | null;
  alk_phos?: number | null;
  triglycerides?: number | null;
  latest_risk_label: RiskLevel;
  latest_risk_percent: number;
  treatment_status: string;
  treatment_status_updated_at?: string | null;
  lab_workflow_status?: string | null;
  latest_test?: string;
  doctor_confirmed_status?: string | null;
  doctor_confirmed_by?: string | null;
  doctor_confirmed_at?: string | null;
  is_doctor_confirmed?: boolean;
  treatment_completed_at?: string | null;
  treatment_completed_by_id?: number | null;
  treatment_completed_by?: string | null;
  treatment_completed_notes?: string | null;
  diet_plan?: string | null;
  care_instructions?: string | null;
  follow_up_date?: string | null;
  created_by_id?: number;
  assigned_doctor_id?: number | null;
  assigned_doctor_name?: string | null;
  report_review_status?: string;
  unreviewed_reports_count?: number;
  reviewed_reports_count?: number;
  prescriptions_count?: number;
  created_at?: string;
  updated_at?: string;
  evaluation?: PatientEvaluation;
  predictions?: Prediction[];
  prescriptions?: Prescription[];
  reports?: MedicalReport[];
  appointments?: Appointment[];
  lab_orders?: LabOrder[];
}

export interface Prediction {
  id: number;
  patient_id: number;
  probability: number;
  risk_label: RiskLevel;
  confidence: number;
  model_name: string;
  created_at: string;
}

export interface Prescription {
  id: number;
  patient_id: number;
  patient_name?: string;
  doctor_id: number;
  doctor_name?: string;
  medicine: string;
  dosage: string;
  frequency_days: number;
  clinical_notes?: string;
  diet_suggestion?: string;
  follow_up_date?: string;
  created_at: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  patient_name?: string;
  patient_portal_id?: string;
  doctor_id: number;
  doctor_name?: string;
  scheduled_at: string;
  reason: string;
  status: 'Pending' | 'Confirmed' | 'Reschedule Requested' | 'Rescheduled' | 'Rejected' | 'Completed' | 'Cancelled';
  appointment_type?: string;
  doctor_notes?: string;
  reschedule_message?: string;
  created_at: string;
}

export interface MedicalReport {
  id: number;
  patient_id: number;
  patient_name?: string;
  filename: string;
  original_filename: string;
  category: string;
  lab_order_id?: number | null;
  test_type?: string;
  uploaded_at: string;
  is_reviewed?: boolean;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
}

export type LabOrderPriority = 'Routine' | 'Urgent' | 'STAT';

export type LabOrderStatus =
  | 'Ordered'
  | 'Sample Collected'
  | 'In Progress'
  | 'Completed'
  | 'Clarification Required'
  | 'Test Not Performed'
  | 'No Test Needed'
  | 'Cancelled'
  | string;

export interface LabOrder {
  id: number;
  patient_id: number;
  patient_name?: string;
  patient_portal_id?: string;
  doctor_id: number;
  doctor_name?: string;
  test_type: string;
  clinical_indication?: string;
  priority: LabOrderPriority;
  order_status: LabOrderStatus;
  created_at: string;
  completed_at?: string | null;
  sample_collected_at?: string | null;
  status_reason?: string | null;
  clarification_requested_at?: string | null;
  clarification_requested_by_id?: number | null;
  clarification_requested_by?: string | null;
  doctor_decision?: string | null;
  doctor_decision_at?: string | null;
  doctor_decision_by_id?: number | null;
  doctor_decision_by?: string | null;
  doctor_notes?: string | null;
  reports?: MedicalReport[];
}

export interface SystemNotification {
  id: number;
  user_id?: number | null;
  role?: string | null;
  title: string;
  message: string;
  category: 'info' | 'success' | 'warning' | 'danger' | string;
  read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  success: boolean;
  notifications: SystemNotification[];
  unread_count: number;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ActivityLogItem {
  id: number;
  action: string;
  details: string;
  user_email: string;
  user_name?: string;
  user_id?: number | null;
  user_role?: string;
  created_at: string;
}

export interface AdminStats {
  total_patients: number;
  newly_registered_patients?: number;
  awaiting_doctor_review?: number;
  patients_under_treatment?: number;
  treatment_completed?: number;
  follow_up_required?: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  pending_risk: number;
  pending_appointment_requests?: number;
  clinical_status_counts?: Record<string, number>;
  lab_status_counts?: Record<string, number>;
  active_accounts_count?: number;
  inactive_accounts_count?: number;
  total_users: number;
  total_predictions: number;
  total_appointments: number;
  unread_notifications: number;
  clinical_reports?: number;
  total_reports?: number;
  pending_reviews?: number;
  active_staff?: number;
  appointment_statuses?: Record<string, number>;
  report_categories?: Record<string, number>;
  prediction_risks?: Record<string, number>;
  age_distribution?: Record<string, number>;
  staff_breakdown?: {
    doctors: number;
    labtechs: number;
    admins: number;
    patients: number;
  };
  total_logs?: number;
  test_status_counts?: Record<string, number>;
  pending_reports?: number;
  uploaded_reports?: number;
  completed_tests?: number;
  total_doctors?: number;
  total_labtechs?: number;
}

export interface AdminDashboardData {
  role: 'admin';
  stats: AdminStats;
  recent_logs: ActivityLogItem[];
  recent_patients: Patient[];
  recent_staff?: User[];
}

export interface LabTechStats {
  total_records: number;
  total_patients: number;
  reports_uploaded: number;
  reports_pending: number;
  reports_recent: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  awaiting_review: number;
  completed_predictions: number;
}

export interface LabTechDashboardData {
  role: 'labtech';
  stats: LabTechStats;
  recent_records: Patient[];
  recent_reports?: MedicalReport[];
}

export interface HepatologistStats {
  assigned_patients: number;
  pending_clinical_reviews: number;
  reports_awaiting_review: number;
  upcoming_appointments: number;
  high_risk: number;
  urgent_review: number;
  awaiting_review: number;
  under_treatment: number;
  stable: number;
  treatment_completed?: number;
  clarification_requests_count?: number;
  appointments_count: number;
}

export interface ClinicalActivityItem {
  id: string;
  type: 'prescription' | 'appointment';
  action: string;
  patient_name: string;
  patient_portal_id?: string | null;
  timestamp: string | null;
}

export interface HepatologistDashboardData {
  role: 'hepatologist';
  stats: HepatologistStats;
  appointments: Appointment[];
  priority_patients: Patient[];
  all_assigned_patients?: Patient[];
  recent_reports?: MedicalReport[];
  prescriptions?: Prescription[];
  recent_activity: ClinicalActivityItem[];
}

export interface PatientDashboardData {
  role: 'patient';
  portal_id: string;
  records_count: number;
  reports_count: number;
  unreviewed_reports_count?: number;
  reviewed_reports_count?: number;
  report_review_status?: string;
  predictions_count: number;
  upcoming_appointments: number;
  biomarkers_recorded: boolean;
  lab_orders_count?: number;
  active_lab_orders_count?: number;
  latest_lab_order?: LabOrder | null;
  lab_orders?: LabOrder[];
  latest_record: Patient | null;
  records: Patient[];
  appointments: Appointment[];
  recent_reports?: MedicalReport[];
}

export interface AnalyticsData {
  total_patients: number;
  risk_distribution: {
    'High Risk': number;
    'Medium Risk': number;
    'Low Risk': number;
    'Pending': number;
  };
  status_distribution?: Record<string, number>;
  age_distribution: {
    '< 30': number;
    '30-49': number;
    '50-64': number;
    '65+': number;
  };
  averages: {
    bilirubin: number;
    albumin: number;
    sgot: number;
    sgpt: number;
  };
}

export interface ReportAnalyticsData {
  total_reports: number;
  unique_patients: number;
  reports_by_category: Record<string, number>;
  reports_by_status: Record<string, number>;
  reports_by_risk: Record<string, number>;
  upload_trends: { date: string; count: number }[];
  awaiting_review_count: number;
  recent_activity_trends?: { id: number; action: string; details: string; created_at: string }[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
  [key: string]: any;
}
