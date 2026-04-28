/**
 * Push-payload localization. The Edge Function can't reach into
 * `src/i18n/locales/*.json` (Deno bundle, isolation) so we keep a
 * tight, hand-mirrored copy of just the four `notifications.types.*`
 * subtrees here. If the app's source bundle changes, this table must
 * follow — the symmetry is enforced by `translate.test.ts`.
 *
 * Falls back to `en` when the requested language has no entry, matching
 * the i18n posture in `src/i18n/index.ts`.
 */

export type NotificationLanguage = 'en' | 'ar' | 'de';
export type NotificationKind = 'absence_alert' | 'welcome_back' | 'reassignment' | 'system';

interface TitleBody {
  title: string;
  body: string;
}

type TypeBundle = Record<NotificationKind, TitleBody>;

const BUNDLES: Record<NotificationLanguage, TypeBundle> = {
  en: {
    absence_alert: {
      title: 'Absence alert: {{personName}}',
      body: '{{consecutiveMisses}} consecutive missed events. Last: {{lastEventTitle}}.',
    },
    welcome_back: {
      title: 'Welcome back: {{personName}}',
      body: 'Attended {{eventTitle}}.',
    },
    reassignment: {
      title: 'Reassignment',
      body: 'A member has been reassigned to you.',
    },
    system: {
      title: 'Notification',
      body: 'You have a new notification.',
    },
  },
  de: {
    absence_alert: {
      title: 'Abwesenheits-Hinweis: {{personName}}',
      body: '{{consecutiveMisses}} Termine in Folge versäumt. Zuletzt: {{lastEventTitle}}.',
    },
    welcome_back: {
      title: 'Willkommen zurück: {{personName}}',
      body: 'War bei {{eventTitle}}.',
    },
    reassignment: {
      title: 'Neuzuweisung',
      body: 'Ein Mitglied wurde dir neu zugewiesen.',
    },
    system: {
      title: 'Benachrichtigung',
      body: 'Du hast eine neue Benachrichtigung.',
    },
  },
  ar: {
    absence_alert: {
      title: 'تنبيه غياب: {{personName}}',
      body: '{{consecutiveMisses}} غيابات متتالية. آخرها: {{lastEventTitle}}.',
    },
    welcome_back: {
      title: 'أهلاً بعودة {{personName}}',
      body: 'حضر {{eventTitle}}.',
    },
    reassignment: {
      title: 'إعادة تعيين',
      body: 'تم تعيين عضو إليك.',
    },
    system: {
      title: 'إشعار',
      body: 'لديك إشعار جديد.',
    },
  },
};

/**
 * Pick the localized title/body pair for the given (kind, language)
 * pair. Unknown languages fall through to `en`. The `system` body has
 * a special case: when `payload.message` is present we return that
 * verbatim (system notifications carry their own copy).
 */
export function formatPushTitleBody(
  kind: NotificationKind,
  payload: Record<string, unknown>,
  language: string | null | undefined,
): { title: string; body: string } {
  const lang: NotificationLanguage = isSupportedLanguage(language) ? language : 'en';
  const bundle = BUNDLES[lang] ?? BUNDLES.en;
  const tpl = bundle[kind] ?? bundle.system;

  let body = tpl.body;
  if (
    kind === 'system' &&
    typeof payload.message === 'string' &&
    payload.message.trim().length > 0
  ) {
    body = payload.message;
  } else {
    body = interpolate(body, payload);
  }
  const title = interpolate(tpl.title, payload);
  return { title, body };
}

function isSupportedLanguage(value: unknown): value is NotificationLanguage {
  return value === 'en' || value === 'ar' || value === 'de';
}

/**
 * Tiny Mustache-style interpolation matching i18next's default
 * placeholders (`{{ key }}`). Missing keys render as the placeholder
 * (mirroring i18next's "missing key" behavior in dev).
 */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

// Exported for tests only.
export const __TEST_BUNDLES__ = BUNDLES;
