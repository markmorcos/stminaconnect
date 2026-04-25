/**
 * Plural-form parity scaffold. i18next's plural keys take CLDR
 * suffixes (`_one`, `_other`, etc.). For any base key with a plural
 * variant in EN, every other locale MUST declare the same set of
 * variants — Arabic in particular requires up to six forms (`_zero`,
 * `_one`, `_two`, `_few`, `_many`, `_other`).
 *
 * No plural keys exist yet; this test runs as a no-op until they do,
 * at which point it'll fail loudly if any locale is short a form.
 */
import ar from '@/i18n/locales/ar.json';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';

type Tree = { [key: string]: string | Tree };

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'] as const;

function flatten(obj: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out[path] = v;
    } else {
      Object.assign(out, flatten(v, path));
    }
  }
  return out;
}

function pluralBaseAndSuffix(key: string): { base: string; suffix: string } | null {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return { base: key.slice(0, -suffix.length), suffix };
    }
  }
  return null;
}

function pluralVariantsByBase(flat: Record<string, string>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const key of Object.keys(flat)) {
    const parsed = pluralBaseAndSuffix(key);
    if (!parsed) continue;
    const set = map.get(parsed.base) ?? new Set<string>();
    set.add(parsed.suffix);
    map.set(parsed.base, set);
  }
  return map;
}

const enPlurals = pluralVariantsByBase(flatten(en as Tree));

describe('pluralization parity', () => {
  it.each([
    ['ar', ar],
    ['de', de],
  ] as const)('%s declares every plural variant present in EN', (_lang, file) => {
    const localePlurals = pluralVariantsByBase(flatten(file as Tree));
    const missing: { base: string; suffix: string }[] = [];
    for (const [base, suffixes] of enPlurals) {
      const got = localePlurals.get(base) ?? new Set<string>();
      for (const suffix of suffixes) {
        if (!got.has(suffix)) missing.push({ base, suffix });
      }
    }
    expect(missing).toEqual([]);
  });

  it('runs even when no plural keys exist yet', () => {
    expect(enPlurals.size).toBeGreaterThanOrEqual(0);
  });
});
