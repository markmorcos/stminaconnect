/**
 * Key-parity guard: every key present in EN must also exist in AR
 * and DE with a non-empty string value. Catches the easy-to-miss
 * "added an EN string but forgot the translations" bug at CI time.
 */
import ar from '@/i18n/locales/ar.json';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';

type Tree = { [key: string]: string | Tree };

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

const enKeys = Object.keys(flatten(en as Tree));

describe('translation key parity', () => {
  it.each([
    ['ar', ar],
    ['de', de],
  ] as const)('%s contains every EN key with a non-empty string', (_lang, file) => {
    const flat = flatten(file as Tree);
    const missing: string[] = [];
    const empty: string[] = [];
    for (const key of enKeys) {
      const value = flat[key];
      if (value === undefined) missing.push(key);
      else if (typeof value !== 'string' || value.trim() === '') empty.push(key);
    }
    expect({ missing, empty }).toEqual({ missing: [], empty: [] });
  });
});
