export const THEME_OPTIONS = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export type Theme = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

const THEME_VALUES = new Set<string>(Object.values(THEME_OPTIONS));

export function toTheme(value: string): Theme {
  return THEME_VALUES.has(value) ? (value as Theme) : THEME_OPTIONS.SYSTEM;
}
