/** WCAG relative luminance of a `#RRGGBB` color. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color for content placed on an accent background: whichever of black/white contrasts more. */
export function onColor(hex: string): '#000000' | '#FFFFFF' {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const rgbToHex = (r: number, g: number, b: number) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

/** Linear mix of two colours: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * The accent, darkened (light themes) or lightened (dark themes) just enough to reach `target` contrast on
 * every given background — for accent-coloured text and links (WCAG 1.4.3, SPEC §6.10).
 */
export function readableAccent(accent: string, backgrounds: string[], target = 4.5): string {
  const darkBg = relativeLuminance(backgrounds[0]!) < 0.2;
  const toward = darkBg ? '#FFFFFF' : '#000000';
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(accent, toward, t);
    if (backgrounds.every((bg) => contrastRatio(c, bg) >= target)) return c;
  }
  return toward;
}
