// Theme registry. Tokens live in app/themes.css; this file is just metadata
// + helpers for reading/writing the active theme. Add a new theme by:
//   1. defining its block in app/themes.css
//   2. appending an entry to THEMES below
// See /docs/guides/theming for the full walkthrough.

export interface ThemeMeta {
  id: string;
  label: string;
  description?: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'ocean', label: 'Ocean', description: 'Cool blues, light surface' },
  { id: 'paper', label: 'Paper', description: 'Warm cream + sepia, printed-book feel' },
];

export const DEFAULT_THEME = 'light';
export const STORAGE_KEY = 'dd-theme';

export function isRegistered(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}

// Browser-only helpers.
export function getTheme(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return (
    document.documentElement.getAttribute('data-theme') ?? DEFAULT_THEME
  );
}

export function setTheme(id: string): void {
  if (typeof document === 'undefined') return;
  if (!isRegistered(id)) return;
  document.documentElement.setAttribute('data-theme', id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage may be blocked; the data-theme attribute still applies */
  }
}

// Used by the binary header toggle. Falls back to the next dark/light pair
// when the active theme isn't one of the canonical two.
export function toggleLightDark(): void {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}
