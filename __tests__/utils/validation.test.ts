import { quickAddSchema, fullRegistrationSchema } from '../../src/utils/validation';

describe('quickAddSchema', () => {
  const validBase = {
    first_name: 'Mina',
    last_name: 'Ibrahim',
    phone: '+491511234567',
    language: 'de' as const,
  };

  it('accepts a valid quick-add payload', () => {
    const result = quickAddSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('accepts optional region', () => {
    const result = quickAddSchema.safeParse({ ...validBase, region: 'Sendling' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.region).toBe('Sendling');
  });

  it('transforms empty region to null', () => {
    const result = quickAddSchema.safeParse({ ...validBase, region: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.region).toBeNull();
  });

  it('rejects missing first_name', () => {
    const result = quickAddSchema.safeParse({ ...validBase, first_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing last_name', () => {
    const result = quickAddSchema.safeParse({ ...validBase, last_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone — no plus prefix', () => {
    const result = quickAddSchema.safeParse({ ...validBase, phone: '00491511234567' });
    expect(result.success).toBe(false);
  });

  it('rejects phone too short', () => {
    const result = quickAddSchema.safeParse({ ...validBase, phone: '+491234' });
    expect(result.success).toBe(false);
  });

  it('accepts phone with exactly 8 digits after country code', () => {
    const result = quickAddSchema.safeParse({ ...validBase, phone: '+4912345678' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid language', () => {
    const result = quickAddSchema.safeParse({ ...validBase, language: 'fr' });
    expect(result.success).toBe(false);
  });

  it('accepts all three languages', () => {
    for (const lang of ['en', 'ar', 'de'] as const) {
      const result = quickAddSchema.safeParse({ ...validBase, language: lang });
      expect(result.success).toBe(true);
    }
  });
});

describe('fullRegistrationSchema', () => {
  const validFull = {
    first_name: 'Mina',
    last_name: 'Ibrahim',
    phone: '+491511234567',
    language: 'de' as const,
    priority: 'high' as const,
    assigned_servant_id: '00000000-0000-0000-0000-000000000001',
    comments: 'Speaks Arabic',
  };

  it('accepts a valid full registration payload', () => {
    const result = fullRegistrationSchema.safeParse(validFull);
    expect(result.success).toBe(true);
  });

  it('accepts null priority', () => {
    const result = fullRegistrationSchema.safeParse({ ...validFull, priority: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid assigned_servant_id (not a UUID)', () => {
    const result = fullRegistrationSchema.safeParse({
      ...validFull,
      assigned_servant_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('transforms empty comments to null', () => {
    const result = fullRegistrationSchema.safeParse({ ...validFull, comments: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.comments).toBeNull();
  });

  it('rejects comments longer than 500 chars', () => {
    const result = fullRegistrationSchema.safeParse({
      ...validFull,
      comments: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority value', () => {
    const result = fullRegistrationSchema.safeParse({
      ...validFull,
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid priority values', () => {
    for (const p of ['high', 'medium', 'low', 'very_low'] as const) {
      const result = fullRegistrationSchema.safeParse({ ...validFull, priority: p });
      expect(result.success).toBe(true);
    }
  });
});
