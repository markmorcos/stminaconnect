import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  getOfflineLegalDoc,
  type LegalDocKind,
  type LegalLang,
} from './offlineLegalDocs';

/**
 * Legal documents are bundled into the JS at build time. We don't
 * fetch a hosted version: the consent screen and the in-app reader
 * read directly from the strings exported by `offlineLegalDocs.ts`.
 *
 * Bumping a policy: edit the markdown body AND bump
 * `CURRENT_PRIVACY_VERSION` / `CURRENT_TERMS_VERSION` in the same
 * commit. The auth route guard compares those against the user's last
 * acceptance and re-prompts on mismatch.
 */

export interface LegalDoc {
  kind: LegalDocKind;
  lang: LegalLang;
  version: string;
  body: string;
}

export const CURRENT_LEGAL_VERSIONS = {
  privacy: CURRENT_PRIVACY_VERSION,
  terms: CURRENT_TERMS_VERSION,
} as const;

function parseVersion(body: string, fallback: string): string {
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const match = firstLine.match(/^version:\s*(\S+)/i);
  return match ? match[1] : fallback;
}

export function getLegalDoc(kind: LegalDocKind, lang: LegalLang): LegalDoc {
  const body = getOfflineLegalDoc(kind, lang);
  const fallback = kind === 'privacy' ? CURRENT_PRIVACY_VERSION : CURRENT_TERMS_VERSION;
  return { kind, lang, version: parseVersion(body, fallback), body };
}
