import { useTranslation } from 'react-i18next';
import { Moon, MoonStar, Sun } from 'lucide-react';
import { settingsRepo, useSettings } from '@/db/repositories';
import { resolveTheme, type Theme } from '@/domain/settings';

const next: Record<Theme, Theme> = { light: 'dim', dim: 'lights-out', 'lights-out': 'light' };
const icons = { light: Sun, dim: Moon, 'lights-out': MoonStar } as const;

/** Cycles Light → Dim → Lights out (SPEC §6.1 bottom of left nav). */
export function ThemeToggle({ showLabel }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const current = resolveTheme(theme, matchMedia('(prefers-color-scheme: dark)').matches);
  const Icon = icons[current];
  const label = t(`settings.themes.${current}`);
  return (
    <button
      type="button"
      onClick={() => void settingsRepo.set('theme', next[current])}
      aria-label={t('nav.toggleTheme', { theme: label })}
      className="flex items-center gap-4 rounded-full p-3 hover:bg-surface-2"
    >
      <Icon size={24} aria-hidden />
      {showLabel && <span className="text-lg">{label}</span>}
    </button>
  );
}
