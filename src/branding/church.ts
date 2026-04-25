/**
 * Static church identity surfaced by the About screen. Editable by
 * leadership without code review — values here are intentionally not
 * translated keys, since they're proper nouns and addresses.
 *
 * The `acknowledgments` list supports per-individual opt-in via the
 * `optIn` flag; the About screen filters out non-opted-in entries
 * before rendering. See `add-gdpr-compliance` for how consent is
 * captured for production audiences.
 */

export interface Acknowledgment {
  /** Display name (already in the language they prefer to be addressed in). */
  name: string;
  /** Role or relationship to the project (e.g. "Parish priest", "Beta tester"). */
  role?: string;
  /** Must be true for the entry to appear in the About screen. */
  optIn: boolean;
}

export interface ChurchIdentity {
  name: string;
  /** Multi-line postal address; rendered as-is. */
  address: string;
  /** ISO language codes spoken at services (e.g. ['ar','de','en']). */
  languagesSpoken: readonly string[];
  contact: {
    email?: string;
    phone?: string;
    website?: string;
  };
  acknowledgments: readonly Acknowledgment[];
}

export const church: ChurchIdentity = {
  name: 'St. Mina Coptic Orthodox Church Munich',
  address: 'Coptic Orthodox Church\nMunich, Bavaria\nGermany',
  languagesSpoken: ['ar', 'de', 'en'],
  contact: {
    email: 'info@example.invalid',
    website: 'https://example.invalid',
  },
  acknowledgments: [
    // Real entries land in production once each individual opts in via
    // the consent flow. Until then, the section quietly hides.
  ],
};
