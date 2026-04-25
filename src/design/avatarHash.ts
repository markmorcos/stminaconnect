/**
 * FNV-1a 32-bit hash. Fast, non-cryptographic, deterministic — used to
 * pick a consistent avatar palette index for a given person id.
 */

const FNV_OFFSET_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

export function fnv1a(input: string): number {
  let hash = FNV_OFFSET_32;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit multiply with overflow truncation
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

export function avatarColorIndex(id: string, paletteSize: number): number {
  return fnv1a(id) % paletteSize;
}

/**
 * First grapheme of first + last name, Unicode-aware. Falls back to
 * just the first if last is missing.
 */
export function avatarInitials(firstName: string, lastName?: string): string {
  const first = firstGrapheme(firstName);
  const last = lastName ? firstGrapheme(lastName) : '';
  return (first + last).toUpperCase();
}

function firstGrapheme(input: string): string {
  if (!input) return '';
  // Intl.Segmenter is available in modern RN (Hermes ICU build)
  type SegmenterCtor = new (
    locale?: string,
    options?: { granularity: 'grapheme' | 'word' | 'sentence' },
  ) => { segment: (text: string) => Iterable<{ segment: string }> };
  const Segmenter = (globalThis as unknown as { Intl: { Segmenter?: SegmenterCtor } }).Intl
    ?.Segmenter;
  if (typeof Segmenter === 'function') {
    const seg = new Segmenter(undefined, { granularity: 'grapheme' });
    for (const part of seg.segment(input)) {
      return part.segment;
    }
  }
  return Array.from(input)[0] ?? '';
}
