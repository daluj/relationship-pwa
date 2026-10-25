import type { AppLockConfig } from './appLock';

// Typed app settings (stored in the `settings` table as key/value rows).

export const themes = ['light', 'dim', 'lights-out'] as const;
export type Theme = (typeof themes)[number];
export type ThemePreference = Theme | 'system';

export const accents = {
  teal: '#14B8A6',
  blue: '#3B82F6',
  yellow: '#EAB308',
  pink: '#EC4899',
  purple: '#8B5CF6',
  orange: '#F97316',
} as const;
export type Accent = keyof typeof accents;

/** Five steps, base 15px (ui §6.8). */
export const fontSizes = [13, 14, 15, 17, 19] as const;
export type FontSize = (typeof fontSizes)[number];

export const locales = ['en', 'es', 'fr', 'de', 'pt'] as const;
export type Locale = (typeof locales)[number];

export interface AppSettings {
  theme: ThemePreference;
  accent: Accent;
  fontSize: FontSize;
  locale: Locale;
  currency: string;
  onboarded: boolean;
  /** Last full JSON export (backup nudge, features §8.9). */
  lastBackupAt?: string;
  backupNudgeDismissedAt?: string;
  /** Ids created by "Load demo data", so "Remove demo data" removes exactly those (features §8.1). */
  demo?: DemoIds;
  /** Screen lock (not encryption). */
  appLock?: AppLockConfig;
}

export interface DemoIds {
  contacts: string[];
  moments: string[];
  tags: string[];
  groups: string[];
  reminders: string[];
  tasks: string[];
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  accent: 'teal',
  fontSize: 15,
  locale: 'en',
  currency: 'EUR',
  onboarded: false,
};

/** "system" → Light or Lights out based on prefers-color-scheme (ui §6.8). */
export function resolveTheme(pref: ThemePreference, prefersDark: boolean): Theme {
  if (pref !== 'system') return pref;
  return prefersDark ? 'lights-out' : 'light';
}

/** Page and card backgrounds per theme — must match styles/themes.css (used for contrast maths). */
export const themeSurfaces: Record<Theme, [bg: string, surface1: string, surface2: string]> = {
  light: ['#FFFFFF', '#F5F8F8', '#EFF3F3'],
  dim: ['#15202B', '#1C2834', '#1F2C38'],
  'lights-out': ['#000000', '#0B0C0D', '#17191B'],
};

export const themeBackground: Record<Theme, string> = {
  light: '#FFFFFF',
  dim: '#15202B',
  'lights-out': '#000000',
};
