const DEFAULT_COUNTRY_CODE = '+49';

/**
 * Normalize a user-entered phone number to E.164 format.
 * Examples:
 *   "01511234567"     -> "+491511234567"   (German local)
 *   "+491511234567"   -> "+491511234567"   (already E.164)
 *   "00491511234567"  -> "+491511234567"   (international prefix)
 */
export function normalizePhone(
  input: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string {
  const stripped = input.replace(/[\s\-().]/g, '');

  if (stripped.startsWith('+')) {
    return stripped;
  }
  if (stripped.startsWith('00')) {
    return '+' + stripped.slice(2);
  }
  if (stripped.startsWith('0')) {
    return defaultCountryCode + stripped.slice(1);
  }
  // Assume bare number needs country code prepended
  return defaultCountryCode + stripped;
}

/**
 * Format an E.164 phone number for display.
 * "+491511234567" -> "+49 151 1234567"
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164 || !e164.startsWith('+')) return e164;

  // German numbers: +49 XXX XXXXXXX
  if (e164.startsWith('+49')) {
    const local = e164.slice(3);
    if (local.length >= 6) {
      return `+49 ${local.slice(0, 3)} ${local.slice(3)}`.trim();
    }
    return `+49 ${local}`;
  }

  // Egyptian numbers: +20 XXX XXXXXXX
  if (e164.startsWith('+20')) {
    const local = e164.slice(3);
    return `+20 ${local.slice(0, 3)} ${local.slice(3)}`.trim();
  }

  // Generic: split off country code (2-3 digits) + rest
  const match = e164.match(/^(\+\d{1,3})(\d{3})(\d+)$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }

  return e164;
}

/** Returns true if the string is a valid E.164 phone number */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
