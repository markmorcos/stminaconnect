-- ============================================================
-- Phase 2: RPC Functions
-- ============================================================

-- get_my_group: Returns the servant's assigned persons with attendance summary
CREATE OR REPLACE FUNCTION get_my_group(p_servant_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  status person_status,
  priority priority_level,
  last_attended_date date,
  consecutive_misses integer
) AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.status,
    p.priority,
    (SELECT MAX(a.event_date) FROM attendance a WHERE a.person_id = p.id AND a.present = true),
    COALESCE((
      SELECT COUNT(*)::integer
      FROM (
        SELECT a.event_date
        FROM attendance a
        JOIN alert_config ac ON true
        WHERE a.person_id = p.id
          AND a.present = false
          AND a.event_title = ANY(ac.counted_event_patterns)
          AND NOT EXISTS (
            SELECT 1 FROM attendance a2
            WHERE a2.person_id = p.id
              AND a2.present = true
              AND a2.event_date > a.event_date
          )
        ORDER BY a.event_date DESC
      ) sub
    ), 0)
  FROM persons p
  WHERE p.assigned_servant_id = p_servant_id
  ORDER BY p.last_name, p.first_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- get_dashboard_stats: Admin-only overview metrics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
  SELECT json_build_object(
    'total_members', (SELECT COUNT(*) FROM persons),
    'newcomers_this_month', (
      SELECT COUNT(*) FROM persons
      WHERE registered_at >= date_trunc('month', now())
    ),
    'avg_attendance_rate', (
      SELECT ROUND(
        COUNT(*) FILTER (WHERE present = true)::numeric /
        NULLIF(COUNT(*)::numeric, 0) * 100, 1
      )
      FROM attendance a
      JOIN alert_config ac ON a.event_title = ANY(ac.counted_event_patterns)
      WHERE a.event_date >= now() - interval '8 weeks'
    ),
    'at_risk_count', (
      SELECT COUNT(*) FROM follow_ups
      WHERE status = 'pending' AND reason = 'absence_alert'
    ),
    'active_members', (SELECT COUNT(*) FROM persons WHERE status = 'active'),
    'inactive_members', (SELECT COUNT(*) FROM persons WHERE status = 'inactive')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- get_attendance_for_event: All persons with their attendance for an event
CREATE OR REPLACE FUNCTION get_attendance_for_event(
  p_event_id text,
  p_event_date date
)
RETURNS TABLE (
  person_id uuid,
  first_name text,
  last_name text,
  present boolean,
  marked_by uuid
) AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    COALESCE(a.present, false),
    a.marked_by
  FROM persons p
  LEFT JOIN attendance a
    ON a.person_id = p.id
    AND a.google_event_id = p_event_id
    AND a.event_date = p_event_date
  ORDER BY p.last_name, p.first_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- bulk_upsert_attendance: Sync endpoint for offline attendance (last-write-wins)
CREATE OR REPLACE FUNCTION bulk_upsert_attendance(records jsonb)
RETURNS integer AS $$
DECLARE
  affected integer := 0;
  rec jsonb;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(records)
  LOOP
    INSERT INTO attendance (
      person_id, google_event_id, event_title, event_date,
      present, marked_by, marked_at, synced_at
    ) VALUES (
      (rec->>'person_id')::uuid,
      rec->>'google_event_id',
      rec->>'event_title',
      (rec->>'event_date')::date,
      (rec->>'present')::boolean,
      (rec->>'marked_by')::uuid,
      (rec->>'marked_at')::timestamptz,
      now()
    )
    ON CONFLICT (person_id, google_event_id, event_date)
    DO UPDATE SET
      present = EXCLUDED.present,
      marked_by = EXCLUDED.marked_by,
      marked_at = EXCLUDED.marked_at,
      synced_at = now()
    WHERE attendance.marked_at < EXCLUDED.marked_at;

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
