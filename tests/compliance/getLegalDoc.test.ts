/**
 * Unit tests for the getLegalDoc helper. Bundled-only — no live fetch.
 */
import { CURRENT_LEGAL_VERSIONS, getLegalDoc } from '@/services/legal/getLegalDoc';

describe('getLegalDoc', () => {
  it('returns the bundled English privacy doc with the version header parsed', () => {
    const doc = getLegalDoc('privacy', 'en');
    expect(doc.kind).toBe('privacy');
    expect(doc.lang).toBe('en');
    expect(doc.version).toBe(CURRENT_LEGAL_VERSIONS.privacy);
    expect(doc.body.length).toBeGreaterThan(50);
  });

  it('returns the bundled Arabic privacy doc', () => {
    const doc = getLegalDoc('privacy', 'ar');
    expect(doc.body).toContain('سياسة الخصوصية');
  });

  it('returns the bundled German privacy doc', () => {
    const doc = getLegalDoc('privacy', 'de');
    expect(doc.body).toContain('Datenschutz');
  });

  it('returns the bundled English terms doc', () => {
    const doc = getLegalDoc('terms', 'en');
    expect(doc.kind).toBe('terms');
    expect(doc.version).toBe(CURRENT_LEGAL_VERSIONS.terms);
  });
});
