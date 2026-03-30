export type UserRole = "admin" | "servant";
export type PersonStatus = "new" | "active" | "inactive";
export type Priority = "high" | "medium" | "low" | "very_low";
export type RegistrationType = "quick_add" | "full";
export type FollowUpReason = "absence_alert" | "manual";
export type FollowUpAction = "called" | "texted" | "visited" | "no_answer" | "other";
export type FollowUpStatus = "pending" | "completed" | "snoozed";
export type Language = "en" | "ar" | "de";

export interface Servant {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  regions: string[];
  preferred_language: Language;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  region: string | null;
  language: Language;
  priority: Priority | null;
  assigned_servant_id: string;
  comments: string | null;
  registration_type: RegistrationType;
  registered_by: string;
  registered_at: string;
  status: PersonStatus;
  paused_until: string | null;
  updated_at: string;
}

export interface Attendance {
  id: string;
  person_id: string;
  google_event_id: string;
  event_title: string;
  event_date: string;
  present: boolean;
  marked_by: string;
  marked_at: string;
  synced_at: string | null;
}

export interface FollowUp {
  id: string;
  person_id: string;
  servant_id: string;
  reason: FollowUpReason;
  trigger_event_title: string | null;
  missed_count: number | null;
  action: FollowUpAction | null;
  notes: string | null;
  status: FollowUpStatus;
  snoozed_until: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AlertConfig {
  id: string;
  counted_event_patterns: string[];
  default_threshold: number;
  priority_thresholds: Record<Priority, number> | null;
  notify_admin: boolean;
  updated_at: string;
}

export interface CachedEvent {
  google_event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  date: string;
  fetched_at: string;
}
