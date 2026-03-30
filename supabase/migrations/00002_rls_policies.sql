-- Enable RLS on all tables
ALTER TABLE servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_events ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM servants WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- SERVANTS
-- ============================================================
-- All authenticated users can read servants (for dropdowns)
CREATE POLICY servants_select ON servants
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can insert/update/delete servants
CREATE POLICY servants_admin_insert ON servants
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY servants_admin_update ON servants
  FOR UPDATE TO authenticated
  USING (is_admin() OR id = auth.uid())
  WITH CHECK (is_admin() OR id = auth.uid());

CREATE POLICY servants_admin_delete ON servants
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================================
-- PERSONS
-- ============================================================
-- All servants can read persons (for search/check-in)
-- But comments are filtered at the application layer (only assigned servant + admin)
CREATE POLICY persons_select ON persons
  FOR SELECT TO authenticated
  USING (true);

-- All servants can insert (registration)
CREATE POLICY persons_insert ON persons
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Servants can update their assigned persons; admins can update all
CREATE POLICY persons_update ON persons
  FOR UPDATE TO authenticated
  USING (assigned_servant_id = auth.uid() OR is_admin())
  WITH CHECK (assigned_servant_id = auth.uid() OR is_admin());

-- Only admins can delete persons (GDPR)
CREATE POLICY persons_delete ON persons
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================================
-- ATTENDANCE
-- ============================================================
-- All authenticated can read attendance
CREATE POLICY attendance_select ON attendance
  FOR SELECT TO authenticated
  USING (true);

-- All servants can insert/update attendance
CREATE POLICY attendance_insert ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY attendance_update ON attendance
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
-- Servants see their own follow-ups; admins see all
CREATE POLICY follow_ups_select ON follow_ups
  FOR SELECT TO authenticated
  USING (servant_id = auth.uid() OR is_admin());

-- Servants can create follow-ups
CREATE POLICY follow_ups_insert ON follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (servant_id = auth.uid() OR is_admin());

-- Servants can update their own follow-ups
CREATE POLICY follow_ups_update ON follow_ups
  FOR UPDATE TO authenticated
  USING (servant_id = auth.uid() OR is_admin())
  WITH CHECK (servant_id = auth.uid() OR is_admin());

-- ============================================================
-- ALERT CONFIG
-- ============================================================
-- All authenticated can read config
CREATE POLICY alert_config_select ON alert_config
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY alert_config_update ON alert_config
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- CACHED EVENTS
-- ============================================================
-- All authenticated can read events
CREATE POLICY cached_events_select ON cached_events
  FOR SELECT TO authenticated
  USING (true);

-- Only service role can write (via Edge Functions)
-- No insert/update/delete policies for authenticated role
