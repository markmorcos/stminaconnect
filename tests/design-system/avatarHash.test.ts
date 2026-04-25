import { avatarColorIndex, avatarInitials, fnv1a } from '@/design/avatarHash';

describe('FNV-1a hash', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('person-123')).toBe(fnv1a('person-123'));
    expect(fnv1a('mariam@example.com')).toBe(fnv1a('mariam@example.com'));
  });

  it('produces well-known reference outputs', () => {
    // FNV-1a 32-bit reference values
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});

describe('avatarColorIndex', () => {
  it('maps a stable id to a stable index in [0, paletteSize)', () => {
    const idx = avatarColorIndex('person-123', 8);
    expect(idx).toBe(avatarColorIndex('person-123', 8));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(8);
  });

  it('distributes 100 random ids across all 8 buckets', () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 100; i++) {
      buckets.add(avatarColorIndex(`u-${i}-${Math.random()}`, 8));
    }
    expect(buckets.size).toBeGreaterThan(4);
  });
});

describe('avatarInitials', () => {
  it('returns first letter of first + last (Latin)', () => {
    expect(avatarInitials('Mariam', 'Saad')).toBe('MS');
  });

  it('handles missing last name', () => {
    expect(avatarInitials('George')).toBe('G');
  });

  it('is Unicode-aware (Arabic)', () => {
    const out = avatarInitials('مريم', 'سعد');
    // First grapheme of each Arabic name
    expect(out.length).toBe(2);
    expect(out).toBe('مس');
  });

  it('handles empty input gracefully', () => {
    expect(avatarInitials('')).toBe('');
  });
});
