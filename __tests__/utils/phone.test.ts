import { normalizePhone, formatPhoneDisplay, isValidE164 } from '../../src/utils/phone';

describe('normalizePhone', () => {
  it('passes through an already-E.164 number', () => {
    expect(normalizePhone('+491511234567')).toBe('+491511234567');
  });

  it('converts international prefix 00 to +', () => {
    expect(normalizePhone('00491511234567')).toBe('+491511234567');
  });

  it('prepends default country code for local German number (leading 0)', () => {
    expect(normalizePhone('01511234567')).toBe('+491511234567');
  });

  it('prepends default country code for bare number', () => {
    expect(normalizePhone('1511234567')).toBe('+491511234567');
  });

  it('strips spaces and hyphens', () => {
    expect(normalizePhone('+49 151 1234567')).toBe('+491511234567');
    expect(normalizePhone('+49-151-1234567')).toBe('+491511234567');
  });

  it('respects a custom country code', () => {
    expect(normalizePhone('01234567890', '+20')).toBe('+201234567890');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats a German E.164 number', () => {
    expect(formatPhoneDisplay('+491511234567')).toBe('+49 151 1234567');
  });

  it('formats an Egyptian E.164 number', () => {
    expect(formatPhoneDisplay('+201234567890')).toBe('+20 123 4567890');
  });

  it('returns the input unchanged if not E.164', () => {
    expect(formatPhoneDisplay('notaphone')).toBe('notaphone');
  });

  it('handles generic country codes', () => {
    const result = formatPhoneDisplay('+12025551234');
    expect(result).toBe('+1 202 5551234');
  });
});

describe('isValidE164', () => {
  it('returns true for valid E.164 numbers', () => {
    expect(isValidE164('+491511234567')).toBe(true);
    expect(isValidE164('+20123456789')).toBe(true);
    expect(isValidE164('+12025551234')).toBe(true);
  });

  it('returns false for numbers without + prefix', () => {
    expect(isValidE164('491511234567')).toBe(false);
    expect(isValidE164('00491511234567')).toBe(false);
  });

  it('returns false for numbers that are too short', () => {
    expect(isValidE164('+4912345')).toBe(false); // only 7 digits
  });

  it('returns false for numbers that are too long', () => {
    expect(isValidE164('+4912345678901234567')).toBe(false); // 17 digits
  });

  it('returns false for empty string', () => {
    expect(isValidE164('')).toBe(false);
  });

  it('returns false if starts with +0', () => {
    expect(isValidE164('+01511234567')).toBe(false);
  });
});
