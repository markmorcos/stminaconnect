# Screens

## Navigation Map

```
Root Layout (_layout.tsx)
│
├─ (auth)/                          [Unauthenticated users only]
│   ├─ onboarding                   First launch only
│   └─ login                        Phone OTP 2-step
│
└─ (tabs)/                          [Authenticated users only]
    ├─ home                         Dashboard
    ├─ checkin/
    │   ├─ index                    Today's events
    │   └─ [eventId]                Attendance marking
    ├─ people/
    │   ├─ index                    Member list + search
    │   ├─ quick-add                Quick Add form
    │   ├─ register                 Full Registration form
    │   └─ [personId]               Member profile
    └─ more/
        ├─ index                    Menu hub
        ├─ follow-ups               Follow-up list
        ├─ follow-ups/[id]          Follow-up detail
        ├─ reports                  Admin reports
        └─ settings                 App settings + alert config
```

**Total: 14 screens** (3 auth + 11 main)

---

## Auth Screens

### 1. Onboarding

|            |                                     |
| ---------- | ----------------------------------- |
| **Route**  | `/(auth)/onboarding`                |
| **Access** | First launch only (before any auth) |
| **Status** | Phase 1 ✅                          |

**Layout**: Horizontal swipeable carousel with 3 slides + dot indicators + "Get Started" button on last slide.

| Slide | Icon         | Title            | Subtitle                            |
| ----- | ------------ | ---------------- | ----------------------------------- |
| 1     | Users group  | Welcome          | Register newcomers in seconds       |
| 2     | Check circle | Track Attendance | Know who's present at every service |
| 3     | Heart        | Pastoral Care    | Follow up on those who've been away |

**Data**: None. Pure UI.
**Navigation**: "Get Started" → Login screen. "Skip" link also available.
**Offline**: Fully offline. No network needed.

### 2. Login

|            |                       |
| ---------- | --------------------- |
| **Route**  | `/(auth)/login`       |
| **Access** | Unauthenticated users |
| **Status** | Phase 1 ✅            |

**Layout**: Two-step flow on a single screen.

**Step 1: Phone Entry**

- Country code picker (default +49 Germany)
- Phone number input (numeric keyboard)
- "Send Code" button
- Loading state during OTP delivery

**Step 2: OTP Verification**

- 6-digit code input (auto-advancing cells)
- "Verify" button
- "Resend Code" link (30s cooldown timer)
- Error state for wrong code

**Data reads**: None.
**Data writes**: `supabase.auth.signInWithOtp()`, then `supabase.auth.verifyOtp()`.
**Navigation**: On success → check if servant profile exists → Home tab (or show error if phone not in servants table).
**Offline**: Requires network. Show "No internet connection" message if offline.

---

## Tab Screens

### 3. Home (Dashboard)

|            |                                                  |
| ---------- | ------------------------------------------------ |
| **Route**  | `/(tabs)/home`                                   |
| **Access** | All authenticated users                          |
| **Status** | Phase 1 scaffold ✅, full implementation Phase 5 |

**Layout — Servant view**:

- Greeting: "Good morning, [Name]" (time-aware)
- Sync status badge (top-right)
- 3 summary cards:
  - **My Group**: "[N] members" → tap → People tab
  - **Pending Follow-ups**: "[N] pending" → tap → Follow-ups screen
  - **Recent Newcomers**: "[N] this month" → tap → People tab filtered
- Quick action buttons: "Quick Add" and "Check In" (large, prominent)

**Layout — Admin view** (extends servant view):

- Additional cards:
  - **Total Members**: count
  - **Attendance This Week**: percentage
  - **At Risk**: count of members flagged for absence
- "View Reports" link → Reports screen

**Data reads**:

- `supabase.rpc('get_my_group')` for member count
- `supabase.rpc('get_dashboard_stats')` for admin stats
- `follow_ups` table filtered by status=pending for count

**Data writes**: None.
**Navigation**: Cards link to relevant screens; quick actions link to Quick Add / Check-in.
**Offline**: Shows cached data. Sync badge shows pending status.

### 4. Check-in: Event List

|            |                                                  |
| ---------- | ------------------------------------------------ |
| **Route**  | `/(tabs)/checkin/index`                          |
| **Access** | All authenticated                                |
| **Status** | Phase 1 scaffold ✅, full implementation Phase 3 |

**Layout**:

- Header: "Check In" with sync status badge
- List of today's events from `cached_events` (filtered by date)
- Each event card shows:
  - Event title (e.g., "Sunday Liturgy")
  - Time (e.g., "9:00 – 12:00")
  - Attendance summary: "12/25 present" (if check-in started)
- Empty state: "No events today" with illustration
- Option to show events from past 3 days (expandable section)

**Data reads**: `cached_events` where `date` is today (or within 3-day window).
**Data writes**: None on this screen.
**Navigation**: Tap event → `[eventId]` screen.
**Offline**: Uses locally cached events. Show "Events may be outdated" if last fetch > 1 hour.

### 5. Check-in: Attendance Marking

|            |                             |
| ---------- | --------------------------- |
| **Route**  | `/(tabs)/checkin/[eventId]` |
| **Access** | All authenticated           |
| **Status** | Phase 3                     |

**Layout**:

- Header: Event title + date
- Search bar (filter displayed list by name)
- Toggle: "My Group" / "All Members"
- Member list, each row:
  - Name
  - AttendanceChip: unmarked (gray) / present (green) / absent (red)
  - Tap to toggle present ↔ absent
- Bottom bar: "Save" button with count ("Save (12 present)")
- Sync status indicator

**Data reads**:

- `supabase.rpc('get_attendance_for_event', { event_id, event_date })` — or local SQLite
- All persons (for "All Members" toggle)

**Data writes**:

- On save: write attendance records to local SQLite → sync_queue → Supabase
- Uses `bulk_upsert_attendance` RPC on sync

**Navigation**: Back → Event list. Save → Event list with success toast.
**Offline**: Full functionality. Writes to SQLite. Shows sync pending badge.

### 6. People: Member List

|            |                                                  |
| ---------- | ------------------------------------------------ |
| **Route**  | `/(tabs)/people/index`                           |
| **Access** | All authenticated                                |
| **Status** | Phase 1 scaffold ✅, full implementation Phase 2 |

**Layout**:

- Header: "People" with search icon
- Search bar (searches first name, last name, phone)
- Filter chips: All / My Group / New / Active / Inactive
- Member list, each row:
  - Full name
  - Region (if set)
  - Status badge (new/active/inactive)
  - Priority indicator (colored dot for high/medium/low/very_low)
  - Last attended date
- FAB (floating action button): "+" → shows Quick Add / Full Register options
- Empty state: "No members yet. Tap + to add someone."

**Data reads**: `persons` table (all for admin, filtered for servant's group).
**Data writes**: None on this screen.
**Navigation**:

- Tap member → `[personId]` profile
- FAB → Quick Add or Register
- Search is instant (local filter)

**Offline**: Uses local SQLite. Full functionality.

### 7. People: Quick Add

|            |                            |
| ---------- | -------------------------- |
| **Route**  | `/(tabs)/people/quick-add` |
| **Access** | All authenticated          |
| **Status** | Phase 2                    |

**Layout**: Friendly, welcoming form designed to be handed to the newcomer.

- Greeting text at top: "Welcome! Please enter your details." (adapts to selected language in real time)
- Language selector: EN / AR / DE (changes greeting and form labels immediately)
- Fields:
  - First Name (text input)
  - Last Name (text input)
  - Phone (phone input with country code picker, default +49)
  - Region (free text, optional, with placeholder "e.g., Sendling")
- Submit button: "Done" (large, friendly)
- No Priority, Comments, or Servant Assignment visible

**Data reads**: None.
**Data writes**: `INSERT persons` with `registration_type: 'quick_add'`, `assigned_servant_id: current_servant`, `registered_by: current_servant`.
**Validation** (Zod):

- first_name: required, min 1 char
- last_name: required, min 1 char
- phone: required, E.164 format, unique (show error if duplicate)
- region: optional

**Navigation**: On submit → Back to People list with success toast. Phone stays with servant.
**Offline**: Writes locally. Syncs later.

### 8. People: Full Registration

|            |                           |
| ---------- | ------------------------- |
| **Route**  | `/(tabs)/people/register` |
| **Access** | All authenticated         |
| **Status** | Phase 2                   |

**Layout**: Standard form for servant to fill in.

- All Quick Add fields, plus:
  - Priority: select picker (High / Medium / Low / Very Low)
  - Assigned Servant: select picker (list of all servants, pre-filled with current)
  - Comments: multiline text input ("Private — only you and admins can see this")
- Submit button: "Register"
- Can also be opened with a pre-filled `personId` to upgrade a Quick Add

**Data reads**: `servants` table for servant picker.
**Data writes**: `INSERT persons` with `registration_type: 'full'` (or `UPDATE` if upgrading).
**Validation**: Same as Quick Add + priority required.
**Navigation**: On submit → Person profile or People list.
**Offline**: Writes locally. Syncs later.

### 9. People: Member Profile

|            |                                    |
| ---------- | ---------------------------------- |
| **Route**  | `/(tabs)/people/[personId]`        |
| **Access** | All authenticated (comments gated) |
| **Status** | Phase 2                            |

**Layout**:

- Header: Full name + status badge
- **Info section**: Phone (tap to call), region, language, priority, registered at, registered by
- **Assigned servant** (with reassign button for admins)
- **Comments** (visible only if current user is assigned servant or admin)
- **Attendance history**: List of recent events with present/absent chips, dates
- **Follow-up history**: List of follow-ups with status badges
- **Actions**:
  - "Edit" → Full Registration form pre-filled
  - "Mark on break" → date picker for `paused_until`
  - "Create Follow-up" → manual follow-up
  - "Delete" (admin only) → confirmation dialog → cascade delete

**Data reads**: `persons` by ID, `attendance` by person_id, `follow_ups` by person_id.
**Data writes**: Updates to person, new follow-ups.
**Navigation**: Deep link target from push notifications.
**Offline**: Reads from local SQLite. Edits queue in sync_queue.

### 10. More: Menu Hub

|            |                      |
| ---------- | -------------------- |
| **Route**  | `/(tabs)/more/index` |
| **Access** | All authenticated    |
| **Status** | Phase 1 ✅           |

**Layout**: Simple menu list.

| Menu Item  | Icon          | Route      | Access     |
| ---------- | ------------- | ---------- | ---------- |
| Follow-ups | ClipboardText | follow-ups | All        |
| Reports    | ChartBar      | reports    | Admin only |
| Settings   | Gear          | settings   | All        |
| Logout     | SignOut       | — (action) | All        |

**Data reads**: Role check for admin-only items.
**Data writes**: Logout clears session.

### 11. More: Follow-ups List

|            |                           |
| ---------- | ------------------------- |
| **Route**  | `/(tabs)/more/follow-ups` |
| **Access** | All authenticated         |
| **Status** | Phase 4                   |

**Layout**:

- Filter tabs: Pending / Snoozed / Completed
- Each follow-up card:
  - Person name
  - Reason: "Missed 3 Sunday Liturgies" or "Manual"
  - Created date
  - Status badge
  - Snooze indicator (if snoozed, shows resume date)
- Sorted by urgency: highest priority persons first, then by created_at

**Data reads**: `follow_ups` table (servant: own only; admin: all).
**Data writes**: None on list.
**Navigation**: Tap → Follow-up detail.
**Offline**: Local SQLite.

### 12. More: Follow-up Detail

|            |                                |
| ---------- | ------------------------------ |
| **Route**  | `/(tabs)/more/follow-ups/[id]` |
| **Access** | Assigned servant or admin      |
| **Status** | Phase 4                        |

**Layout**:

- Person info header (name, phone — tap to call)
- Alert details: missed count, trigger event, dates missed
- Attendance history (last 8 events)
- **Action form**:
  - Action taken: Called / Texted / Visited / No Answer / Other (radio/select)
  - Notes: free text
  - Status: Mark Complete / Snooze (with date picker)
- "Mark on Break" button → sets `paused_until` on person

**Data reads**: `follow_ups` by ID, `persons` by person_id, `attendance` by person_id.
**Data writes**: `UPDATE follow_ups` (action, notes, status), `UPDATE persons` (paused_until).
**Navigation**: Deep link target from push notifications.
**Offline**: Reads local. Writes queue to sync.

### 13. More: Reports (Admin)

|            |                        |
| ---------- | ---------------------- |
| **Route**  | `/(tabs)/more/reports` |
| **Access** | Admin only             |
| **Status** | Phase 5                |

**Layout**:

- **Attendance Trend**: Line chart — weekly attendance over 12 weeks
  - Filter by event type (dropdown of counted event patterns)
- **At-Risk List**: Members currently flagged, grouped by servant
  - Tap member → profile
- **Newcomer Funnel**: Quick Adds → Full registrations → Still active after 4 weeks
- **Region Breakdown**: Table of regions with member count and attendance rate

**Data reads**:

- `supabase.rpc('get_weekly_attendance_trend')`
- `supabase.rpc('get_dashboard_stats')`
- `follow_ups` where status=pending and reason=absence_alert
- `persons` grouped by region

**Data writes**: None.
**Navigation**: Tap-through to member profiles.
**Offline**: Shows last cached data. "Data may be outdated" notice.

### 14. More: Settings

|            |                                                      |
| ---------- | ---------------------------------------------------- |
| **Route**  | `/(tabs)/more/settings`                              |
| **Access** | All (admin sees extra sections)                      |
| **Status** | Phase 2 (language), Phase 4 (alerts), Phase 6 (full) |

**Layout**:

- **Language**: EN / AR / DE selector (immediate switch, persists)
- **Notifications**: Toggle push notifications on/off
- **Account**: View own profile (name, phone, email, regions)

**Admin-only sections**:

- **Absence Alerts**:
  - Counted event patterns: multi-select from recent event titles
  - Default threshold: number input (default 3)
  - Per-priority thresholds: expandable section with number inputs per priority
  - Notify admin toggle
- **Manage Servants**: List servants, invite new (by phone/email)

**Data reads**: `alert_config`, `servants` table.
**Data writes**: `UPDATE alert_config`, `UPDATE servants` (own profile).
**Offline**: Language change works offline. Alert config changes queue for sync.

---

## Screen–Feature Matrix

| Screen             | F1: Register | F2: Attendance |  F3: Alerts   | F4: Reports |
| ------------------ | :----------: | :------------: | :-----------: | :---------: |
| Home               | Quick action |  Quick action  |  Badge count  |    Cards    |
| Event List         |              |  Read events   |               |             |
| Attendance Marking |              |  Mark present  |               |             |
| Member List        | Entry point  |                | Status badges |             |
| Quick Add          |  ★ Primary   |                |               |             |
| Full Registration  |  ★ Primary   |                |               |             |
| Member Profile     |  View/Edit   |    History     |  Follow-ups   |             |
| Follow-ups List    |              |                |   ★ Primary   |             |
| Follow-up Detail   |              |                |   ★ Primary   |             |
| Reports            |              |                | At-risk list  |  ★ Primary  |
| Settings           |              |                | Alert config  |             |

---

## Deep Linking

Push notifications deep link to specific screens:

| Notification Type  | Deep Link                              |
| ------------------ | -------------------------------------- |
| Absence Alert      | `/(tabs)/more/follow-ups/[followUpId]` |
| Welcome Back       | `/(tabs)/people/[personId]`            |
| Follow-up Reminder | `/(tabs)/more/follow-ups/[followUpId]` |
| New Assignment     | `/(tabs)/people/[personId]`            |
