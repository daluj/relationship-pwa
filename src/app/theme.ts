import { mix, onColor, readableAccent } from '@/domain/color';
import {
  accents,
  themeBackground,
  themeSurfaces,
  type Accent,
  type FontSize,
  type Theme,
} from '@/domain/settings';

export interface AppliedTheme {
  theme: Theme;
  accent: string;
  onAccent: string;
  /** Accent for text/links, ≥ 4.5:1 on every surface of the theme (SPEC §6.10). */
  accentText: string;
  fontSize: FontSize;
}

/** localStorage key read by public/theme-boot.js to avoid a flash before IndexedDB loads. */
export const THEME_BOOT_KEY = 'kin.theme';

export function computeTheme(theme: Theme, accent: Accent, fontSize: FontSize): AppliedTheme {
  const hex = accents[accent];
  const surfaces = themeSurfaces[theme];
  // Accent text also sits on accent-tinted chips (12% accent over the page/card background).
  const tints = [surfaces[0], surfaces[2]].map((bg) => mix(bg, hex, 0.12));
  return {
    theme,
    accent: hex,
    onAccent: onColor(hex),
    accentText: readableAccent(hex, [...surfaces, ...tints]),
    fontSize,
  };
}

export function applyTheme(t: AppliedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = t.theme;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--on-accent', t.onAccent);
  root.style.setProperty('--accent-text', t.accentText);
  root.style.setProperty('--font-size', `${t.fontSize}px`);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeBackground[t.theme]);
  try {
    localStorage.setItem(THEME_BOOT_KEY, JSON.stringify(t));
  } catch {
    // Storage unavailable (private mode) — the boot flash is cosmetic, ignore.
  }
}
