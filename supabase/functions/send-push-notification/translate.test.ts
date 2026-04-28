import { assert, assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';

import { __TEST_BUNDLES__, formatPushTitleBody } from './translate.ts';

Deno.test('renders Arabic absence_alert', () => {
  const out = formatPushTitleBody(
    'absence_alert',
    { personName: 'مينا', consecutiveMisses: 3, lastEventTitle: 'Lobpreis' },
    'ar',
  );
  assertEquals(out.title, 'تنبيه غياب: مينا');
  assertEquals(out.body, '3 غيابات متتالية. آخرها: Lobpreis.');
});

Deno.test('renders German welcome_back', () => {
  const out = formatPushTitleBody(
    'welcome_back',
    { personName: 'Anna', eventTitle: 'Gebetsabend' },
    'de',
  );
  assertEquals(out.title, 'Willkommen zurück: Anna');
  assertEquals(out.body, 'War bei Gebetsabend.');
});

Deno.test('falls back to en for unknown language code', () => {
  const out = formatPushTitleBody(
    'absence_alert',
    { personName: 'John', consecutiveMisses: 2, lastEventTitle: 'Liturgy' },
    'fr', // unsupported
  );
  assertEquals(out.title, 'Absence alert: John');
  assertEquals(out.body, '2 consecutive missed events. Last: Liturgy.');
});

Deno.test('falls back to en when language is null', () => {
  const out = formatPushTitleBody('reassignment', { person_id: '123' }, null);
  assertEquals(out.title, 'Reassignment');
  assertEquals(out.body, 'A member has been reassigned to you.');
});

Deno.test('system uses payload.message verbatim', () => {
  const out = formatPushTitleBody('system', { message: 'Custom maintenance notice' }, 'en');
  assertEquals(out.body, 'Custom maintenance notice');
});

Deno.test('system without payload.message falls back to localized default', () => {
  const out = formatPushTitleBody('system', {}, 'de');
  assertEquals(out.title, 'Benachrichtigung');
  assertEquals(out.body, 'Du hast eine neue Benachrichtigung.');
});

Deno.test('placeholder remains visible when payload key is missing', () => {
  const out = formatPushTitleBody('absence_alert', {}, 'en');
  assert(out.title.includes('{{personName}}'));
  assert(out.body.includes('{{consecutiveMisses}}'));
});

Deno.test('all three language bundles cover all four kinds', () => {
  const langs: Array<'en' | 'de' | 'ar'> = ['en', 'de', 'ar'];
  const kinds = ['absence_alert', 'welcome_back', 'reassignment', 'system'] as const;
  for (const lang of langs) {
    for (const kind of kinds) {
      const entry = __TEST_BUNDLES__[lang][kind];
      assert(entry.title.length > 0, `${lang}.${kind}.title missing`);
      assert(entry.body.length > 0, `${lang}.${kind}.body missing`);
    }
  }
});
