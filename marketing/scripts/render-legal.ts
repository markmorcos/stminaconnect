// marketing/scripts/render-legal.ts
//
// Renders the canonical legal markdown under `docs/legal/` into static
// HTML pages under `marketing/public/{,ar/,de/}{privacy,terms}/index.html`,
// wrapped in `marketing/templates/legal.html`.
//
// The Helm-deployed marketing site uses `context: marketing` (Docker
// build cannot see anything outside `marketing/`), so we pre-render
// here, commit the resulting HTML files, and the Dockerfile just copies
// `public/` into nginx.
//
// Run from the repo root whenever any file under `docs/legal/` changes:
//
//   deno task render-legal     # via marketing/deno.jsonc
//   # or directly
//   deno run --allow-read --allow-write marketing/scripts/render-legal.ts
//
// Then `git add marketing/public && git commit`. The deploy workflow
// triggers on changes under `marketing/**`, so committing the rendered
// HTML kicks off a redeploy automatically.

import { marked } from 'npm:marked@14';

const here = new URL('.', import.meta.url).pathname;
const root = new URL('../../', import.meta.url).pathname;
const legalDir = `${root}docs/legal`;
const outDir = `${root}marketing/public`;
const templatePath = `${root}marketing/templates/legal.html`;

interface Page {
  src: string;
  outPath: string;
  kind: 'privacy' | 'terms';
  title: string;
  lang: 'en' | 'ar' | 'de';
  dir: 'ltr' | 'rtl';
  prefix: string; // "" for EN, "/ar" or "/de" for the localized variants
  home: string; // "/" for EN, "/ar/" or "/de/" for the localized landing
  privacyLabel: string; // localized footer label
  termsLabel: string;
}

const pages: Page[] = [
  {
    src: 'privacy.en.md',
    outPath: 'privacy/index.html',
    kind: 'privacy',
    title: 'Privacy Policy',
    lang: 'en',
    dir: 'ltr',
    prefix: '',
    home: '/',
    privacyLabel: 'Privacy',
    termsLabel: 'Terms',
  },
  {
    src: 'terms.en.md',
    outPath: 'terms/index.html',
    kind: 'terms',
    title: 'Terms of Service',
    lang: 'en',
    dir: 'ltr',
    prefix: '',
    home: '/',
    privacyLabel: 'Privacy',
    termsLabel: 'Terms',
  },
  {
    src: 'privacy.ar.md',
    outPath: 'ar/privacy/index.html',
    kind: 'privacy',
    title: 'سياسة الخصوصيّة',
    lang: 'ar',
    dir: 'rtl',
    prefix: '/ar',
    home: '/ar/',
    privacyLabel: 'الخصوصيّة',
    termsLabel: 'الشروط',
  },
  {
    src: 'terms.ar.md',
    outPath: 'ar/terms/index.html',
    kind: 'terms',
    title: 'الشروط والأحكام',
    lang: 'ar',
    dir: 'rtl',
    prefix: '/ar',
    home: '/ar/',
    privacyLabel: 'الخصوصيّة',
    termsLabel: 'الشروط',
  },
  {
    src: 'privacy.de.md',
    outPath: 'de/privacy/index.html',
    kind: 'privacy',
    title: 'Datenschutzerklärung',
    lang: 'de',
    dir: 'ltr',
    prefix: '/de',
    home: '/de/',
    privacyLabel: 'Datenschutz',
    termsLabel: 'Nutzungsbedingungen',
  },
  {
    src: 'terms.de.md',
    outPath: 'de/terms/index.html',
    kind: 'terms',
    title: 'Nutzungsbedingungen',
    lang: 'de',
    dir: 'ltr',
    prefix: '/de',
    home: '/de/',
    privacyLabel: 'Datenschutz',
    termsLabel: 'Nutzungsbedingungen',
  },
];

const template = await Deno.readTextFile(templatePath);

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

for (const page of pages) {
  const md = await Deno.readTextFile(`${legalDir}/${page.src}`);
  const body = await marked.parse(md, { async: true });

  const html = template
    .replaceAll('$title$', escapeHtml(page.title))
    .replaceAll('$lang$', page.lang)
    .replaceAll('$dir$', page.dir)
    .replaceAll('$kind$', page.kind)
    .replaceAll('$prefix$', page.prefix)
    .replaceAll('$home$', page.home)
    .replaceAll('$privacy_label$', escapeHtml(page.privacyLabel))
    .replaceAll('$terms_label$', escapeHtml(page.termsLabel))
    .replace('$body$', String(body));

  const fullOutPath = `${outDir}/${page.outPath}`;
  const fullOutDir = fullOutPath.substring(0, fullOutPath.lastIndexOf('/'));
  await Deno.mkdir(fullOutDir, { recursive: true });
  await Deno.writeTextFile(fullOutPath, html);
  console.log(`✓ ${page.outPath}`);
}

console.log(`\nRendered ${pages.length} pages → ${outDir}/`);
console.log(`Now: git add marketing/public && git commit`);

// Suppress the "here is unused" warning when run via `deno task`.
void here;
