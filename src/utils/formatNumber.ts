/**
 * Locale-aware number, percentage, and date formatting via Intl.
 *
 * Designed to be called from any feature screen — pass the active i18n
 * language directly so the helper has no dependency on the React tree.
 * Components typically grab `i18n.language` from `useTranslation()` and
 * pass it through.
 *
 * Arabic (`ar`) renders with Arabic-Indic digits per Intl's defaults;
 * English and German use Latin digits.
 *
 * Resolved Intl objects are cached because Intl construction is
 * surprisingly hot when called inside `renderItem` of a long list.
 */

type SupportedLanguage = 'en' | 'ar' | 'de';

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function getNumberFormatter(
  language: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${language}|${JSON.stringify(options)}`;
  let fmt = numberCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(language, options);
    numberCache.set(key, fmt);
  }
  return fmt;
}

function getDateFormatter(
  language: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${language}|${JSON.stringify(options)}`;
  let fmt = dateCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(language, options);
    dateCache.set(key, fmt);
  }
  return fmt;
}

export function formatNumber(
  value: number,
  language: SupportedLanguage | string,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return '—';
  return getNumberFormatter(language, options).format(value);
}

/**
 * Formats a 0..1 fraction as a percentage in the active locale (e.g.
 * 0.42 → "42 %" in `de`, "42%" in `en`, "٤٢٪" in `ar`). Defaults to
 * zero fraction digits, matching dashboard funnel rendering.
 */
export function formatPercent(
  fraction: number,
  language: SupportedLanguage | string,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(fraction)) return '—';
  return getNumberFormatter(language, {
    style: 'percent',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    ...options,
  }).format(fraction);
}

export function formatDate(
  iso: string | Date,
  language: SupportedLanguage | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return getDateFormatter(language, options).format(date);
}

/**
 * Short day+month label for chart tick marks (e.g. "Mar 15"). Locale-
 * aware — `de` produces "15. März", `ar` uses Arabic month + digits.
 */
export function formatDateShort(iso: string | Date, language: string): string {
  return formatDate(iso, language, { day: '2-digit', month: 'short' });
}
