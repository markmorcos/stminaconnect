-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'servant');
CREATE TYPE person_status AS ENUM ('new', 'active', 'inactive');
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low', 'very_low');
CREATE TYPE registration_type AS ENUM ('quick_add', 'full');
CREATE TYPE follow_up_reason AS ENUM ('absence_alert', 'manual');
CREATE TYPE follow_up_action AS ENUM ('called', 'texted', 'visited', 'no_answer', 'other');
CREATE TYPE follow_up_status AS ENUM ('pending', 'completed', 'snoozed');
CREATE TYPE supported_language AS ENUM ('en', 'ar', 'de');

-- Servants (linked to Supabase auth.users)
CREATE TABLE servants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'servant',
  regions TEXT[] DEFAULT '{}',
  preferred_language supported_language NOT NULL DEFAULT 'en',
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Persons (church members)
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  region TEXT,
  language supported_language NOT NULL DEFAULT 'en',
  priority priority_level,
  assigned_servant_id UUID REFERENCES servants(id) ON DELETE SET NULL,
  comments TEXT,
  registration_type registration_type NOT NULL DEFAULT 'full',
  registered_by UUID REFERENCES servants(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status person_status NOT NULL DEFAULT 'new',
  paused_until DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persons_assigned_servant ON persons(assigned_servant_id);
CREATE INDEX idx_persons_status ON persons(status);
CREATE INDEX idx_persons_region ON persons(region);

-- Cached events (from Google Calendar)
CREATE TABLE cached_events (
  google_event_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cached_events_date ON cached_events(date);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  event_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT FALSE,
  marked_by UUID REFERENCES servants(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE (person_id, google_event_id, event_date)
);

CREATE INDEX idx_attendance_person ON attendance(person_id);
CREATE INDEX idx_attendance_event_date ON attendance(event_date);
CREATE INDEX idx_attendance_google_event ON attendance(google_event_id);

-- Follow-ups
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  servant_id UUID NOT NULL REFERENCES servants(id) ON DELETE CASCADE,
  reason follow_up_reason NOT NULL DEFAULT 'manual',
  trigger_event_title TEXT,
  missed_count INT,
  action follow_up_action,
  notes TEXT,
  status follow_up_status NOT NULL DEFAULT 'pending',
  snoozed_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_follow_ups_servant ON follow_ups(servant_id);
CREATE INDEX idx_follow_ups_person ON follow_ups(person_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);

-- Alert config (singleton)
CREATE TABLE alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counted_event_patterns TEXT[] DEFAULT '{}',
  default_threshold INT NOT NULL DEFAULT 3,
  priority_thresholds JSONB,
  notify_admin BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER servants_updated_at
  BEFORE UPDATE ON servants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER persons_updated_at
  BEFORE UPDATE ON persons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER alert_config_updated_at
  BEFORE UPDATE ON alert_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
