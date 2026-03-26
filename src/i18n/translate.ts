import type { Language, TranslationKey } from './translations';
import { translations } from './translations';

export function detectDeviceLanguage(): Language {
  const raw = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en';
  const lower = raw.toLowerCase();
  if (lower.startsWith('zh')) return 'zh';
  return 'en';
}

export function translate(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = translations[language][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}
