import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';
import translations from './i18n/translations.json';

// `translations` is the single source of truth for mobile copy. The key-parity
// check (scripts/check-i18n-parity.mjs, run in CI) reads this file directly so
// every locale stays in lockstep with the `en` base locale. The locale picker
// derives its options from `getSupportedLocales()` for the same reason.
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';
export const FALLBACK_LANGUAGE = 'en';

const resources = Object.fromEntries(
  Object.entries(translations).map(([lng, translation]) => [lng, { translation }]),
);

/** Locales the app can actually render — derived from the loaded dictionary. */
export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}

/** Whether `lng` maps to a loaded dictionary. Rejects nullish/unknown values. */
export function isSupportedLocale(lng: string | null | undefined): lng is string {
  return typeof lng === 'string' && Object.prototype.hasOwnProperty.call(translations, lng);
}

// Web keeps the original `localStorage` behaviour; native has no `localStorage`,
// so AsyncStorage is the persistence layer there (matching the rest of the app).
const webStorage =
  Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined'
    ? globalThis.localStorage
    : null;

function readStoredLanguage(): string | null {
  if (!webStorage) return null;
  try {
    return webStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode) — fall back to the default.
    return null;
  }
}

function persistLanguage(lng: string): void {
  if (webStorage) {
    try {
      webStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch {
      // A failed write must not break switching; the in-memory locale stands.
    }
    return;
  }
  // Fire-and-forget: persistence must not block the language switch.
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng).catch(() => {});
}

const storedLanguage = readStoredLanguage();

i18n
  .use(initReactI18next)
  .init({
    lng: isSupportedLocale(storedLanguage) ? storedLanguage : FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    resources,
  });

// Native hydration is async, so it runs after the synchronous init above.
if (!webStorage) {
  AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    .then((stored) => {
      if (isSupportedLocale(stored) && stored !== i18n.language) {
        return i18n.changeLanguage(stored);
      }
      return undefined;
    })
    .catch(() => {
      // Storage unavailable — keep the fallback language.
    });
}

// Every selection, from the picker or elsewhere, is persisted here so it
// survives an app restart.
i18n.on('languageChanged', (lng) => {
  persistLanguage(lng);
});

export default i18n;
