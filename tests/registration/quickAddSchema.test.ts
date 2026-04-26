import { quickAddSchema } from '@/features/registration/schemas/quickAddSchema';

describe('quickAddSchema', () => {
  const valid = {
    first_name: 'Mina',
    last_name: 'Boutros',
    phone: '+491701234567',
    region: 'Schwabing',
    language: 'en' as const,
  };

  it('accepts a valid payload', () => {
    const result = quickAddSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+491701234567');
      expect(result.data.first_name).toBe('Mina');
    }
  });

  it('strips whitespace from the phone before validating', () => {
    const out = quickAddSchema.parse({ ...valid, phone: '+49 170 1234567' });
    expect(out.phone).toBe('+491701234567');
  });

  it('trims names', () => {
    const out = quickAddSchema.parse({
      ...valid,
      first_name: '  Mariam  ',
      last_name: '  Habib  ',
    });
    expect(out.first_name).toBe('Mariam');
    expect(out.last_name).toBe('Habib');
  });

  it('rejects empty first name', () => {
    const result = quickAddSchema.safeParse({ ...valid, first_name: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects empty last name', () => {
    const result = quickAddSchema.safeParse({ ...valid, last_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects phone without + prefix', () => {
    const result = quickAddSchema.safeParse({ ...valid, phone: '01701234567' });
    expect(result.success).toBe(false);
  });

  it('rejects phone with letters', () => {
    const result = quickAddSchema.safeParse({ ...valid, phone: '+49abc1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects too-short phone numbers', () => {
    const result = quickAddSchema.safeParse({ ...valid, phone: '+491' });
    expect(result.success).toBe(false);
  });

  it('rejects too-long phone numbers', () => {
    const result = quickAddSchema.safeParse({ ...valid, phone: '+491234567890123456' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown language enum', () => {
    const result = quickAddSchema.safeParse({ ...valid, language: 'fr' });
    expect(result.success).toBe(false);
  });

  it('treats omitted region as undefined', () => {
    const out = quickAddSchema.parse({ ...valid, region: undefined });
    expect(out.region).toBeUndefined();
  });

  it('treats empty-string region as undefined', () => {
    const out = quickAddSchema.parse({ ...valid, region: '' });
    expect(out.region).toBeUndefined();
  });
});
