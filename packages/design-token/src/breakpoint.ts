export const breakpoints = {
  sm: 425,
  md: 760,
  lg: 896,
  xl: 1100,
  "2xl": 1280,
} as const;

export const mediaQuery = {
  sm: `(max-width: ${breakpoints.sm}px)`,
  md: `(max-width: ${breakpoints.md}px)`,
  lg: `(max-width: ${breakpoints.lg}px)`,
  xl: `(max-width: ${breakpoints.xl}px)`,
  "2xl": `(max-width: ${breakpoints["2xl"]}px)`,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type Breakpoints = typeof breakpoints;
export type MediaQuery = typeof mediaQuery;
