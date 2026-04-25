/**
 * Module augmentation that gives `t()` a typed key union derived from
 * the EN locale file. After this declaration, `t('auth.signIn.unknownKey')`
 * is a TypeScript error in editors and in `npm run typecheck`.
 *
 * The EN file is the source of truth for keys; AR/DE are validated by
 * `tests/i18n/keyParity.test.ts`.
 */
import 'i18next';

import en from './locales/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
