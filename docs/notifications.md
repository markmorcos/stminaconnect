# Push Notifications

## Overview

Push notifications are delivered via the **Expo Push API**, which routes to APNs (iOS) and FCM (Android). The backend sends notifications from Edge Functions using the service role.

## Notification Types

### 1. Absence Alert

**Trigger**: Member crosses consecutive miss threshold for counted events.

**Recipient**: Assigned servant. Optionally admin (if `alert_config.notify_admin = true`).

**Title** (localized to recipient's `preferred_language`):

- EN: "Absence Alert"
- AR: "تنبيه غياب"
- DE: "Abwesenheitswarnung"

**Body** (localized):

- EN: "{{personName}} has missed {{count}} consecutive {{eventTitle}}"
- AR: "{{personName}} غاب عن {{count}} {{eventTitle}} متتالية"
- DE: "{{personName}} hat {{count}} aufeinanderfolgende {{eventTitle}} verpasst"

**Payload**:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Absence Alert",
  "body": "Mina Ibrahim has missed 3 consecutive Sunday Liturgies",
  "data": {
    "type": "absence_alert",
    "follow_up_id": "uuid",
    "person_id": "uuid"
  },
  "sound": "default",
  "priority": "high",
  "channelId": "absence-alerts"
}
```

**Deep link**: `/(tabs)/more/follow-ups/[followUpId]`

---

### 2. Welcome Back

**Trigger**: A previously-flagged member (with a pending absence follow-up) attends a counted event.

**Recipient**: Assigned servant.

**Title**:

- EN: "Welcome Back!"
- AR: "!مرحباً بالعودة"
- DE: "Willkommen zurück!"

**Body**:

- EN: "{{personName}} attended {{eventTitle}} today after {{weeks}} weeks away"
- AR: "{{personName}} حضر {{eventTitle}} اليوم بعد {{weeks}} أسابيع غياب"
- DE: "{{personName}} hat heute {{eventTitle}} besucht nach {{weeks}} Wochen Abwesenheit"

**Payload**:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Welcome Back!",
  "body": "Mina Ibrahim attended Sunday Liturgy today after 4 weeks away",
  "data": {
    "type": "welcome_back",
    "person_id": "uuid"
  },
  "sound": "default",
  "priority": "default",
  "channelId": "general"
}
```

**Deep link**: `/(tabs)/people/[personId]`

---

### 3. Follow-up Reminder

**Trigger**: A snoozed follow-up reaches its `snoozed_until` date. Checked daily by `check-absences` Edge Function.

**Recipient**: Assigned servant.

**Title**:

- EN: "Follow-up Reminder"
- AR: "تذكير بالمتابعة"
- DE: "Nachverfolgungserinnerung"

**Body**:

- EN: "Time to follow up with {{personName}}"
- AR: "حان وقت المتابعة مع {{personName}}"
- DE: "Zeit für die Nachverfolgung von {{personName}}"

**Payload**:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "Follow-up Reminder",
  "body": "Time to follow up with Mina Ibrahim",
  "data": {
    "type": "follow_up_reminder",
    "follow_up_id": "uuid",
    "person_id": "uuid"
  },
  "sound": "default",
  "priority": "default",
  "channelId": "follow-ups"
}
```

**Deep link**: `/(tabs)/more/follow-ups/[followUpId]`

---

### 4. New Assignment

**Trigger**: Admin reassigns a member to a different servant.

**Recipient**: The newly assigned servant.

**Title**:

- EN: "New Assignment"
- AR: "تعيين جديد"
- DE: "Neue Zuweisung"

**Body**:

- EN: "{{personName}} has been assigned to you"
- AR: "تم تعيين {{personName}} لك"
- DE: "{{personName}} wurde Ihnen zugewiesen"

**Payload**:

```json
{
  "to": "ExponentPushToken[...]",
  "title": "New Assignment",
  "body": "Mina Ibrahim has been assigned to you",
  "data": {
    "type": "new_assignment",
    "person_id": "uuid"
  },
  "sound": "default",
  "priority": "default",
  "channelId": "general"
}
```

**Deep link**: `/(tabs)/people/[personId]`

---

## Notification Channels (Android)

| Channel ID       | Name                | Importance | Description                        |
| ---------------- | ------------------- | ---------- | ---------------------------------- |
| `absence-alerts` | Absence Alerts      | High       | Alerts when members miss threshold |
| `follow-ups`     | Follow-up Reminders | Default    | Snoozed follow-up reminders        |
| `general`        | General             | Default    | Welcome backs, new assignments     |

Created on app startup via `expo-notifications`:

```typescript
Notifications.setNotificationChannelAsync("absence-alerts", {
  name: "Absence Alerts",
  importance: Notifications.AndroidImportance.HIGH,
  sound: "default",
});
```

## Push Token Registration

1. On app launch (after auth), request permission: `Notifications.requestPermissionsAsync()`
2. Get token: `Notifications.getExpoPushTokenAsync({ projectId })`
3. Store in `servants` table: `UPDATE servants SET push_token = ? WHERE id = auth.uid()`
4. Refresh token on each app launch (tokens can change)

## Deep Linking

Notifications carry a `data` payload with `type` and entity IDs. On notification tap:

```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const { type, person_id, follow_up_id } = response.notification.request.content.data;
  switch (type) {
    case "absence_alert":
    case "follow_up_reminder":
      router.push(`/(tabs)/more/follow-ups/${follow_up_id}`);
      break;
    case "welcome_back":
    case "new_assignment":
      router.push(`/(tabs)/people/${person_id}`);
      break;
  }
});
```

## Notification Preferences

Servants can control notifications via Settings:

- **Master toggle**: Enable/disable all push notifications
- **Per-channel** (Android only): Users can control via system notification settings
- No per-type toggle in v1 (keep it simple)

When push is disabled:

- Notifications still create in-app follow-up records
- Badge count shows on Follow-ups tab
- Servant sees pending items when they open the app

## Fallback Behavior

| Scenario            | Fallback                                                              |
| ------------------- | --------------------------------------------------------------------- |
| No push token       | Skip push, create in-app follow-up only                               |
| Push delivery fails | Retry once after 5 minutes. If still fails, in-app only.              |
| App in foreground   | Show in-app alert/banner (not system notification)                    |
| App killed          | System notification (handled by OS)                                   |
| Token expired       | Next app launch refreshes token. Missed notifications visible in-app. |

## Edge Function: send-notification

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { servant_id, title, body, data } = await req.json();

  // Look up push token
  const { data: servant } = await supabase
    .from("servants")
    .select("push_token, preferred_language")
    .eq("id", servant_id)
    .single();

  if (!servant?.push_token) {
    return new Response(JSON.stringify({ sent: false, reason: "no_push_token" }));
  }

  // Send via Expo Push API
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("EXPO_PUSH_ACCESS_TOKEN")}`,
    },
    body: JSON.stringify({
      to: servant.push_token,
      title,
      body,
      data,
      sound: "default",
      priority: data.type === "absence_alert" ? "high" : "default",
      channelId:
        data.type === "absence_alert"
          ? "absence-alerts"
          : data.type === "follow_up_reminder"
            ? "follow-ups"
            : "general",
    }),
  });

  const result = await response.json();
  return new Response(JSON.stringify({ sent: true, ticket: result.data }));
});
```

## Trigger Points Summary

| Trigger                   | Source                            | Notification Types                           |
| ------------------------- | --------------------------------- | -------------------------------------------- |
| Attendance saved + synced | `check-absences` Edge Function    | Absence Alert, Welcome Back                  |
| Daily cron (morning)      | `check-absences` Edge Function    | Follow-up Reminder (snoozed items due today) |
| Admin reassigns member    | Client-side (after PATCH persons) | New Assignment                               |
